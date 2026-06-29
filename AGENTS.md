# FinishLine — AI Agent Rules
**Vibe2Ship Hackathon · Architecture Frozen: 25 June 2026**

> This document governs every AI agent, coding assistant, or LLM that works on this project.
> Read this before touching a single file.
> The architecture is frozen. Your job is to implement it — not redesign it.

---

## The Freeze Rule

Before building, adding, or suggesting anything new, answer these three questions honestly:

> **1. Does it significantly improve the demo?**
> **2. Can it realistically be implemented within the hackathon timeline?**
> **3. Does it strengthen the core value proposition rather than adding another feature?**

**All three must be YES. If any answer is NO — do not build it.**

### Examples

| Idea | Verdict | Reason |
|---|---|---|
| Better Weekly Planning quality | ✅ | Core feature, directly judge-facing |
| Smoother Renegotiation flow | ✅ | The killer feature — must be flawless |
| Better document understanding | ✅ | Improves core extraction pipeline |
| AI avatars | ❌ | Not demo-relevant, zero core value |
| AI-generated wallpapers | ❌ | Completely off-scope |
| Gamification badges | ❌ | Feature addition, not core value |
| Animated onboarding mascot | ❌ | Nice-to-have, wrong priority |
| Alternative dashboard themes | ❌ | Not judge-facing value |
| Social sharing of commitments | ❌ | Out of scope entirely |

**When in doubt, don't build it. The existing plan already covers everything needed to win.**

---

## Authoritative Documents

Read these before making any architectural decisions:

| Document | Purpose |
|---|---|
| [`plan_v2.1.md`](./plan_v2.1.md) | The final, frozen implementation plan. Source of truth for all decisions. |
| [`architecture_validation_v21.md`](./architecture_validation_v21.md) | Architecture validation report. Explains why every decision was made. |
| [`vibe2ship guidelines.docx`](./vibe2ship%20guidelines.docx) | Official hackathon rules and judging criteria. |

---

## Technology Stack — Locked

Do not propose alternatives. Do not introduce new dependencies without a strong reason.

| Layer | Decision |
|---|---|
| Frontend | Next.js 14 App Router |
| Styling | Tailwind CSS v3 + shadcn/ui + Framer Motion |
| State | Zustand (app state) + Jotai (atoms) |
| Database | Firebase Firestore |
| Auth | Firebase Auth + Google OAuth |
| Storage | Firebase Storage |
| Notifications | Firebase Cloud Messaging |
| AI Primary | Gemini 2.5 Flash via Google AI Studio |
| AI Fallback | Groq (Llama 3.3 70B) — silent failover only |
| Deployment | Firebase App Hosting → Cloud Run |
| Agent Loop | Vercel Cron Jobs |
| Real-time | Firestore `onSnapshot` |
| Voice | Web Speech API (browser-native) |

---

## AI Architecture Rules

These are non-negotiable. Every Gemini integration must follow them.

### Rule 1 — Understand Before Recommending
Reasoning endpoints must always receive `CoreLifeContext` or `ExtendedLifeContext` before invoking Gemini.
Extraction endpoints (text, file, voice, Gmail) receive **no context** — they are stateless NLP tasks.

### Rule 2 — Reason Using Context, Not Isolated Prompts
Gemini never receives a single commitment in isolation when making planning or scheduling recommendations.
It always sees the user's full current week, capacity, and competing commitments.

### Rule 3 — Explain Every Important Recommendation
Every reasoning endpoint returns `aiMeta.reasoning` — a plain-language explanation of the recommendation.
The `/api/ai/explain-risk` endpoint makes risk scores explainable on demand.

### Rule 4 — Express Confidence Transparently
Every reasoning response includes `aiMeta.confidence` (0.0–1.0) and `aiMeta.confidenceLabel`.
`applyConfidenceAwareness()` is called in every reasoning route handler.
Low-confidence results are **never silently discarded** — they are surfaced to the user with context.

### Rule 5 — Never Replace Deterministic Logic
If something can be computed deterministically, the backend computes it. Period.

