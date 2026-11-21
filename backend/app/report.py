from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from .rules import redact
from .schemas import Incident

FONTS = Path(__file__).resolve().parents[1] / "fonts"
LABELS = {
    "category": "Incident category", "description": "Description", "loss": "Reported loss",
    "date_time": "Incident date and time", "channel": "Communication channel",
    "compromised": "Compromised information", "sender": "Suspected sender identifiers",
    "urls": "Relevant URLs", "transactions": "Transaction references", "evidence": "Evidence inventory",
    "actions": "Actions already taken", "chronology": "Incident chronology", "missing": "Missing information",
}


TITLES = {
    "en": "Cyber fraud incident summary",
    "hi": "साइबर धोखाधड़ी की घटना का सारांश",
    "as": "চাইবাৰ জালিয়াতিৰ ঘটনাৰ সাৰাংশ",
}


def pdf_report(incident: Incident, language: str = "en") -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(True, margin=18)
    pdf.set_margins(20, 18, 20)
    pdf.add_font("Latin", fname=FONTS / "NotoSans.ttf")
    pdf.add_font("Devanagari", fname=FONTS / "NotoSansDevanagari.ttf")
    pdf.add_font("Bengali", fname=FONTS / "NotoSansBengali.ttf")
    pdf.set_fallback_fonts(["Devanagari", "Bengali"])
    pdf.set_text_shaping(True)
    pdf.add_page()
    pdf.set_font("Latin", size=23)
    pdf.multi_cell(0, 14, TITLES[language], new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font_size(10)
    pdf.multi_cell(0, 6, f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC}")
    pdf.ln(4)

    for field, value in incident.model_dump().items():
        pdf.set_font_size(12)
        pdf.cell(0, 8, LABELS[field], new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font_size(10)
        cleaned = redact(value).strip() or "Unknown"
        pdf.multi_cell(0, 6, cleaned, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(3)

    pdf.multi_cell(0, 6, "India reporting resources: 1930 and https://cybercrime.gov.in/\n"
                         "This document is a user-prepared incident summary and is not an official police complaint.",
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return bytes(pdf.output())
