# Sahayak

*Sahayak* (सहायक) means "helper". It's a campus grievance swarm.

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

One WebSocket (`lib/ws.ts`) feeds every page; nothing polls. Styling is Tailwind matching the Figma file;
shadcn/ui wasn't used.

## Accounts

`/signin` and `/signup` are the only pages you can open signed out.

- **Students** sign up with email, password and hostel. They get a pseudonym (`S-1201`, `S-1202`…), and
  that is all anyone else sees; the email is only for signing in.
- **Staff** sign up with a name, a role (technician + department, warden or dean) and the staff code
  (`STAFF_SIGNUP_CODE`, default `campus-staff`). Without the code, anyone could make themselves Dean.
  **Change it** on any shared deployment.
- **Demo accounts:** `make seed` creates `s-1042@demo.campus`, `tech-wifi@demo.campus`, `warden-1@demo.campus`
  and the rest, all with password `demo1234` (`DEMO_PASSWORD`). The sign-in page and the account menu list
  them for one-click switching. Turn that off with `DEMO_ACCOUNTS=false`.

Passwords are salted PBKDF2-SHA256 (Python standard library). Sessions are random tokens; the server stores
only their SHA-256 and drops them after 7 days or on sign-out. Reseeding wipes accounts, so the browser
sends you back to sign-in.

Optional: `ollama pull qwen3:8b` before the event. With no model reachable, classification, ETA
extraction and lesson wording fall back to rules, so the demo still runs.

## Real Meko

`MEKO_BACKEND=local` (default) uses `LocalMeko`, a keyword-recall stand-in in its own SQLite file. **It is
not Meko**, but it is instant and works offline.

`MEKO_BACKEND=real` plus `MEKO_API_KEY` (Meko portal → Settings → API Keys) uses `RealMeko`, which talks to
[Meko's MCP server](https://docs.mekodata.ai/reference/mcp-server/):

- Each demo datapack becomes a Meko datapack (`gs-desk`, `gs-dept-wifi`, … `gs-campus-kb`), created on
  first use. That is 6 of the Free plan's 10.
- Every write, share and directive is a `memory_add`. When the Warden approves a lesson, it is saved and then
  **promoted** (`memory_promote`) into `gs-campus-kb`'s shared knowledge base, Meko's collective memory, so it
  appears under Collective Memory in the Meko dashboard. Seeded demo lessons are not promoted, so re-seeding
  doesn't keep adding copies.
- Every recall runs `memory_search` and `knowledgebase_search` in parallel, because promoted memories leave
  the private store.
  Results are Meko's, ranked by Meko's semantic score; anything under `MEKO_MIN_SCORE` (0.35) is treated
  as unrelated.
- Meko's search can't filter by metadata and `memory_update` only replaces text, so a local index
  (`backend/meko_index.db`) keeps each memory's labels (kind, status, place). Recall hits are joined to it
  by Meko memory id; listings with an empty query, such as the Dean's patterns, are answered from it.

Check the connection with `cd backend && .venv/bin/python -m app.meko_check`. Run the four flows against
real Meko with `TEST_MEKO_BACKEND=real .venv/bin/python -m pytest -k flow` (about 6 minutes).

**Speed:** a Meko search takes about 8 s, and a write about 1–2 s. Calls run in a worker thread, so the
board and other tabs stay live, but submitting a complaint takes about 20 s and `make seed` about a
minute. Rehearse with real Meko so the pauses don't surprise you, or demo on `local` and show the Meko
dashboard separately.

## API

Every route except `/auth/*`, `/health` and `/places` needs `Authorization: Bearer <token>` from sign-in or
sign-up; the WebSocket takes it as `?token=`. Who you are comes only from the token, never from the body.

| Method + path | Does |
|---|---|
| `POST /auth/signup` | Student (email, password, hostel → pseudonym `S-1201`…) or staff (name, role, department, `STAFF_SIGNUP_CODE`) |
| `POST /auth/signin` · `POST /auth/signout` · `GET /auth/me` | Session token in, out, and who it belongs to |
| `GET /auth/demo-accounts` | Seeded `<id>@demo.campus` accounts for the one-click buttons (off with `DEMO_ACCOUNTS=false`) |
| `POST /grievances/preview` | Banner: “14 others reported a similar issue…” |
| `POST /grievances` | Desk agent: merge or create, route, suggest a fix, set the ETA |
| `GET /tickets/{id}` | Ticket + timeline; each event carries its Meko call (`meko.recalled` for ContextChip) |
| `GET /students/{id}/tickets` | A student's tickets |
| `GET /staff/queue?role=` | Open tickets with agent suggestion + call ID (a technician sees their own) |
| `POST /tickets/{id}/eta` | Warden confirms or changes the ETA. New tickets only get an agent *proposal* (`eta_confirmed: false`), which students don't see as a time |
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
signin() { curl -s localhost:8000/auth/signin -H 'content-type: application/json' \
  -d "{\"email\":\"$1@demo.campus\",\"password\":\"demo1234\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'; }
STUDENT=$(signin s-1042); TECH=$(signin tech-wifi); ELEC=$(signin tech-elec)
# 0:00 Student reports Wi-Fi → merged into T-074, ETA + reason
curl -s localhost:8000/grievances -H "authorization: Bearer $STUDENT" -H 'content-type: application/json' \
  -d '{"place_id":"hostel-b","text":"Wi-Fi dead on 2nd floor, Hostel B"}'
# 1:00 Technician note → ETA moves for all reporters
curl -s localhost:8000/tickets/T-074/notes -H "authorization: Bearer $TECH" -H 'content-type: application/json' \
  -d '{"text":"Router needs a new PSU, part arrives Thursday"}'
# 2:00 Power-cut directive → geyser ticket T-081 held
curl -s localhost:8000/events/directive -H "authorization: Bearer $ELEC" -H 'content-type: application/json' \
  -d '{"department":"electricity","hostel":"hostel-b","message":"Power cut in Hostel B until 22:00","valid_to":"22:00"}'
# 3:00 Close a geyser case, approve the lesson, fast-forward, new case gets the fix
#      (see tests/test_flows.py::test_flow4_lesson_changes_a_later_case for the exact calls)
```

## Layout

```
backend/app/
  main.py            app, CORS, routers (all but /auth need a session)
  auth.py            passwords, session tokens, current_user
  meko_client.py     the adapter: redact → call → log → emit
  meko_backends.py   LocalMeko stand-in + RealMeko (Meko MCP server)
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
