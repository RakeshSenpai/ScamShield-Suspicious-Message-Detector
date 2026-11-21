from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Language = Literal["en", "hi", "as"]
Short = Annotated[str, StringConstraints(max_length=500)]
Detail = Annotated[str, StringConstraints(max_length=4000)]
Notes = Annotated[list[Short], Field(max_length=10)]
Risk = Literal["high", "medium", "low", "insufficient"]


class Finding(BaseModel):
    id: str
    category: str
    severity: Literal["high", "medium", "low"]
    evidence: str


class Context(BaseModel):
    category: Short
    summary: Short
    concern: Literal["strong", "some", "none", "unclear"]
    sender: Short
    requested_action: Short
    tactics: Notes
    supporting: Notes
    reassuring: Notes
    missing: Notes
    impact: Short
    actions: Notes
    limitations: Notes
    transcript: Detail


class LinkResult(BaseModel):
    domain: str
    registrable_domain: str
    findings: list[Finding]
    reputation: Literal["match", "no_match", "unconfigured", "unavailable", "skipped"]
    threats: list[str] = Field(default_factory=list)


class Assessment(BaseModel):
    risk: Risk
    basis: str
    rules_ran: bool
    findings: list[Finding]
    ai_status: Literal["completed", "unconfigured", "unavailable", "image_unreadable"]
    ai: Context | None
    links: list[LinkResult]
    limitations: list[str]
    actions: list[str]


class IncidentInput(BaseModel):
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4000)]
    language: Language = "en"


class Incident(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Short = ""
    description: Detail = ""
    loss: Short = ""
    date_time: Short = ""
    channel: Short = ""
    compromised: Short = ""
    sender: Short = ""
    urls: Short = ""
    transactions: Short = ""
    evidence: Detail = ""
    actions: Detail = ""
    chronology: Detail = ""
    missing: Detail = ""


class IncidentResult(BaseModel):
    status: Literal["completed", "unavailable", "unconfigured"]
    incident: Incident
 
