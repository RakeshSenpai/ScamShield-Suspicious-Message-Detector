import asyncio
import re
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from . import ai, config, urls
from .rules import detect, redact
from .schemas import Assessment, Context, Finding, LinkResult, Risk


def prepare_image(data: bytes) -> bytes:
    try:
        with Image.open(BytesIO(data), formats=["PNG", "JPEG", "WEBP"]) as source:
            if source.width * source.height > 16_000_000 or getattr(source, "n_frames", 1) != 1:
                raise ValueError("unsupported_image")
            source.load()
            clean = ImageOps.exif_transpose(source).convert("RGB")
            clean.thumbnail((2400, 2400))
            output = BytesIO()
            clean.save(output, format="JPEG", quality=86)
            return output.getvalue()
    except (OSError, Image.DecompressionBombError, UnidentifiedImageError) as exc:
        raise ValueError("invalid_image") from exc


def decide(findings: list[Finding], links: list[LinkResult], context: Context | None, text: str) -> tuple[Risk, str]:
    if any(link.reputation == "match" for link in links):
        return "high", "reputation_match"
    if any(f.severity == "high" and f.category != "url" for f in findings):
        return "high", "strong_rule"
    medium = {f.category for f in findings if f.severity == "medium"}
    if len(medium) >= 2 or (medium and context and context.concern == "strong"):
        return "high", "multiple_signals"
    if medium or any(f.severity == "high" for f in findings) or (context and context.concern in {"strong", "some"}):
        return "medium", "warning_signs"
    if (context and context.concern == "unclear") or len(text.strip()) < 12 or re.fullmatch(
        r"(?:please )?(?:contact|call|reach out to)[^.!?]{0,70}[.!?]?", text.strip(), re.I
    ):
        return "insufficient", "limited_evidence"
    if findings and not (context and context.concern == "none" and context.reassuring):
        return "medium", "warning_signs"
    return "low", "few_signals"


async def assess(text: str, url: str, image: bytes | None, language: str) -> Assessment:
    context = None
    status = "unconfigured"
    if config.AI_CONFIGURED:
        try:
            context = await ai.analyze(
                Context,
                "Set concern to strong, some, none, or unclear. For a screenshot, transcribe visible text in transcript with credentials omitted; leave transcript empty if unreadable. Without an image, return an empty transcript.",
                redact("\n".join(filter(None, [text, url]))), language, image,
            )
            fields = {
                key: [redact(item) for item in value] if isinstance(value, list) else redact(value)
                for key, value in context.model_dump().items()
            }
            context = Context.model_validate(fields)
            status = "completed" if not image or context.transcript.strip() else "image_unreadable"
        except (ai.AIUnavailable, ValueError):
            status = "unavailable"

    transcript = context.transcript if image and context else ""
    evidence = "\n".join(filter(None, [text, transcript]))
    provided = ([url] if url else []) + [
        raw.rstrip(".,!?);]") for raw in urls.URL_PATTERN.findall(text)
    ]
    submitted = provided + [
        raw.rstrip(".,!?);]") for raw in urls.URL_PATTERN.findall(transcript)
    ]
    links = []
    truncated = False
    invalid_link = False
    candidates = list(dict.fromkeys(submitted))
    if len(candidates) > 8:
        truncated = True

    async def check(raw: str):
        try:
            if raw in provided:
                return await urls.verify(raw)
            return urls.inspect(raw)[0]
        except ValueError:
            return None

    for link in await asyncio.gather(*(check(raw) for raw in candidates[:8])):
        if link is None:
            invalid_link = True
        else:
            links.append(link)
    findings = detect(evidence)
    unique = {(f.id, f.evidence): f for link in links for f in link.findings}
    findings.extend(unique.values())
    risk, basis = decide(findings, links, context, evidence or url)
    limitations = ["sender_unverified"]
    if transcript:
        limitations.append("model_transcript")
    if image and not transcript:
        limitations.append("image_not_read")
        if not text and not url:
            risk, basis = "insufficient", "limited_evidence"
    if truncated:
        limitations.append("url_limit")
    if invalid_link:
        limitations.append("invalid_embedded_url")
    if context and ((risk == "high" and context.concern in {"none", "unclear"}) or
                    (basis == "warning_signs" and not findings)):
        limitations.append("engines_disagree")
    actions = ["verify_sender", "protect_credentials"]
    if risk in {"high", "medium"}:
        actions.extend(["avoid_interaction", "preserve_evidence"])
    return Assessment(risk=risk, basis=basis, rules_ran=bool(evidence or url), findings=findings,
                      ai_status=status, ai=context, links=links, limitations=limitations, actions=actions)
