"""Reset both stores and load demo data. Every seeded event, message and Meko call is flagged simulated.

Run: python -m app.seed
"""

import asyncio
from datetime import timedelta

from . import clock
from .db import Base, SessionLocal, engine
from .meko_client import meko
from .models import Approval, Grievance, Place, Setting, Ticket, User
from .services import add_event, add_message
from . import config
from .auth import hash_password

SIM = {"simulated": True}
# Seeded users who can sign in (as <id>@demo.campus); listed on the sign-in page for the demo.
DEMO_ACCOUNTS = ("S-1042", "S-1038", "S-1077", "TECH-WIFI", "TECH-ELEC", "TECH-WATER", "WARDEN-1", "DEAN-1")


def _users(db):
    db.add_all([
        Place(id="hostel-a", name="Hostel A", type="hostel", hostel="hostel-a"),
        Place(id="hostel-b", name="Hostel B", type="hostel", hostel="hostel-b"),
        Place(id="library", name="Library", type="academic", hostel=None),
        Place(id="mess", name="Mess", type="dining", hostel=None),
        User(id="S-1042", role="student", pseudonym="S-1042", hostel="hostel-b"),
        User(id="S-1038", role="student", pseudonym="S-1038", hostel="hostel-a"),
        User(id="S-1077", role="student", pseudonym="S-1077", hostel="hostel-b"),
        *[User(id=f"S-{n}", role="student", pseudonym=f"S-{n}", hostel="hostel-b") for n in range(1101, 1115)],
        User(id="TECH-WIFI", role="technician", pseudonym="Technician · Wi-Fi", department="wifi"),
        User(id="TECH-ELEC", role="technician", pseudonym="Technician · Electricity", department="electricity"),
        User(id="TECH-WATER", role="technician", pseudonym="Technician · Water", department="water"),
        User(id="WARDEN-1", role="warden", pseudonym="Warden"),
        User(id="DEAN-1", role="dean", pseudonym="Dean"),
    ])
    for uid in DEMO_ACCOUNTS:
        u = db.get(User, uid)
        u.email, u.password_hash = f"{uid.lower()}@demo.campus", hash_password(config.DEMO_PASSWORD)
    db.commit()


async def _knowledge(db, now):
    old = now - timedelta(days=200)
    await meko.write(db, "wifi", "dept-wifi", "Hostel B 2nd floor router went offline in March. Cause: failed PSU, "
               "not the router. Fix: replaced the PSU.", {"kind": "fix", "place_id": "hostel-b"}, at=old, **SIM)
    await meko.write(db, "electricity", "dept-electricity", "Hostel A geyser not heating: replaced the heating element.",
               {"kind": "fix", "place_id": "hostel-a"}, at=old, **SIM)
    await meko.write(db, "water", "dept-water", "Mess RO dispenser slow: pre-filter clogged, replaced the pre-filter.",
               {"kind": "fix", "place_id": "mess"}, at=old, **SIM)
    for text, cat in [("Router offline after a power cut → check the router PSU first.", "wifi"),
                      ("Mess drain blocked after weekend events → flush the lines on Monday.", "water")]:
        await meko.promote(db, "curator", text, {"kind": "lesson", "category": cat, "approved_by": "WARDEN-1"},
                     at=old, **SIM)
    patterns = [
        ("RO filters fail every ~40 days in both hostels", "water", "Every ~40 days",
         [20, 30, 45, 80, 25, 35, 50, 85, 30, 40, 55, 90]),
        ("Geysers in Hostel A trip after 7 pm on cold evenings", "electricity", "Peak 7–9 pm",
         [10, 15, 12, 30, 35, 50, 45, 60, 70, 65, 85, 90]),
        ("Router PSUs fail within 3 months of the monsoon", "wifi", "Jul–Oct spike",
         [15, 10, 20, 25, 20, 55, 70, 80, 60, 45, 35, 30]),
        ("Mess drains block after weekend events", "water", "Every Monday",
         [20, 60, 25, 20, 70, 30, 25, 75, 30, 22, 80, 28]),
    ]
    for text, cat, stat, series in patterns:
        await meko.promote(db, "curator", text, {"kind": "pattern", "verified": True, "approved_by": "WARDEN-1",
                                           "category": cat, "stat": stat, "series": series}, at=old, **SIM)


