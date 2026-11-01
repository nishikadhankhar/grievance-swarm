# Campus Grievance Swarm

Hackathon demo. Students report problems, Meko-backed agents merge, route and remember them, and staff
make every decision that matters. FastAPI backend + Next.js 14 frontend. UI designs:
[Figma](https://www.figma.com/design/7X99ZTs42a8czcNiHtiTrN).

## Run

```bash
make install   # Python venv + npm packages (Python 3.11+, Node 18+)
cp .env.example .env
make seed      # resets both stores, loads T-074 / T-079 / T-081 and history (flagged simulated)
make run       # API on http://localhost:8000 (docs at /docs)
make web       # in a second terminal: app on http://localhost:3000
make test      # the four end-to-end flows + Meko OFF, redaction, WebSocket
```

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`; see
`frontend/.env.local.example`). The backend allows `CORS_ORIGINS=http://localhost:3000` by default.

## Deploy on Render

`render.yaml` defines both services (free plan). Open
<https://dashboard.render.com/blueprint/new?repo=https://github.com/nishikadhankhar/grievance-swarm>,
connect the repo and apply. The API reseeds on every start, since the free instance's disk is wiped on
restart. If Render gives the API a URL other than `https://grievance-swarm-api.onrender.com`, set
`NEXT_PUBLIC_API_URL` on the web service to that URL and redeploy it.

## Frontend

| Route | Role | What it does |
|---|---|---|
| `/student/new` | Student | Free text, location, optional photo; live “14 others reported…” banner from the Desk agent |
| `/student/tickets/[id]` | Student | Status, ETA card, live timeline; Meko context chips show the raw recall + call ID |
| `/staff/queue` | Technician, Warden | Queue with agent suggestions; side panel: note, Accept / Override / Close |
| `/staff/tickets/[id]` | Technician, Warden | Same panel, full page |
| `/staff/approvals` | Warden | Curator proposals; approved lessons slide into Campus Knowledge |
| `/dean` | Dean | Verified patterns with sparklines (read from Meko only) |
| `/swarm` | Everyone | React Flow graph animated per Meko call, counters, message stream, replay slider |
| `/compare` | Demo | Same grievance with Meko ON vs OFF; the top-bar toggle switches which side is live |
| `/settings` | Demo | Meko on/off, power-cut directive, fast-forward clock, LLM endpoint |

One WebSocket (`lib/ws.ts`) feeds every page; nothing polls. Role switching is a demo picker stored in the
browser (no auth). Styling is Tailwind matching the Figma file; shadcn/ui wasn't used.

Optional: `ollama pull qwen3:8b` before the event. With no model reachable, classification, ETA
extraction and lesson wording fall back to rules, so the demo still runs.

## Before the demo: plug in real Meko

`MEKO_BACKEND=local` uses `LocalMeko`, a keyword-recall stand-in in its own SQLite file. **It is not Meko.**
To use the real SDK, fill in the four methods of `RealMeko` in `backend/app/meko_backends.py` from the
`meko_langchain` file, then set `MEKO_BACKEND=real` and `MEKO_API_KEY`. Nothing else changes: agents only
talk to the adapter in `meko_client.py`, which redacts, calls, logs to `meko_calls` and emits `meko.call`.

Still open from the flow doc: confirm the Meko operation names (write / recall / share / promote /
directive / approval) against the Meko docs.

## API

Demo role switching sends a `user_id` (`S-1042`, `TECH-WIFI`, `TECH-ELEC`, `TECH-WATER`, `WARDEN-1`,
`DEAN-1`); `GET /users` lists them. There is no real auth.

| Method + path | Does |
|---|---|
| `POST /grievances/preview` | Banner: “14 others reported a similar issue…” |
| `POST /grievances` | Desk agent: merge or create, route, suggest a fix, set the ETA |
| `GET /tickets/{id}` | Ticket + timeline; each event carries its Meko call (`meko.recalled` for ContextChip) |
| `GET /students/{id}/tickets` | A student's tickets |
| `GET /staff/queue?role=&user_id=` | Open tickets with agent suggestion + call ID |
| `POST /tickets/{id}/notes` | Staff note → written to Meko → agent updates ETA for all reporters |
| `POST /tickets/{id}/decision` | `accept` / `override` (needs note) / `close` → Curator proposes a lesson |
| `GET /approvals` · `POST /approvals/{id}` | Warden approves (→ promote to campus-kb) or rejects |
| `POST /events/directive` | e.g. power cut until 22:00 → holds affected tickets |
| `GET /meko/calls?from=&to=` | Call log + counters for the swarm board and replay |
| `GET /swarm/graph` | Nodes with their “holds” panels, plus counters |
| `GET /messages` | Message stream, newest first |
| `GET /dean/patterns` · `POST /dean/patterns/scan` | Verified patterns; pattern agent tick |
| `POST /compare` | Same grievance with Meko ON vs OFF (OFF is a real, skipped call) |
| `GET/POST /settings` · `POST /settings/fast-forward` | LLM, Meko on/off, demo clock |
| `WS /ws/events` | `ticket.updated`, `meko.call`, `message`, `approval.*`, `settings.updated` |

## Demo script against the API

```bash
# 0:00 Student reports Wi-Fi → merged into T-074, ETA + reason
curl -s localhost:8000/grievances -H 'content-type: application/json' \
  -d '{"user_id":"S-1042","place_id":"hostel-b","text":"Wi-Fi dead on 2nd floor, Hostel B"}'
# 1:00 Technician note → ETA moves for all reporters
curl -s localhost:8000/tickets/T-074/notes -H 'content-type: application/json' \
  -d '{"user_id":"TECH-WIFI","text":"Router needs a new PSU, part arrives Thursday"}'
# 2:00 Power-cut directive → geyser ticket T-081 held
curl -s localhost:8000/events/directive -H 'content-type: application/json' \
  -d '{"department":"electricity","hostel":"hostel-b","message":"Power cut in Hostel B until 22:00","valid_to":"22:00"}'
# 3:00 Close a geyser case, approve the lesson, fast-forward, new case gets the fix
#      (see tests/test_flows.py::test_flow4_lesson_changes_a_later_case for the exact calls)
```

## Layout

```
backend/app/
  main.py            app, CORS, routers
  meko_client.py     the adapter: redact → call → log → emit
  meko_backends.py   LocalMeko stand-in + RealMeko slot
  agents/            desk.py, department.py, curator.py, pattern.py
  api/               one router per area, ws.py for /ws/events
  llm.py             OpenAI-compatible client with rule fallbacks
  redact.py          PII stripping before Meko or prompts
  seed.py            demo data, all flagged simulated

frontend/
  app/               one folder per route above
  components/        TopBar, RoleProvider, ticket (timeline, ContextChip, ETA), TicketPanel, SwarmGraph, ui
  lib/               api.ts, ws.ts (shared WebSocket), types.ts, format.ts
```

Not done here: Docker Compose (Docker isn't installed on this machine).
