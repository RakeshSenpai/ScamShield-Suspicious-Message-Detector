import re

from .schemas import Finding

RULES = (
    ("credential_request", "credentials", "high",
     r"\b(?:share|send|provide|enter|confirm|reply with|tell us|submit|give us)\s+(?:(?:your|the|us|a|one.time)\s+){0,3}(?:otp|password|pin|cvv|recovery code|banking credentials|authentication code)\b"),
    ("account_threat", "phishing", "medium", r"\baccount\b[^.!?\n]{0,45}\b(?:blocked|suspended|restricted|disabled)\b"),
    ("kyc_request", "phishing", "medium", r"\b(?:update|complete|verify|renew)\s+(?:your\s+)?kyc\b"),
    ("login_request", "phishing", "medium",
     r"\b(?:verify|confirm|re-enter|update)\s+(?:your\s+)?(?:credentials|bank(?:ing)? details)\b|\b(?:log ?in|sign ?in)\b.{0,32}\b(?:link|page)\b"),
    ("pressure", "urgency", "low",
     r"\b(?:act immediately|final warning|pay now|immediate legal action|(?:in|within)\s+\d+\s+minutes?)\b"),
    ("advance_fee", "financial", "high",
     r"\b(?:pay|transfer|deposit)\b[^.!?\n]{0,100}\b(?:to claim|to release|processing fee|registration fee|upfront fee)\b"),
    ("investment", "financial", "medium", r"\b(?:guaranteed|risk.free)\s+(?:profits?|returns?)\b"),
    ("remote_access", "software", "high", r"\b(?:install|download)\b[^.!?\n]{0,50}\b(?:anydesk|teamviewer|remote.access)\b"),
    ("recruitment", "recruitment", "medium",
     r"\b(?:shortlisted|recruiter|interview|job offer|recruitment)\b"),
    ("software_install", "software", "medium", r"\b(?:install|download)\b[^.!?\n]{0,65}\b(?:software|app|apk)\b"),
    ("sender_claim", "impersonation", "low",
     r"\b(?:this is|i am|i'm|calling from|on behalf of|message from)\b[^.!?\n]{0,48}\b(?:bank|police|government|dhl|fedex|recruitment|paytm|sbi|hdfc|india post|phonepe|whatsapp|amazon)\b"),
    ("authority_payment", "financial", "medium",
     r"\b(?:police|customs|court|government)\b[^.!?\n]{0,80}\b(?:pay|transfer|fine)\b"),
    ("job_documents", "recruitment", "medium",
     r"\b(?:send|upload|submit)\b[^.!?\n]{0,42}\b(?:aadhaar|pan card|passport)\b"),
    ("model_instruction", "manipulation", "low",
     r"\bignore\b.{0,70}\b(?:instructions|safety checks|previous prompt)\b"),
)
NEGATION = re.compile(r"\b(?:never|do not|don.t|should not|won.t|will not|would never|avoid)\b[^.!?\n;]{0,40}$", re.I)
SECRETS = re.compile(r"\b(otp|cvv|pin|password|recovery code)\s*(?:is\s+|[:=]\s*|\s+(?=\d{3,8}\b))([^\s,;]+)", re.I)
CARD = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")


def redact(text: str) -> str:
    return CARD.sub("[redacted]", SECRETS.sub(r"\1 [redacted]", text))


def detect(text: str) -> list[Finding]:
    results = []
    for rule_id, category, severity, expression in RULES:
        if rule_id == "recruitment" and not re.search(r"\b(install|download|fee|pay|guaranteed)\b", text, re.I):
            continue
        if rule_id == "job_documents" and not re.search(r"\b(job|recruit\w*|interview)\b", text, re.I):
            continue
        for match in re.finditer(expression, text, re.I):
            if NEGATION.search(text[max(0, match.start() - 65):match.start()]):
                continue
            results.append(Finding(id=rule_id, category=category, severity=severity, evidence=redact(match.group())))
            break
    return results