| Task | Owner |
|---|---|
| Risk score calculation | Backend (`calculateRiskScore()`) |
| Probability calculation | Backend (`calculateProbability()`) |
| Calendar overlap detection | Backend |
| Notification scheduling | Backend |
| Streak counting | Backend |
| Stress score | Backend |
| Sorting / filtering | Backend |
| Firestore writes | Backend |
| Calendar writes | Backend |
| FCM dispatch | Backend |
| Risk score *explanation* | Gemini |
| Action plan generation | Gemini (with Core Context) |
| Renegotiation conversation | Gemini (with Core Context) |
| Weekly planning | Gemini (with Core + Extended Context) |
| Weekly reflection | Gemini (with Core + Extended Context) |
| Document / voice / email extraction | Gemini (no context) |

---

## Context Architecture Rules

### Context Tiers

| Tier | Used By | Contains |
|---|---|---|
| **None** | Extraction endpoints | Only the raw input (text, file, transcript) |
| **Core** | Action Plan, Risk Explanation, Renegotiation | Active commitments, calendar slots, stress score, capacity |
| **Core + Extended** | Weekly Planning, Weekly Reflection | Everything in Core + history, reflection, long-term goals |

### Forbidden Patterns

- ❌ Do NOT pass Extended Context to Action Plan or Risk Explanation endpoints
- ❌ Do NOT pass any Life Context to extraction endpoints
- ❌ Do NOT call Gemini inside the 30-minute agent cron loop
- ❌ Do NOT let Gemini write directly to Firestore
- ❌ Do NOT use Gemini Function Calling for orchestration
- ❌ Do NOT use Gemini to re-compute the risk score (only to explain it)
- ❌ Do NOT use `JSON.parse()` without `responseSchema` enforcement
- ❌ Do NOT hardcode API keys anywhere

### Required Patterns

- ✅ All Gemini calls go through `callGemini()` in `lib/ai/gemini.ts`
- ✅ All reasoning calls use `endpointType` to set temperature automatically
- ✅ All reasoning responses go through `applyConfidenceAwareness()` before returning to client
- ✅ All context assembly goes through `ensureFreshContext()` before invoking Gemini
- ✅ All Gemini schemas use Zod definitions in `lib/ai/schemas/`
- ✅ All prompts use builder functions in `lib/ai/prompts/`

---

## Temperature Map — Do Not Override Without Reason

| Endpoint Type | Temperature |
|---|---|
| `extraction` | 0.1 |
| `explanation` | 0.2 |
| `action-plan` | 0.4 |
| `weekly-planning` | 0.5 |
| `renegotiation` | 0.6 |
| `weekly-reflection` | 0.6 |

---

## Gemini Call Budget

The agent cron loop has **zero Gemini calls**. Every Gemini call is user-initiated.

| Endpoint | When Called | Approximate Tokens |
|---|---|---|
| extract-text / voice | Per commitment added | ~200 |
| extract-file | Per upload | ~300 + file |
| gmail scan | On demand | ~400/email |
| generate-action-plan | Per new commitment | ~2,500 |
| explain-risk | User taps "Why?" | ~800 |
| renegotiate (per turn) | During renegotiation | ~3,000 |
| weekly-planning | Once per week | ~7,000 |
| weekly-reflection | Once per week | ~6,000 |

---

## Implementation Priorities

### Must complete before anything else

1. `lib/ai/gemini.ts` — `callGemini()` wrapper with temperature map and schema enforcement
2. `lib/ai/context.ts` — `assembleCoreContext()` and `assembleExtendedContext()`
3. `lib/ai/freshness.ts` — `ensureFreshContext()` with staleness thresholds
4. `lib/ai/confidence.ts` — `applyConfidenceAwareness()`
5. All Zod schemas in `lib/ai/schemas/`
6. Firebase Auth + Google OAuth with Calendar + Gmail scopes
7. Firestore security rules

### Feature priority order (if time runs short, cut from the bottom)

