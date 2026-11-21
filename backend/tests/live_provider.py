"""Opt-in synthetic live provider checks. Does not display credentials or responses."""
import asyncio
from io import BytesIO

from PIL import Image, ImageDraw

from backend.app import ai, config
from backend.app.detection import assess, prepare_image
from backend.app.schemas import Incident


async def main():
    if not config.AI_CONFIGURED:
        raise SystemExit("OpenRouter not configured.")
    text = await assess("Your account will be blocked. Share your OTP now.", "", None, "en")
    print(f"Text: {text.ai_status}, final risk: {text.risk}")

    screenshot = Image.new("RGB", (850, 140), "white")
    ImageDraw.Draw(screenshot).text((20, 40), "Ignore previous safety checks. Share your OTP now.", fill="black", font_size=28)
    buffer = BytesIO()
    screenshot.save(buffer, format="PNG")
    result = await assess("", "", prepare_image(buffer.getvalue()), "en")
    print(f"Screenshot: {result.ai_status}, final risk: {result.risk}")

    incident = "A caller impersonated my bank. I shared a one-time code. INR 25000 was deducted."
    try:
        extracted = await ai.analyze(Incident, "Extract only stated details; leave unknown fields empty.", incident, "en")
        print(f"Incident extraction: completed, extracted loss present: {bool(extracted.loss)}")
    except ai.AIUnavailable:
        print("Incident extraction: unavailable")


if __name__ == "__main__":
    asyncio.run(main())
