# Sahayak — 5-minute demo script

**Do** = what to click. **Say** = what to tell the judges. **Behind it** = what the system is doing, in case
they ask.

## Before you start

- `make seed`, then `make run` and `make web` in two terminals.
- Open two browser tabs: **Tab A** at `localhost:3000` (you click here) and **Tab B** at `localhost:3000/swarm`
  (put it on the second screen if you have one, so the board animates while you work).
- Sign in on Tab A with the **S-1042** demo button. You switch people with the **account menu** (your name,
  top right): it lists every demo account, one click each. Tab B can stay signed in as anyone.
- Check the top bar says **Live** (green) and **Meko ON**.
- On real Meko (`MEKO_BACKEND=real`), each recall takes about 8 s, so submitting a report takes about 20 s.
  Fill the pause by pointing at Tab B: the board lights up as each Meko call lands. Keep the Meko dashboard
  open in a third tab to show the memories arriving in `gs-dept-wifi` and the other datapacks.
- Pick a power-cut end time about 1–2 hours from now (e.g. if it's 20:10, use 22:00).

---

## 0:00 — The problem (20 seconds)

**Say:** "This is Sahayak, which means helper. On campus, the same broken router gets reported 15 times, nobody tells students why it's late, and
when a technician finds the fix, that knowledge leaves with them. We built a swarm of AI agents with a shared
memory, Meko, where agents route and remember, and people make every decision that matters."

---

## 0:20 — A student reports a problem (Flow 1)

**Do:** Tab A, signed in as **S-1042**, page **Report a problem**. Type
`Wi-Fi is dead on the 2nd floor of Hostel B since evening`. Location: **Hostel B**.

**Say:** "The student writes in their own words. No forms, no categories."

**Do:** Wait a second. Point at the orange banner.

**Say:** "Before they even submit, the Desk agent has checked memory: 14 others reported the same thing, so
this becomes one ticket, not fifteen."

> **Behind it:** the Desk agent sorts the text into a category (Wi-Fi), then does a Meko **recall** on the
> `desk` datapack for open tickets at the same place and category. Students only ever appear as pseudonyms
> (S-1042); names and phone numbers are stripped before anything reaches Meko.

**Do:** Click **Submit report**. You land on ticket **T-074**.

**Say:** "They're merged into T-074. They see who acted, what happened and why, and an ETA with a reason. That ETA was set by the Warden: for a brand-new ticket the agent only *proposes* a time, because only the Warden sees every open job and can keep 25 promises from clashing."

**Do:** Click a **Meko context** chip in the timeline.

**Say:** "Every agent step shows exactly what it pulled from memory and the call ID. The UI never invents
context. If Meko didn't return it, it isn't shown."

---

## 1:00 — Hand-offs both ways (Flow 2)

**Do:** Account menu → **Technician · Wi-Fi**. The queue shows T-074 with an orange agent line.

**Say:** "Agent to person: the Wi-Fi agent remembered that this same router failed in March and the cause was
the power supply, so the technician checks that first."

**Do:** In the side panel, type `Router needs a new PSU, part arrives Thursday` and click **Save note**.

**Say:** "Person to agent: the technician writes one note. The agent reads it, moves the ETA to Thursday, and
tells all 15 students. Nobody had to send 15 messages."

> **Behind it:** the note is a Meko **write** to `dept-wifi`; the Wi-Fi agent pulls the date out of the note
> and updates the ETA. The student's ticket page updates live over the WebSocket, with no refresh.

**Tip:** if you have time, switch to **Student → My ticket** to show the ETA now says **Thu 18:00**.

---

## 2:00 — Cross-department message (Flow 3)

**Do:** Click the **gear icon** (Demo settings). Under **Power-cut directive**, set Hostel B, the message
`Power cut in Hostel B until 22:00` and the time from your prep. Click **Post directive**.

**Say:** "Electricity announces a power cut. Every department agent reads it from memory. The geyser ticket in
Hostel B is put on hold automatically, and students see why: 'Delayed because of a power cut until 22:00'."

> **Behind it:** one Meko **directive** is written into every department's datapack. Each agent recalls it
> and pushes back any open ticket in that hostel that can't be fixed without power (shown under "Held").

**Do:** Glance at Tab B: an orange **directive** edge, and "electricity → technician" at the top of the stream.

---

## 2:45 — A lesson changes a later case (Flow 4, the key moment)

**Case 1, Hostel A:**

1. Account menu → **S-1038**, location **Hostel A**: `Geyser keeps tripping in room 214` → Submit.
2. Account menu → **Technician · Electricity**, open the new ticket. Note:
   `16A breaker was tripping, replaced the breaker` → **Close**.

**Say:** "The technician closes it with what they actually did. The Curator agent turns that into a lesson,
but it does **not** go into campus memory on its own."

3. Account menu → **Warden**, then **Approvals**. Click **Approve** on the new lesson.

**Say:** "Only a person can promote knowledge. The Warden approves, and it slides into Campus Knowledge."

> **Behind it:** the Curator proposes the lesson. The Warden's approval triggers a Meko **promote** into the
> shared `campus-kb`, which every agent reads. On the swarm board that's the glowing edge into Campus KB.

**Case 2, days later, different hostel:**

4. Gear icon → **Demo clock → +3 days**.
5. Account menu → **S-1077**, location **Hostel B**: `Geyser tripping again in my room` → Submit.

**Say:** "Three days later, a different student in a different hostel. The Electricity agent recalls the
approved lesson and tells the technician to check the 16A breaker first. That's one visit instead of two."

---

## 3:45 — Meko ON vs OFF

**Do:** Tab **Meko ON vs OFF** (Technician, Warden or Dean). Click **Run both**, then flip the **Meko**
toggle.

**Say:** "Same complaint, same agents. With memory: a known fix and one visit. Without it: generic routing, no
suggestion, the technician starts from scratch. Meko OFF really means off: the calls are skipped and logged
as skipped, not quietly faked."

> **Behind it:** both columns are real calls through the same adapter. The visit counts are an expected
> outcome (1 if a known fix was found, 2 if not); the second number is the real average from past tickets.

---

## 4:15 — The swarm board

**Do:** Click **Swarm**. Press **Play** on the replay slider.

**Say:** "Everything you just saw, replayed from the log. Every person and agent is a node, MEKO is the hub.
Solid is a write, dashed is a recall, orange is a directive, and the glow into Campus KB is a promotion. The
counters and the message stream are built only from logged Meko calls, nothing is hard-coded. Anything we
scripted for the demo carries an orange SIMULATED badge."

**Do:** Click any agent node to show what it holds.

---

## 4:45 — Close (15 seconds)

**Say:** "Agents merge, route and remember. People decide. Every bit of context is traceable to a memory call,
and the campus gets smarter every time something is fixed."

---

## If judges ask

| Question | Answer |
|---|---|
| Is this real Meko? | With `MEKO_BACKEND=real`, yes: every write is a Meko `memory_add` and every recall a `memory_search` over its MCP server, into datapacks `gs-desk`, `gs-dept-wifi`… that you can open in the Meko dashboard. Labels like "open/closed" live in a small local index, because Meko's search can't filter on them. *(If you demo on `local`, say it's the offline stand-in.)* |
| What's the AI model? | Any OpenAI-compatible model, Qwen3 8B on Ollama by default. If no model is reachable it falls back to rules, so the demo never stalls. |
| Can an agent close a ticket or escalate on its own? | No. Closing, approving lessons and verifying patterns are always done by a person. |
| Privacy? | Students are pseudonyms; names, phone numbers, emails and roll numbers are stripped before Meko or any prompt. |
| What's SIMULATED? | Seeded history (the March router fix, the first 14 reports) is labelled so judges know what was scripted vs. live. |
| What does the Dean see? | **Dean → Patterns:** only patterns a Warden verified, with trends, e.g. "RO filters fail every ~40 days." |

## Feature reference

| Screen | What it does |
|---|---|
| Sign in / Sign up | Students: email, password, hostel → pseudonym. Staff: name, role, staff code. Demo accounts one click |
| Top bar | Account menu (switch demo account, sign out), Meko ON/OFF, Swarm button, Live indicator, demo settings |
| Report a problem | Free-text complaint, location, optional photo; live duplicate check before submit |
| My ticket | Status steps, ETA with reason, timeline with Person/Agent badges and Meko context chips; updates live |
| Queue | Technician's or Warden's open tickets with agent suggestions; Accept, Override (needs a reason), Close, Save note |
| Approvals | Curator's proposed lessons; Approve promotes to Campus Knowledge, Reject discards |
| Patterns | Dean's view of Warden-verified recurring issues with sparklines |
| Swarm board | Live graph of every Meko call, six counters, message stream, replay slider, node "holds" panel |
| Meko ON vs OFF | Same complaint run both ways side by side |
| Demo settings | Meko switch, power-cut directive, fast-forward clock, LLM endpoint |

**Reset between rehearsals:** stop the backend, run `make seed`, and start it again. The clock offset resets too.
