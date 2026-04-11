"""Pydantic request / response schemas for the MailFort API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EmailAnalysisRequest(BaseModel):
    """Payload accepted by POST /analyze/email."""

    sender: str = ""
    subject: str = ""
    body: str = ""
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)
    headers: dict[str, Any] = Field(default_factory=dict)
    label: str = ""


# Rebuild required for forward‑ref resolution (self-referencing generics)
EmailAnalysisRequest.model_rebuild()


class HealthResponse(BaseModel):
    status: str
    service: str


class EmailSummary(BaseModel):
    id: int
    sender: str
    subject: str
    verdict: str
    created_at: str


class EmailDetailResponse(EmailSummary):
    body: str
    analysis_result: Any


class StatsBreakdown(BaseModel):
    Safe: int = 0
    Suspicious: int = 0
    Malicious: int = 0


class StatsResponse(BaseModel):
    total: int
    breakdown: StatsBreakdown