1. Commitment extraction — text, voice, file, Gmail
2. Action plan generation
3. Agent loop — risk, collision, check-in
4. Renegotiation engine
5. Dashboard — stress gauge, priority stack
6. Dynamic replanning (`replan-on-add`)
7. Weekly Planning AI endpoint
8. Calendar integration
9. Weekly Reflection AI endpoint
10. Risk explanation ("Why?")
11. Life Balance Radar
12. Commitment Memory resurface
13. Focus Mode (Pomodoro)

---

## Demo Scenarios — Must Work Flawlessly

These specific scenarios will be demonstrated to judges. They must work on demo day.

### Scenario 1 — The Amazon OA Week (Core Demo)
- Priya has: OS Assignment (Friday), Birthday Party (Wednesday), Club Meeting (Thursday)
- She uploads an Amazon OA invitation PDF
- FinishLine extracts: 6h preparation, Thursday deadline
- Detects collision with OS Assignment work block
- Reallocates: OA prep → Tuesday evening + Wednesday morning
- OS Assignment risk jumps Medium → High
- Dashboard updates live via Firestore `onSnapshot`
- Collision banner appears with Framer Motion animation

### Scenario 2 — Renegotiation (Killer Feature)
- Check-in fires for a high-risk commitment
- User responds "Got busy"
- Renegotiation chat opens with empathy + Core Context
- Gemini proposes realistic new schedule that avoids other commitments
- User confirms → Calendar rewrites → Risk recalculates

### Scenario 3 — Gmail Extraction
- Recruiter email with interview deadline
- Gmail scanner extracts commitment automatically
- User approves → commitment added → replanning fires

### Scenario 4 — Hinglish Input
- User types: "kal submission hai yaar"
- Gemini extracts: title, deadline (tomorrow), domain (academic), effort estimate
- Verified working before demo day

---

## What NOT to Do

If you are an AI agent working on this project, the following are explicitly forbidden:

- **Do not redesign the architecture.** It is frozen. Read `plan_v2.1.md`.
- **Do not introduce new AI libraries** (LangChain, LangGraph, Pydantic AI, etc.) — the `callGemini()` wrapper is sufficient.
- **Do not propose vector databases** — Firestore handles everything needed.
- **Do not propose microservices** — Next.js Route Handlers are the entire backend.
- **Do not propose Gemini Function Calling** for orchestration — the backend orchestrates.
- **Do not add features that don't appear in the Freeze Rule test.**
- **Do not skip the Groq fallback** in `callGemini()` — it is the demo reliability net.
- **Do not write API keys or tokens into source files.**
- **Do not use `any` TypeScript types** — schemas are defined in `lib/ai/schemas/`.
- **Do not make Gemini calls in the agent cron loop.**
- **Do not use `JSON.parse()` without `responseSchema`** in Gemini route handlers.

---

## Definition of Done (per feature)

A feature is complete only when:

- [ ] Route handler implemented and returns correct schema
- [ ] Zod schema validates response
- [ ] Gemini fallback to Groq confirmed working
- [ ] Firestore write (if any) goes through backend, not Gemini
- [ ] Responsive on mobile (< 640px) and desktop (> 1280px)
- [ ] Dark mode and light mode verified
- [ ] Framer Motion animation present on state change
- [ ] Tested in the demo scenario context
- [ ] No hardcoded API keys or user IDs

---

## Hackathon Submission Checklist

- [ ] Firebase App Hosting URL live and publicly accessible
- [ ] GitHub repository public with complete README
- [ ] README contains: what FinishLine does, demo video link, Mermaid architecture diagram, local setup, Google technologies used
- [ ] Google Doc with all 5 required sections + business model
- [ ] Demo account (Priya) pre-seeded with OS Assignment + Birthday + Club Meeting
- [ ] Amazon OA PDF ready to upload during demo
- [ ] Agent cron confirmed firing every 30 min
- [ ] Renegotiation check-in pre-staged to fire during demo
- [ ] Hinglish input tested: "kal submission hai yaar"
- [ ] Demo rehearsed minimum 5 times, timed at under 3 minutes
- [ ] Submitted via BlockseBlock by 1:30 PM on 30 June 2026

---

*This document is the law of this project. When in doubt, read `plan_v2.1.md`.*
*Architecture frozen: 25 June 2026.*
