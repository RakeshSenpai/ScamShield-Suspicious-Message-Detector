import asyncio
import time
from collections import deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ValidationError
from starlette.datastructures import UploadFile

from . import ai, config
from .detection import assess, prepare_image
from .report import pdf_report
from .rules import redact
from .schemas import Assessment, Incident, IncidentInput, IncidentResult, Language, LinkResult
from .urls import inspect, verify

app = FastAPI(title="ScamShield")
provider_slots = asyncio.Semaphore(4)
recent_requests: deque[float] = deque()
MAX_BODY = config.MAX_IMAGE + 65_536


@app.middleware("http")
async def limit_requests(request: Request, call_next):
    if request.method == "POST":
        origin = request.headers.get("origin")
        same_origin = f"{request.url.scheme}://{request.url.netloc}"
        if origin and origin != same_origin and origin not in config.ALLOWED_ORIGINS:
            return JSONResponse({"detail": "origin_rejected"}, 403)
        size = request.headers.get("content-length", "")
        if not size.isascii() or not size.isdecimal() or len(size) > 10:
            return JSONResponse({"detail": "length_required"}, 411)
        if int(size) > MAX_BODY:
            return JSONResponse({"detail": "upload_too_large"}, 413)
        if request.url.path in {"/api/analyze", "/api/emergency/analyze", "/api/verify-url"}:
            now = time.monotonic()
            while recent_requests and now - recent_requests[0] > 60:
                recent_requests.popleft()
            if len(recent_requests) >= 30:
                return JSONResponse({"detail": "rate_limit"}, 429, headers={"Retry-After": "60"})
            recent_requests.append(now)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError):
    return JSONResponse({"detail": "invalid_input"}, 422)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/capabilities")
async def capabilities() -> dict[str, bool]:
    return {"rules": True, "ai_configured": config.AI_CONFIGURED,
            "reputation_configured": bool(config.REPUTATION_KEY)}


@app.post("/api/analyze", response_model=Assessment)
async def analyze(request: Request):
    async with request.form(max_files=1, max_fields=3, max_part_size=40_000) as form:
        text, url, language = (form.get("text", ""), form.get("url", ""), form.get("language", "en"))
        if not all(isinstance(value, str) for value in (text, url, language)):
            raise HTTPException(422, "invalid_input")
        text, url = text.strip(), url.strip()
        if len(text) > 8000 or len(url) > 2000 or language not in ai.LANGUAGES:
            raise HTTPException(422, "invalid_input")
        if url:
            try:
                inspect(url)
            except ValueError:
                raise HTTPException(422, "invalid_url") from None
        image = None
        upload = form.get("image")
        if upload is not None:
            if not isinstance(upload, UploadFile):
                raise HTTPException(422, "invalid_image")
            data = await upload.read(config.MAX_IMAGE + 1)
            if len(data) > config.MAX_IMAGE:
                raise HTTPException(413, "upload_too_large")
            try:
                image = await asyncio.to_thread(prepare_image, data)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from None
        if not (text or url or image):
            raise HTTPException(422, "empty_input")
    async with provider_slots:
        return await assess(text, url, image, language)


class URLInput(BaseModel):
    url: str = Field(min_length=1, max_length=2000)


@app.post("/api/verify-url", response_model=LinkResult)
async def verify_url(data: URLInput):
    try:
        async with provider_slots:
            return await verify(data.url)
    except ValueError:
        raise HTTPException(422, "invalid_url") from None


@app.post("/api/emergency/analyze", response_model=IncidentResult)
async def emergency(data: IncidentInput):
    description = redact(data.description)
    draft = Incident(description=description)
    if not config.AI_CONFIGURED:
        return IncidentResult(status="unconfigured", incident=draft)
    try:
        async with provider_slots:
            draft = await ai.analyze(
                Incident, "Extract only details explicitly reported by the user. Describe the type of compromised information without its value. Leave unknown details blank and record important open questions in missing.",
                description, data.language,
            )
        fields = {field: redact(value) for field, value in draft.model_dump().items()}
        fields["description"] = description
        return IncidentResult(status="completed", incident=Incident.model_validate(fields))
    except (ai.AIUnavailable, ValidationError):
        return IncidentResult(status="unavailable", incident=Incident(description=description))


class ReportRequest(BaseModel):
    incident: Incident
    confirmed: bool = False
    language: Language = "en"


@app.post("/api/reports/generate")
async def generate(data: ReportRequest):
    if not data.confirmed or not data.incident.description.strip():
        raise HTTPException(422, "review_required")
    result = await asyncio.to_thread(pdf_report, data.incident, data.language)
    return Response(result, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="scamshield-incident.pdf"'})
