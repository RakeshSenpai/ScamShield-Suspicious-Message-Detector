import asyncio
import ipaddress
import logging
import re
from urllib.parse import urlsplit

import httpx
import tldextract

from . import config
from .schemas import Finding, LinkResult

log = logging.getLogger(__name__)
extract = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True)
URL_PATTERN = re.compile(r"\b(?:https?://|www\.)[^\s<>\"']+", re.I)
DOMAIN = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", re.I)
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "rb.gy", "t.ly", "cutt.ly", "shorturl.at"}
LOOKALIKES = str.maketrans("аесорхуіјѕӏαεορτυχ", "aecopxyijsl aeoptyx".replace(" ", ""))
BRANDS = {
    "sbi": {"sbi.co.in", "onlinesbi.sbi", "bank.sbi"},
    "hdfc": {"hdfcbank.com"},
    "paypal": {"paypal.com"},
    "amazon": {"amazon.com", "amazon.in"},
    "paytm": {"paytm.com"},
    "phonepe": {"phonepe.com"},
    "whatsapp": {"whatsapp.com", "whatsapp.net"},
    "indiapost": {"indiapost.gov.in"},
}


def inspect(raw: str) -> tuple[LinkResult, str | None]:
    raw = raw.strip()
    if not raw or len(raw) > 2000 or re.search(r"[\s\\\x00-\x1f\x7f]", raw):
        raise ValueError("invalid_url")
    parsed = urlsplit(raw if "://" in raw else "https://" + raw)
    host = (parsed.hostname or "").rstrip(".")
    port = parsed.port
    if parsed.scheme not in {"http", "https"} or not host:
        raise ValueError("invalid_url")
    flags = []
    ip = None
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        pass
    ascii_host = host.encode("idna").decode("ascii").lower()
    if ip is None and (len(ascii_host) > 253 or not DOMAIN.fullmatch(ascii_host)):
        raise ValueError("invalid_url")
    registered = "" if ip else extract(ascii_host).top_domain_under_public_suffix
    if ip:
        flags.append(("ip_host", "medium"))
    if parsed.username is not None or parsed.password is not None:
        flags.append(("embedded_credentials", "high"))
    if "xn--" in ascii_host or any(ord(char) > 127 for char in host):
        flags.append(("international_domain", "low"))
    if ascii_host in SHORTENERS:
        flags.append(("shortener", "low"))
    if port and port not in {80, 443}:
        flags.append(("unusual_port", "low"))
    try:
        decoded = ascii_host.encode("ascii").decode("idna")
    except UnicodeError:
        decoded = host
    tokens = re.split(r"[.-]", ascii_host)
    folded = re.split(r"[.-]", decoded.casefold().translate(LOOKALIKES))
    if any(brand in folded and brand not in tokens for brand in BRANDS):
        flags.append(("lookalike_domain", "medium"))
    if any(brand in tokens and registered not in domains for brand, domains in BRANDS.items()):
        flags.append(("brand_domain", "medium"))
    findings = [Finding(id=code, category="url", severity=severity, evidence=ascii_host)
                for code, severity in flags]
    result = LinkResult(domain=ascii_host, registrable_domain=registered, findings=findings, reputation="skipped")
    if not registered or ip or parsed.username is not None or parsed.query or parsed.fragment:
        return result, None
    return result, parsed._replace(fragment="").geturl()


async def verify(raw: str) -> LinkResult:
    result, lookup = inspect(raw)
    if not lookup:
        return result
    if not config.REPUTATION_KEY:
        result.reputation = "unconfigured"
        return result
    try:
        async with asyncio.timeout(7), httpx.AsyncClient(timeout=5) as client:
            response = await client.post(
                "https://safebrowsing.googleapis.com/v4/threatMatches:find",
                params={"key": config.REPUTATION_KEY},
                json={"client": {"clientId": "scamshield", "clientVersion": "1.0"}, "threatInfo": {
                    "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    "platformTypes": ["ANY_PLATFORM"],
                    "threatEntryTypes": ["URL"],
                    "threatEntries": [{"url": lookup}],
                }},
            )
            response.raise_for_status()
            data = response.json()
            matches = data.get("matches", [])
            result.threats = sorted({match["threatType"] for match in matches})
            result.reputation = "match" if matches else "no_match"
    except (TimeoutError, httpx.HTTPError, ValueError, TypeError, AttributeError, KeyError):
        log.warning("URL reputation lookup failed")
        result.reputation = "unavailable"
    return result