async def _open_ticket(db, now, *, tid, title, cat, place, minutes_ago, reporters, eta_in, text):
    created = now - timedelta(minutes=minutes_ago)
    tech = {"wifi": "TECH-WIFI", "electricity": "TECH-ELEC", "water": "TECH-WATER"}[cat]
    t = Ticket(id=tid, title=title, category=cat, place_id=place, status="assigned", assignee_id=tech,
               report_count=len(reporters), created_at=created, eta=now + timedelta(minutes=eta_in),
               eta_confirmed=True)
    db.add(t)
    for i, uid in enumerate(reporters):
        db.add(Grievance(user_id=uid, raw_text_redacted=text, place_id=place, category=cat, ticket_id=tid,
                         created_at=created + timedelta(minutes=i)))
    db.commit()
    at = lambda m: created + timedelta(minutes=m)  # noqa: E731
    add_event(db, t, "person", reporters[0], f"Reported “{title}”", at=at(0), **SIM)
    fp = await meko.write(db, "desk", "desk", f"{title}. {text}", {"kind": "fingerprint", "ticket_id": tid,
                    "status": "open", "place_id": place, "category": cat}, ticket_id=tid, at=at(1), **SIM)
    add_event(db, t, "agent", "desk", f"Created {tid}, tagged {cat}", "No similar open ticket found", fp.call_id,
              at=at(1), **SIM)
    sh = await meko.share(db, "desk", cat, f"dept-{cat}", f"New ticket {tid}: {text}", {"kind": "handoff",
                    "ticket_id": tid}, ticket_id=tid, at=at(1), **SIM)
    add_message(db, "desk", cat, f"{tid} routed: {title}", "share", tid, sh.call_id, at=at(1), **SIM)
    r = await meko.recall(db, cat, [f"dept-{cat}", "campus-kb"], f"{title} {text}", k=3,
                    where={"kind": ["fix", "lesson", "note"]}, ticket_id=tid, at=at(2), **SIM)
    if r.items:
        t.suggestion, t.suggestion_call_id = r.items[0]["text"], r.call_id
        db.commit()
        add_event(db, t, "agent", cat, f"Suggested: {r.items[0]['text']}", f"Recalled from {r.items[0]['datapack']}",
                  r.call_id, at=at(2), **SIM)
        add_message(db, cat, "technician", f"{tid} flag: {r.items[0]['text']}", "recall", tid, r.call_id, at=at(2),
                    **SIM)
    add_event(db, t, "agent", cat, f"Proposed ETA {t.eta:%a %H:%M} for the Warden to confirm", None, at=at(3), **SIM)
    w = await meko.write(db, "warden", f"dept-{cat}", f"Warden set ETA for {tid} to {t.eta:%a %H:%M}",
                         {"kind": "eta", "ticket_id": tid, "confirmed": True}, actor_id="WARDEN-1", target="students",
                         ticket_id=tid, at=at(4), **SIM)
    add_event(db, t, "person", "WARDEN-1", f"Set ETA to {t.eta:%a %H:%M}", None, w.call_id, at=at(4), **SIM)
    if len(reporters) > 1:
        add_event(db, t, "agent", "desk", f"Merged {len(reporters) - 1} similar reports into {tid}",
                  f"Same place and category within {minutes_ago} minutes", at=at(min(minutes_ago, 20)), **SIM)
    return t


def _history(db, now):
    for tid, title, cat, place, visits, sugg, days in [
        ("T-031", "Router offline on 2nd floor", "wifi", "hostel-b", 1, None, 200),
        ("T-052", "Geyser not heating, room 118", "electricity", "hostel-a", 2, None, 40),
        ("T-066", "RO water dispenser slow", "water", "mess", 1, "Replace the pre-filter", 20),
    ]:
        db.add(Ticket(id=tid, title=title, category=cat, place_id=place, status="resolved", report_count=1,
                      visits=visits, suggestion=sugg, created_at=now - timedelta(days=days),
                      closed_at=now - timedelta(days=days - 1)))
    db.commit()


def seed() -> None:
    asyncio.run(_seed())


async def _seed() -> None:
    clock.set_offset(0)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    await asyncio.to_thread(meko.backend.reset)
    now = clock.now()
    with SessionLocal() as db:
        db.add(Setting(id=1, llm_base_url=config.LLM_BASE_URL, model=config.LLM_MODEL, llm_enabled=True,
                       meko_enabled=True, clock_offset_minutes=0))
        db.commit()
        _users(db)
        await _knowledge(db, now)
        _history(db, now)
        await _open_ticket(db, now, tid="T-074", title="Wi-Fi down on 2nd floor", cat="wifi", place="hostel-b",
                     minutes_ago=25, reporters=[f"S-{n}" for n in range(1101, 1115)], eta_in=95,
                     text="Wi-Fi not working on the 2nd floor of Hostel B, router lights off")
        await _open_ticket(db, now, tid="T-079", title="RO water dispenser very slow", cat="water", place="mess",
                     minutes_ago=300, reporters=[f"S-{n}" for n in range(1101, 1107)], eta_in=120,
                     text="RO water dispenser in the mess is very slow")
        await _open_ticket(db, now, tid="T-081", title="Geyser not heating in Hostel B", cat="electricity",
                     place="hostel-b", minutes_ago=120, reporters=["S-1107", "S-1108", "S-1109"], eta_in=60,
                     text="Geyser on 1st floor of Hostel B is not heating")
        log = meko.log_approval(db, "curator", "Proposed lesson: Slow RO water → replace the pre-filter before "
                                "the membrane.", target="warden", ticket_id="T-066", at=now - timedelta(hours=2),
                                **SIM)
        db.add(Approval(kind="lesson", proposed_by_agent="curator", status="pending", ticket_id="T-066",
                        meko_call_id=log.call_id, simulated=True, created_at=now - timedelta(hours=2),
                        payload={"lesson": "Slow RO water → replace the pre-filter before the membrane.",
                                 "category": "water", "place_id": "mess",
                                 "evidence": "5 resolved tickets in Mess and Hostel A"}))
        db.commit()
    print(f"Seeded: 3 open tickets (T-074, T-079, T-081), 1 pending lesson, Meko backend={config.MEKO_BACKEND}")


if __name__ == "__main__":
    seed()
