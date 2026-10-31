"""End-to-end checks of the four flows in the Full-Stack Flow doc, plus Meko OFF, redaction and the WebSocket.

LLM is pointed at a closed port so the rule-based fallbacks run (deterministic, no Ollama needed).
"""

import os
import tempfile
from datetime import datetime, timedelta

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["MEKO_LOCAL_PATH"] = f"{_tmp}/meko.db"
os.environ["MEKO_BACKEND"] = "local"
os.environ["LLM_BASE_URL"] = "http://127.0.0.1:9/v1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture()
def client():
    seed()
    with TestClient(app) as c:
        yield c


def calls(c, **kw):
    return c.get("/meko/calls", params=kw).json()


def test_flow1_grievance_merges_and_shows_eta(client):
    p = client.post("/grievances/preview", json={"text": "Wifi is dead on 2nd floor, Hostel B", "place_id": "hostel-b"})
    assert p.json()["similar"]["ticket_id"] == "T-074"
    assert p.json()["similar"]["report_count"] == 14

    r = client.post("/grievances", json={"user_id": "S-1042", "text": "Wi-Fi dead on 2nd floor, Hostel B",
                                         "place_id": "hostel-b"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["merged"] and body["ticket"]["id"] == "T-074" and body["ticket"]["report_count"] == 15

    t = client.get("/tickets/T-074").json()
    merge = [e for e in t["events"] if e["action"].startswith("Merged into")][-1]
    assert merge["actor_type"] == "agent" and merge["meko"]["op"] == "recall" and merge["meko"]["recalled"]
    suggestion = [e for e in t["events"] if e["action"].startswith("Suggested")][0]
    assert "PSU" in suggestion["action"] and suggestion["meko"]["call_id"].startswith("rc_")
    assert t["ticket"]["eta"]

    live = [c for c in calls(client)["calls"] if not c["simulated"]]
    assert {c["op"] for c in live} >= {"recall", "write"}


def test_flow2_note_moves_eta_for_all_reporters(client):
    r = client.post("/tickets/T-074/notes", json={"user_id": "TECH-WIFI",
                                                  "text": "Router needs a new PSU, part arrives Thursday"})
    assert r.status_code == 201, r.text
    eta = datetime.fromisoformat(r.json()["eta"])
    assert eta.strftime("%A") == "Thursday"
    msgs = client.get("/messages").json()
    assert any("all 14 students" in m["text"] for m in msgs)
    note_call = [c for c in calls(client)["calls"] if c["actor"] == "technician" and c["op"] == "write"]
    assert note_call and note_call[-1]["datapack"] == "dept-wifi"


def test_flow3_power_cut_directive_holds_tickets(client):
    until = (datetime.now() + timedelta(hours=2)).strftime("%H:%M")
    r = client.post("/events/directive", json={"department": "electricity", "hostel": "hostel-b",
                                               "message": f"Power cut in Hostel B until {until}",
                                               "valid_to": until, "user_id": "TECH-ELEC"})
    assert r.status_code == 201, r.text
    assert set(r.json()["held_tickets"]) == {"T-074", "T-081"}
    t = client.get("/tickets/T-081").json()["ticket"]
    assert "power cut" in t["eta_reason"]
    assert any(m["kind"] == "directive" for m in client.get("/messages").json())


def test_flow4_lesson_changes_a_later_case(client):
    case1 = client.post("/grievances", json={"user_id": "S-1038", "place_id": "hostel-a",
                                             "text": "Geyser keeps tripping in room 214"}).json()["ticket"]
    assert not case1["suggestion"] or "breaker" not in case1["suggestion"]
    client.post(f"/tickets/{case1['id']}/decision", json={"user_id": "TECH-ELEC", "action": "accept"})
    closed = client.post(f"/tickets/{case1['id']}/decision",
                         json={"user_id": "TECH-ELEC", "action": "close",
                               "note": "16A breaker was tripping, replaced the breaker"})
    assert closed.json()["status"] == "resolved"

    pending = [a for a in client.get("/approvals").json() if a["ticket_id"] == case1["id"]]
    assert len(pending) == 1 and "breaker" in pending[0]["payload"]["lesson"]
    ok = client.post(f"/approvals/{pending[0]['id']}", json={"user_id": "WARDEN-1", "decision": "approve",
                                                            "edited_text": "Geyser trips → check the 16A breaker first"})
    assert ok.json()["status"] == "approved"
    assert calls(client)["counters"]["promotions"] >= 1

    client.post("/settings/fast-forward", json={"minutes": 3 * 24 * 60})
    case2 = client.post("/grievances", json={"user_id": "S-1077", "place_id": "hostel-b",
                                             "text": "Geyser tripping again in my room"}).json()
    assert not case2["merged"], "T-081 is older than the merge window after fast-forward"
    assert "16A breaker" in case2["ticket"]["suggestion"]

    cmp = client.post("/compare", json={"text": "Geyser tripping again in my room", "place_id": "hostel-b"}).json()
    assert "breaker" in cmp["on"]["suggestion"] and cmp["on"]["expected_visits"] == 1
    assert cmp["off"]["suggestion"] is None and cmp["off"]["expected_visits"] == 2


def test_meko_off_really_means_off(client):
    client.post("/settings", json={"meko_enabled": False})
    r = client.post("/grievances", json={"user_id": "S-1042", "text": "Wi-Fi dead on 2nd floor",
                                         "place_id": "hostel-b"}).json()
    assert not r["merged"] and r["ticket"]["id"] != "T-074" and r["ticket"]["suggestion"] is None
    live = [c for c in calls(client)["calls"] if not c["simulated"] and c["op"] != "approval"]
    assert live and all(c["skipped"] for c in live)
    assert client.get("/dean/patterns").json()["patterns"] == []


def test_pii_is_redacted_before_meko(client):
    client.post("/grievances", json={"user_id": "S-1038", "place_id": "library",
                                     "text": "My name is Rahul Sharma, call 9876543210. Lights flickering"})
    summaries = " ".join(c["summary"] for c in calls(client)["calls"])
    assert "Rahul" not in summaries and "9876543210" not in summaries and "[NAME]" in summaries


def test_dean_sees_only_verified_patterns(client):
    p = client.get("/dean/patterns").json()["patterns"]
    assert len(p) == 4 and all(x["verified_by"] == "WARDEN-1" and x["series"] for x in p)


def test_role_checks(client):
    assert client.post("/approvals/1", json={"user_id": "S-1042", "decision": "approve"}).status_code == 403
    assert client.post("/tickets/T-074/notes", json={"user_id": "S-1042", "text": "hi"}).status_code == 403


def test_websocket_pushes_live_events(client):
    with client.websocket_connect("/ws/events") as ws:
        assert ws.receive_json()["type"] == "hello"
        client.post("/tickets/T-079/notes", json={"user_id": "TECH-WATER", "text": "Checking the pre-filter"})
        types = {ws.receive_json()["type"] for _ in range(2)}  # note write + timeline event
        assert "meko.call" in types and "ticket.updated" in types


def test_swarm_graph_and_counters(client):
    g = client.get("/swarm/graph").json()
    ids = {n["id"] for n in g["nodes"]}
    assert {"student", "technician", "warden", "dean", "desk", "wifi", "curator", "meko", "campus-kb"} <= ids
    assert set(g["counters"]) >= {"notes", "reads", "promotions", "directives", "approvals", "errors"}
