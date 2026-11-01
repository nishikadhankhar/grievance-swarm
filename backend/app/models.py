from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # S-1042, TECH-WIFI, WARDEN-1
    role: Mapped[str] = mapped_column(String(16))  # student / technician / warden / dean
    pseudonym: Mapped[str] = mapped_column(String(64))
    hostel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    department: Mapped[str | None] = mapped_column(String(16), nullable=True)  # technicians only
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)  # None: can't sign in
    password_hash: Mapped[str | None] = mapped_column(String(160), nullable=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)  # sha256 of the bearer token
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Place(Base):
    __tablename__ = "places"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(16))
    hostel: Mapped[str | None] = mapped_column(String(32), nullable=True)


class Grievance(Base):
    __tablename__ = "grievances"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # null for anonymous reports
    raw_text_redacted: Mapped[str] = mapped_column(Text)
    place_id: Mapped[str] = mapped_column(String(32))
    category: Mapped[str] = mapped_column(String(16))
    ticket_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # T-074
    title: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(16))  # wifi / electricity / water / other
    place_id: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="reported")  # reported/assigned/in_progress/resolved
    assignee_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    eta: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    eta_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # False while the ETA is only the agent's proposal; the Warden confirms it, because only the Warden
    # sees every open ticket and can keep times realistic when many reports arrive at once.
    eta_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggestion_call_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    visits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TicketEvent(Base):
    __tablename__ = "ticket_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(String(16), index=True)
    actor_type: Mapped[str] = mapped_column(String(8))  # person / agent
    actor_id: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    meko_call_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    at: Mapped[datetime] = mapped_column(DateTime)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(16))  # lesson / escalation / closure / pattern
    payload: Mapped[dict] = mapped_column(JSON)
    proposed_by_agent: Mapped[str] = mapped_column(String(32))
    decided_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending / approved / rejected
    ticket_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    meko_call_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Directive(Base):
    __tablename__ = "directives"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    department: Mapped[str] = mapped_column(String(16))
    hostel: Mapped[str] = mapped_column(String(32))  # hostel-b, or "all"
    message: Mapped[str] = mapped_column(Text)
    valid_from: Mapped[datetime] = mapped_column(DateTime)
    valid_to: Mapped[datetime] = mapped_column(DateTime)
    posted_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    meko_call_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)


class MekoCall(Base):
    """One row per adapter call. The swarm board renders only from this table."""

    __tablename__ = "meko_calls"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # rc_8f31a2
    at: Mapped[datetime] = mapped_column(DateTime, index=True)
    actor: Mapped[str] = mapped_column(String(16))  # graph node: student, desk, wifi, technician, ...
    actor_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target: Mapped[str | None] = mapped_column(String(32), nullable=True)
    op: Mapped[str] = mapped_column(String(16))  # write / recall / share / promote / directive / approval
    datapack: Mapped[str] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(Text)
    result_ids: Mapped[list] = mapped_column(JSON, default=list)
    result_preview: Mapped[list] = mapped_column(JSON, default=list)  # what Meko returned, for ContextChip
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)  # Meko was OFF
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    ticket_id: Mapped[str | None] = mapped_column(String(16), nullable=True)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime, index=True)
    from_actor: Mapped[str] = mapped_column(String(32))
    to_actor: Mapped[str] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(16))
    ticket_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    meko_call_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    llm_base_url: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(64))
    llm_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    meko_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    clock_offset_minutes: Mapped[int] = mapped_column(Integer, default=0)
