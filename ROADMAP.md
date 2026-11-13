# CareerBridge — Product Roadmap

> Goal: turn CareerBridge from a working prototype into a complete, real-world internship & job portal —
> with a proper recruiter hiring system (ATS / "CRM"), AI- and ML-powered matching, jobs pulled in from
> third-party job boards, and enough polish to pitch it.

_Last updated: 13 November 2026_

---

## Table of contents

1. [Where we are today](#1-where-we-are-today)
2. [Why it still feels incomplete](#2-why-it-still-feels-incomplete)
3. [The plan at a glance](#3-the-plan-at-a-glance)
4. [Phase 0 — Lock it down](#phase-0--lock-it-down-12-days)
5. [Phase 1 — Real recruiter hiring system (ATS / CRM)](#phase-1--real-recruiter-hiring-system-ats--crm-23-weeks)
6. [Phase 2 — Complete student & university product](#phase-2--complete-student--university-product-2-weeks)
7. [Phase 3 — AI & machine learning](#phase-3--ai--machine-learning-3-weeks)
8. [Phase 4 — Third-party job integration](#phase-4--third-party-job-integration-12-weeks)
9. [Phase 5 — Pitch-ready](#phase-5--pitch-ready-1-week)
10. [Order, timeline & team split](#10-order-timeline--team-split)
11. [Hosting & cost notes](#11-hosting--cost-notes)
12. [How we work](#12-how-we-work)
13. [Pending setup checklist](#13-pending-setup-checklist)

---

## 1. Where we are today

**Stack:** Django + Django REST Framework + SimpleJWT (backend, hosted on Render) · Next.js + Tailwind + shadcn/ui (frontend, hosted on Vercel) · SQLite locally, PostgreSQL in production.

### Already built

| Area | What exists |
|---|---|
| **Accounts** | 3 roles — student, company, university (+ admin) · JWT login |
| **Sign-up security** | Email OTP verification (6-digit code, 10-min expiry, 5 attempts, 60 s resend cooldown, hashed codes, per-IP throttle) |
| **Password reset** | 3 steps: email → code → new password, then auto sign-in |
| **Google sign-in** | Popup account picker, token verified server-side against our client ID |
| **Profile completion** | Google sign-ups must pick role, gender, name, username before using the app (email locked) |
| **Student profile** | Degree, branch, CGPA, graduation year, bio, links, resume upload, experience, certifications, achievements, skills with proficiency |
| **Companies & universities** | Company model (verified flag, industry, size, logo) · company membership · university model |
| **Internships** | Companies post internships (stipend, duration, openings, deadline, work mode, required skills); students browse & apply |
| **Applications** | Status flow: Applied → Under Review → Shortlisted → Selected / Rejected · recruiter notes · withdraw |
| **Matching** | Skill-overlap match score per internship |
| **Dashboards** | Student, company, university, admin analytics endpoints + pages |
| **Design** | Polished landing page (motion, scroll story), redesigned auth pages, responsive cards |

### Key files

- Backend apps: `accounts/`, `institutions/`, `internships/`, `applications/`, `analytics/`
- Frontend: `careerbridge-frontend/src/app/` (pages), `src/components/` (UI), `src/lib/api.ts` (API client)

---

## 2. Why it still feels incomplete

1. **Notifications are fake** — a hard-coded list in `src/components/notifications.tsx`, not real events.
2. **The recruiter side is thin** — a list of applicants with a status dropdown. Real ATS tools have pipelines, interview scheduling, notes, ratings, emails, offers.
3. **Matching is basic** — it only counts skill overlap. That isn't AI, and reviewers will notice.
4. **The university role barely does anything** — one dashboard page.
5. **Missing everyday features** — no messaging, no search filters, no saved jobs, no job alerts.
6. **Lots of uncommitted work** — the last several sessions of work are not in git yet.

---

## 3. The plan at a glance

| Phase | Theme | Duration | Outcome you can demo |
|---|---|---|---|
| **0** | Lock it down | 1–2 days | Everything committed, emails working, demo data, CI |
| **1** | Recruiter hiring system (ATS) | 2–3 weeks | Drag-and-drop pipeline, interviews, offers |
| **2** | Student & university product | 2 weeks | Real notifications, search, alerts, placement cell, messaging |
| **3** | AI & ML | 3 weeks | Semantic matching with explanations, resume parsing, skill-gap advice |
| **4** | Third-party jobs | 1–2 weeks | Jobs from Adzuna / Jooble / Remotive, AI-ranked |
| **5** | Pitch-ready | 1 week | Polished demo, metrics, architecture diagram |

**Recommended order:** 0 → 1 → 3 → 2 → 4 → 5
(ATS + AI is the strongest pitch; Phase 2 polish fills gaps after.)

---

### Progress — 13 November 2026

**Built (uncommitted on branch `yash`):** the recruiter portal (Phase 1) and the university placement cell (Phase 2.5), plus real notifications (2.1).

| Area | Status | Where |
|---|---|---|
| Company set-up, public company page, teams with roles (admin / recruiter / interviewer) | ✅ | `institutions/` · `/dashboard/company/profile`, `/companies/[id]` |
| 1.1 Pipeline board — drag & drop, every move logged, student emailed | ✅ | `/dashboard/company/pipeline` |
| 1.2 Candidate view — profile, match, answers, notes, 1–5 ratings, tags, activity timeline | ✅ | `/dashboard/company/applicants/[id]` |
| 1.3 Interviews — schedule, panel, `.ics` invite, confirm/reschedule, scorecards | ✅ | `/dashboard/company/interviews` |
| 1.4 Offers — terms, expiry, accept/decline, printable offer letter (browser "Save as PDF") | ✅ | `/offers/[id]` |
| 1.5 Bulk move / tag / email, email templates with placeholders, kind automatic rejections | ✅ | `/dashboard/company/applicants` |
| 1.6 Screening questions + knockouts, eligibility rules (CGPA, branch, degree, batch) | ✅ | listing create / edit form |
| 1.8 Funnel, conversion, time-to-hire, time-in-stage, sources, CSV export | ✅ | `/dashboard/company/analytics` |
| 2.1 Real notifications (in-app bell + email for important events) | ✅ (no per-user preferences yet) | `notifications/` |
| 2.4 Student tracker — interviews to confirm, offers to answer, per-application timeline | ✅ | `/dashboard/student/applications` |
| 2.5 Placement cell — link university, verify students, drives (auto-apply to linked internship), announcements, reports + CSV | ✅ | `campus/` · `/dashboard/university/*`, `/dashboard/student/campus` |
| Demo data — `python manage.py seed_demo` (password `Demo@12345`) | ✅ | `campus/management/commands/seed_demo.py` |

**Still open from Phases 1–2:** configurable stages per company · inviting teammates who don't have an account yet (today they sign up first, then an admin adds them) · notification preferences · 2.2 search filters & saved jobs · 2.3 job alerts · 2.6 messaging · 2.7 admin moderation · 2.8 profile-strength meter. Phase 0 commit/CI and Phases 3–5 are unchanged.

---

## Phase 0 — Lock it down (1–2 days)

- [ ] **Commit everything** in sensible commits (landing page, auth redesign, OTP, password reset, Google sign-in, profile completion).
- [ ] **Finish Brevo email setup** — turn off IP blocking, confirm a test code arrives (see [checklist](#13-pending-setup-checklist)).
- [x] **Seed / demo data script** (`python manage.py seed_demo` — recruiter + university demo; still to grow to ~30 companies / ~200 students) — `python manage.py seed_demo`: ~30 companies, ~100 internships, ~200 students with skills, applications in every status. Demos should never look empty.
- [ ] **CI on GitHub** — run backend tests + frontend typecheck/lint on every push and pull request.
- [ ] Fix the existing lint error in `src/contexts/auth-context.tsx` (`fetchUser()` called inside an effect).

---

## Phase 1 — Real recruiter hiring system (ATS / CRM) (2–3 weeks)

_The biggest gap — this is what makes it feel like a real product._

### 1.1 Pipeline board
- Kanban board per internship: **Applied → Screening → Interview → Offer → Hired / Rejected**.
- Drag candidate cards between stages.
- Every move is logged (who, when, from → to) and can email the student.
- Configurable stages per company (later).

### 1.2 Candidate view
- Full applicant profile on one screen: profile, resume preview, match score, answers to screening questions, full history.
- Private recruiter **notes** (timestamped, by author).
- **Rating** 1–5 stars, per recruiter.
- **Tags** (e.g. "strong DSA", "relocate OK") — filterable.
- Activity timeline: applied, viewed, moved, emailed, interviewed.

### 1.3 Interviews
- Schedule interviews: date/time slots, interviewers, meeting link (Google Meet / Zoom / custom URL).
- Calendar invite as `.ics` attachment in the email.
- Candidate can confirm or request reschedule.
- **Interview scorecards**: each interviewer rates criteria (technical, communication, culture) + recommendation (hire / no hire).

### 1.4 Offers
- Generate a **PDF offer letter** from a template (stipend, start date, duration, role).
- Candidate accepts / declines inside the portal; status updates automatically.
- Offer expiry date.

### 1.5 Bulk actions & email templates
- Select many applicants → shortlist / reject / move stage / email.
- Reusable **email templates** with placeholders (`{{first_name}}`, `{{internship}}`, `{{company}}`).
- Rejection emails that are kind and automatic.

### 1.6 Screening & eligibility
- Per-internship **screening questions** (text, yes/no, multiple choice).
- **Eligibility rules**: minimum CGPA, allowed branches/degrees, graduation year range.
- Ineligible students can't apply (with a clear reason shown).
- Optional knockout questions.

### 1.7 Company pages & teams
- Public **company page**: about, logo, culture, open roles, verified badge.
- **Team accounts**: multiple recruiters per company with roles (company admin / recruiter / interviewer) — builds on the existing `CompanyMembership` model.
- Invite teammates by email.

### 1.8 Recruiter analytics
- Funnel per internship (how many at each stage, drop-off %).
- Time-to-hire, time-in-stage.
- Source of applicants (direct, university drive, recommendation).
- Export to CSV.

---

## Phase 2 — Complete student & university product (2 weeks)

### 2.1 Real notifications
- Notification model + API; replace the hard-coded list in `notifications.tsx`.
- Events: application status changed, interview scheduled, offer received, new message, new matching internship, deadline approaching.
- Delivered **in-app** (bell, unread count) and by **email** (via Brevo).
- Per-user notification preferences.

### 2.2 Search & discovery
- Full search with filters: stipend range, location, remote / onsite / hybrid, duration, skills, company, deadline.
- Sort by: best match, newest, highest stipend, closing soon.
- **Saved jobs** (bookmark).
- **"Similar internships"** on each internship page.

### 2.3 Job alerts
- Students save a search → daily or weekly email digest of new matching internships.

### 2.4 Application tracker (student)
- Timeline view per application: applied → viewed → shortlisted → interview → offer.
- Upcoming interviews list, offer actions.

### 2.5 University placement cell
- **Placement drives**: a company visits campus on a date; eligible student list generated automatically; registration for the drive.
- **Student verification** by the university (confirms enrolment, CGPA).
- **Placement reports**: % placed, median / highest stipend, top recruiters, branch-wise stats — export CSV / PDF.
- Announcements to their students.

### 2.6 Messaging
- Recruiter ↔ candidate chat inside the portal.
- Only unlocked after **shortlisting** (prevents spam).
- Unread counts, email notification for new messages.

### 2.7 Admin moderation
- Verify companies (documents / domain email).
- Moderate internship posts, take down fake or spammy listings.
- Report button for students ("this looks fake").
- Audit log of admin actions.

### 2.8 Profile strength
- "Profile 70% complete" meter with next suggested steps.
- Public shareable student profile (optional, privacy-controlled).

---

## Phase 3 — AI & machine learning (3 weeks)

_The headline of the pitch. Built in layers — each step works on its own and can be demoed separately._

### 3.1 Semantic matching (embeddings)
- Turn resumes, student profiles and job descriptions into **embeddings** with `sentence-transformers` (`all-MiniLM-L6-v2` — small, fast, free).
- Matching understands **meaning**, not just keywords: "React developer" ↔ "frontend engineer".
- Store vectors (PostgreSQL `pgvector`, or a cached table for small scale).
- **Hybrid score** = semantic similarity + skill overlap + eligibility + location / remote preference (weighted).

### 3.2 Explainable scores
- Every score comes with reasons: _"82% match — has 4 of 5 required skills, missing Docker; strong project experience in React."_
- Shown to students ("why you match") and recruiters ("why we ranked them here").
- Explainability builds trust and is a strong academic talking point.

### 3.3 AI resume parsing
- Upload a PDF → an LLM (Claude API) extracts **structured data**: skills, education, experience, projects, certifications.
- Student reviews and confirms before it is saved (no silent changes).
- Replaces most of the manual profile typing.

### 3.4 Skill-gap advisor (educational angle)
- _"Learn Docker and SQL to qualify for 23 more internships."_
- Computed from the most-demanded skills in internships the student almost matches.
- Links to free learning resources per skill.
- Optional: personalised learning path.

### 3.5 Recommendations that learn
- Track behaviour: views, saves, applications, shortlists, hires.
- **Collaborative filtering** ("students like you applied to…") combined with content-based matching.
- Ranking improves over time as data grows.

### 3.6 Recruiter AI helpers
- **Job description writer** — from a few bullet points to a full posting.
- **Candidate summary** — 3-line summary per applicant.
- **Interview question generator** — based on the job + the candidate's resume.
- **Smart shortlist** — "top 10 candidates for this role" with reasons.

### 3.7 Measure it (proof for the pitch)
- Metric: of candidates recruiters actually shortlisted, how many did the AI rank in its top 10? (precision@10)
- Compare: plain skill-overlap vs. hybrid AI matching.
- Show the numbers on a dashboard — a real number makes the pitch credible.

### 3.8 Responsible AI
- No use of gender, age or other protected attributes in ranking.
- AI suggests, humans decide — recruiters always make the final call.
- Show students what data the score used.

---

## Phase 4 — Third-party job integration (1–2 weeks)

**Rule: use official job APIs, never scraping.** Scraping LinkedIn / Naukri / Indeed breaks their terms of service and gets blocked.

### Sources

| Source | Why | Key needed |
|---|---|---|
| **Adzuna API** | India coverage, salary data | Free API key |
| **Jooble API** | Large index of Indian jobs | Free API key |
| **Remotive** | Remote jobs | No key |
| **Arbeitnow** | Remote / international jobs | No key |
| **The Muse** | Entry-level jobs & internships | Free |

### How it works
- Background job (scheduled every few hours) fetches new listings from each source.
- **Normalise** into one `ExternalJob` format (title, company, location, salary, description, URL, source, posted date).
- **De-duplicate** across sources (same title + company + location).
- Expire old listings automatically.
- External jobs are clearly labelled **"External · Apply on Adzuna"** — they get our AI match score, but "Apply" opens the original site.
- Track clicks to measure which sources are useful.

**Pitch line:** _"We bring together opportunities from across the web — and our AI ranks all of them for you."_

---

## Phase 5 — Pitch-ready (1 week)

- [ ] Performance pass (page load, API response times, images).
- [ ] Mobile pass on every page (real phone testing).
- [ ] Accessibility pass (keyboard navigation, contrast, screen reader labels).
- [ ] Good **empty states** and loading states everywhere.
- [ ] **Demo script** — 5-minute walkthrough across all 3 roles (student applies → recruiter moves through pipeline → interview → offer → university sees placement stats).
- [ ] **Product metrics dashboard** — active users, applications/day, match accuracy.
- [ ] **Architecture diagram** — frontend, backend, database, AI service, job integrations, email.
- [ ] Pitch deck + README with screenshots.

---

## 10. Order, timeline & team split

**Order:** 0 → 1 → 3 → 2 → 4 → 5
**Total:** roughly **10–12 weeks** at a steady student pace; faster if the team splits work.

Suggested split for a team of three:

| Person | Owns |
|---|---|
| A | Recruiter side — Phase 1 (pipeline, interviews, offers, company teams) |
| B | AI / ML — Phase 3 (embeddings, scoring, resume parsing, evaluation) + Phase 4 jobs |
| C | Student & university side — Phase 2 (notifications, search, alerts, placement cell, messaging) |

Everyone: Phase 0 together at the start, Phase 5 together at the end.

---

## 11. Hosting & cost notes

- **Render free tier** sleeps when idle, and (as far as we know) blocks outgoing SMTP — so emails on the live site should go through the **Brevo HTTPS API key**, not SMTP.
- The embedding model needs memory; Render free (512 MB) may struggle. Options: a paid instance (~$7/month) before demo day, or run embeddings through an API.
- Claude API for resume parsing / AI helpers: pay-per-use, small at student scale.
- Third-party job APIs listed above are free at our scale.
- PostgreSQL with `pgvector` for vector search (supported by most hosted Postgres providers).

---

## 12. How we work

- One feature = one branch = one pull request.
- Every feature ships with backend tests and is checked on mobile + desktop.
- Keep secrets in `.env` / hosting dashboards — never in git or chat.
- Update this roadmap's checkboxes as features land.

---

## 13. Pending setup checklist

- [ ] **Brevo:** turn off IP blocking at <https://app.brevo.com/security/authorised_ips>
- [ ] **Brevo:** confirm a test OTP email arrives
- [ ] **Render env vars:** `BREVO_API_KEY` (an API key with send permission), `DEFAULT_FROM_EMAIL`, `GOOGLE_CLIENT_ID`
- [ ] **Vercel env vars:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_URL`
- [ ] **Google Cloud:** add test users on the OAuth consent screen (or publish the app); add the Vercel URL to Authorized JavaScript origins
- [ ] **Restart Django** after any `.env` change
- [ ] Rotate the Brevo keys that were pasted in chat (optional but safer)
