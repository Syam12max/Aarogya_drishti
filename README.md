# Aarogya Drishti (ఆరోగ్య దృష్టి)

**AI-assisted oral cancer early detection, telemedicine and patient care platform for remote tribal communities.**

Built for the **AAROHAN Inter-Centre Hackathon 2026**, organised by ITDA Paderu, Alluri Sitharama Raju District, Andhra Pradesh (27 October – 4 November 2026).

> ⚠️ **NOT FOR CLINICAL USE.** This is a hackathon demonstration. It uses **synthetic data only**. Any AI output is a research/mock label that is *advisory* and never a diagnosis. The software never confirms or stages cancer and never tells a patient they are cancer-free.

---

## Table of contents

1. [Overview](#1-overview)
2. [The problem](#2-the-problem)
3. [Goals](#3-goals)
4. [Patient journey](#4-patient-journey)
5. [Users and permissions](#5-users-and-permissions)
6. [Modules](#6-modules)
7. [Safety and responsible-AI rules](#7-safety-and-responsible-ai-rules)
8. [Architecture](#8-architecture)
9. [Tech stack](#9-tech-stack)
10. [Repository structure](#10-repository-structure)
11. [Database design](#11-database-design)
12. [Case state machine](#12-case-state-machine)
13. [API reference (planned)](#13-api-reference-planned)
14. [Image quality and AI pipeline](#14-image-quality-and-ai-pipeline)
15. [Telugu and offline-first design](#15-telugu-and-offline-first-design)
16. [Security](#16-security)
17. [Screens](#17-screens)
18. [Testing](#18-testing)
19. [Getting started](#19-getting-started)
20. [Deployment and recovery](#20-deployment-and-recovery)
21. [Project status](#21-project-status)
22. [Roadmap and timeline](#22-roadmap-and-timeline)
23. [Hackathon details](#23-hackathon-details)
24. [Known limitations](#24-known-limitations)
25. [Team and credits](#25-team-and-credits)

---

## 1. Overview

Aarogya Drishti is a secure, deployable digital platform that connects every step between a village-level oral examination and timely specialist care:

```
Patient → Health Worker → Image Quality Check → Research AI (advisory)
        → Medical Officer Review → Specialist (video / physical)
        → Diagnostics → Navigator follow-up → District Dashboard
```

It runs as a Progressive Web App on a real Android phone (Chrome) and on a computer, from a deployed HTTPS URL, in **Telugu and English**, and keeps working with poor connectivity.

**Inspiration:** the oral cancer screening work of IISc TANUH and Aarogya Aarohan, using smartphone images and AI-assisted assessment.

## 2. The problem

Oral cancer is a significant public health concern. In remote tribal areas, access to specialists is limited, so suspicious lesions are found late. The care journey breaks down at several points:

| Gap | Effect |
|---|---|
| Limited access | Specialist services are scarce in remote areas |
| Weak documentation | Oral findings and screening data are recorded inconsistently, often without photos |
| Delays | Referrals, diagnostics and follow-up are slow |
| No coordination | No single view of the care journey across roles |

**Result:** patients are lost between screening, referral and treatment.

## 3. Goals

1. **Digital registration** with consent and screening documentation.
2. **Image quality checks** plus research-only AI analysis.
3. **Connected clinicians:** health workers linked to Medical Officers and specialists.
4. **Journey tracking:** referrals, appointments, investigations and follow-up.
5. **Secure records** and aggregate-only district monitoring.
6. **Telugu/English UI** and offline workflows for low connectivity.

> Goal in one line: ensure no patient is lost between screening, referral and treatment.

## 4. Patient journey

1. Register patient and record purpose-specific consent
2. Capture medical and habit history
3. Capture guided oral photos (cheek, tongue, palate, gums, floor of mouth)
4. Automated image quality check (blur, brightness, glare)
5. Research/mock AI analysis (advisory only)
6. Independent Medical Officer review and signed decision
7. Referral to a specialist, with video or physical appointment
8. Simulated investigation (biopsy / histopathology) and clinician-entered result
9. Navigation and follow-up, including missed-visit handling
10. Aggregate district dashboard

**Built-in exception paths**

| Situation | System behaviour |
|---|---|
| Poor-quality image | Request recapture |
| AI service unavailable | Workflow continues without AI; manual review |
| Specialist needed | Create referral |
| Missed appointment | Auto-create follow-up navigation task |
| Expired or wrong video token | Join denied; reschedule possible |

## 5. Users and permissions

Every API call is authenticated and authorised by **role and patient/facility relationship** (deny by default).

| Capability | Health Worker | Medical Officer | Specialist | Navigator | District Admin |
|---|---|---|---|---|---|
| Register patient, consent | Yes (own facility) | No | No | No | No |
| Screening intake, photos | Yes (assigned) | View | View referred only | No | No |
| Run AI analysis | Yes | View | View | No | No |
| Clinical review and sign | No | Yes | Consult notes only | No | No |
| Create referral | No | Yes | Yes (onward) | No | No |
| Book video/physical appointment | No | Yes | Confirm | Yes | No |
| Investigations and pathology result | No | Order/view | Yes | View status only | No |
| Enter final diagnosis | No | Yes | Yes | No | No |
| Navigation tasks | View assigned follow-up | View | No | Yes | No |
| View images | Own cases | Assigned cases | Referred cases | No (unless needed) | No |
| Dashboard | No | Facility summary | No | Own queue | Aggregates only |
| Audit log | No | No | No | No | Aggregate/system view |

MFA is required for Medical Officer, Specialist and District Admin accounts.

## 6. Modules

| # | Module | What it does | Done when |
|---|---|---|---|
| A | **Registration & history** | Multi-step Telugu/English form, exposure and symptom checklist, consent, duplicate check (name + age + village + phone), server-generated `patient_code` | Patient and visit saved; duplicate warning shown |
| B | **Smartphone screening** | Guided camera with framing overlay, preview, retake, site tag, OpenCV quality check | Real phone captures 5 views; blurry image rejected |
| C | **AI assessment** | Pluggable adapter, mock model, stored versioned outputs, timeout/failure handling | Image → AI → persisted result; AI down does not block |
| D | **MO & specialist review** | Role-scoped queue, case viewer with zoom, agree/disagree/defer review, signing locks the version | Doctor can override AI and create referral |
| E | **Video consultation** | Slots, booking, per-user time-limited token (15–30 min), recording off | Two accounts join; expired token denied |
| F | **Physical appointment** | Specialty, hospital, slot, printable Telugu/English slip | Slip prints in Telugu; missed flow works |
| G | **Diagnostics** | Investigation state machine, report upload to private storage, clinician-only diagnosis | Simulated biopsy → pathology → diagnosis |
| H | **Longitudinal record** | Single timeline of every event with actor, time, version | Full journey visible in one timeline |
| I | **Navigation** | Task queue, contact log, overdue escalation, non-sensitive reminder text | Overdue shown and escalated |
| J | **District dashboard** | SQL aggregates by village/PHC/mandal; CSV export without identifiers | Seeded 12 cases and 4 referrals show exact counts |

## 7. Safety and responsible-AI rules

These are non-negotiable and are built into the design:

1. AI output is advisory and stored **separately** from the signed clinician conclusion.
2. The app never confirms or stages cancer and never tells a patient they are cancer-free. Only a **clinician-entered pathology result** can mark a case as confirmed in the simulation.
3. Every mock/research model output carries **NOT FOR CLINICAL USE**, the model version and a timestamp.
4. The clinical workflow keeps working if the AI service is down.
5. Every API call is authenticated and authorised at patient/facility level, not just by role.
6. No bounding boxes or heatmaps unless a real supervised localisation model exists.
7. No secrets in Git. Only `.env.example` with placeholders.
8. Offline records are marked *synced* only after server acknowledgement.

Also: no AI result may move a case forward by itself; AI cards never say "healthy" or "cancer"; UI never colours a patient as cancer or healthy.

## 8. Architecture

**Data flow:** Health worker PWA → authenticated FastAPI → PostgreSQL + private image storage → AI adapter (research only) → stored AI observation → Medical Officer → video or physical specialist → diagnostics → navigator → aggregate dashboard.

| Layer | Contents |
|---|---|
| 1. Presentation | Health Worker PWA, Medical Officer, Specialist, Navigator and Admin portals |
| 2. API | FastAPI: authentication, authorisation, validation, workflow, idempotency |
| 3. AI (can fail) | Image quality service, replaceable mock/research adapter |
| 4. Data | PostgreSQL, private image/report object storage |
| 5. Integration | Secure video consultation, appointments, notifications (if implemented) |
| 6. Infrastructure | Docker, HTTPS, monitoring, backups, deployment |

**Design principles**

- **Security boundary:** authentication and patient-level checks at the API; private storage; no public links.
- **Private vs aggregate:** images and records stay private; the dashboard shows aggregates only.
- **Fault isolation:** AI down ≠ workflow down.

## 9. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite PWA, `react-i18next` (Telugu/English) |
| Backend | Python, FastAPI, SQLAlchemy, Alembic, Pydantic |
| Database | PostgreSQL |
| Image storage | Private S3-compatible bucket (MinIO locally), short-lived signed URLs |
| Image QC | OpenCV (blur, brightness, glare) |
| AI | Pluggable adapter: `mock-v1` default, optional EfficientNet-B0 research model |
| Video | Approved SDK (e.g. Jitsi JaaS, Daily, LiveKit) with time-limited tokens |
| Offline | Service worker + IndexedDB queue with idempotency keys |
| Testing | pytest, API integration tests, Playwright mobile E2E |
| Deploy | Docker Compose locally; managed container/VM + managed Postgres online |
| Monitoring | Structured logs (no PHI), `/healthz`, uptime check |

## 10. Repository structure

```
aarogya-drishti/
├── apps/web/          # PWA: health worker, clinician, navigator, admin UI
├── services/api/      # FastAPI, auth, workflow, migrations
├── services/ai/       # quality checker + mock/research adapters
├── infra/             # docker-compose, deployment manifests
├── docs/              # PRD, architecture, ER, API, threat model, test report
├── tests/             # unit, integration, E2E, security
├── .env.example
└── README.md
```

## 11. Database design

PostgreSQL, UUID primary keys. Clinician findings are kept separate from AI output.

| Table | Purpose | Key rules |
|---|---|---|
| `facilities` | PHC, hospital, diagnostic centre | Mandal/PHC filters |
| `users` | Accounts and roles | Unique login, active flag, MFA for privileged roles |
| `patients` | Demographics and residence | UUID, duplicate hint, PII restricted |
| `consents` | Purpose-specific consent | Append-only, versioned |
| `screenings` | One screening visit | Clinician findings separate from AI; `client_uuid` for offline |
| `images` | Oral photo metadata | Private storage key, checksum, consent gate |
| `ai_analyses` | Model outputs | Always `clinical_use = false` (CHECK constraint) |
| `clinical_reviews` | MO signed review | Versioned; only clinicians can finalise |
| `referrals` | Specialist referral | Explicit clinical decision |
| `appointments` | Video and physical visits | Status history, no public links |
| `appointment_status_history` | Status transitions | Append-only |
| `investigations` | Biopsy, pathology, imaging | Separate from AI label |
| `diagnoses` | Clinician-entered result | Clinician roles only |
| `navigation_tasks` | Follow-up work items | Overdue escalation |
| `contact_attempts` | Navigator calls/visits | Linked to task |
| `idempotency_keys` | Safe retries | Unique per user + key |
| `audit_events` | Who did what | Append-only, no PHI in metadata |
| `case_state_history` | Case state transitions | Enforced transitions |

**Relationships**

```
facilities 1-N users
facilities 1-N patients (registered_at)
patients 1-N consents | screenings
screenings 1-N images | clinical_reviews
images 1-N ai_analyses
clinical_reviews 1-N referrals
referrals 1-N appointments | investigations | navigation_tasks
investigations 1-N diagnoses
navigation_tasks 1-N contact_attempts
```

`audit_events`, `consents`, `case_state_history` and `appointment_status_history` are **append-only**: UPDATE/DELETE is revoked from the app database role, or a trigger raises an exception.

## 12. Case state machine

```
DRAFT → CONSENTED → SCREENED → AWAITING_CLINICIAN → REVIEWED → REFERRAL_PLANNED
      → APPOINTED → ASSESSED → DIAGNOSTICS_PENDING → RESULT_REVIEWED → CARE_LINKED | CLOSED

Tracked exceptions: RESCHEDULED, MISSED, DECLINED, LOST_CONTACT
```

| Transition | Allowed actor | Guard |
|---|---|---|
| DRAFT → CONSENTED | Health worker | Imaging consent granted |
| CONSENTED → SCREENED | Health worker | Screening saved; at least one acceptable image or manual note |
| SCREENED → AWAITING_CLINICIAN | System | Submitted for review |
| AWAITING_CLINICIAN → REVIEWED | Medical Officer | Review signed |
| REVIEWED → REFERRAL_PLANNED | Medical Officer | Decision is referral |
| REFERRAL_PLANNED → APPOINTED | MO / Navigator | Appointment CONFIRMED |
| APPOINTED → ASSESSED | Specialist | Appointment COMPLETED + outcome |
| ASSESSED → DIAGNOSTICS_PENDING | Specialist | Investigation ordered |
| DIAGNOSTICS_PENDING → RESULT_REVIEWED | Clinician | Report received and reviewed |
| RESULT_REVIEWED → CARE_LINKED / CLOSED | Clinician / Navigator | Diagnosis entered by clinician |

Any transition not in this table is rejected with **HTTP 409**.

## 13. API reference (planned)

All routes require authentication, patient/facility authorisation, validation, pagination for lists, standard error codes, and an `Idempotency-Key` header on retryable writes.

| Method + route | Purpose | Who |
|---|---|---|
| `POST /auth/login` | Session/JWT with expiry | All |
| `POST /auth/mfa/verify` | MFA for privileged users | MO, specialist, admin |
| `GET /me` | Current user, role, facility | All |
| `POST /patients` | Register patient (returns duplicate warnings) | Health worker |
| `GET /patients/{id}` | Longitudinal record | Assigned care team |
| `POST /patients/{id}/consents` | Purpose-specific consent | Health worker |
| `POST /screenings` | Create screening + history (accepts `client_uuid`) | Health worker |
| `POST /screenings/{id}/images` | Upload photo (needs consent) | Assigned health worker |
| `GET /images/{id}/url` | Short-lived signed URL, audited | Authorised clinicians |
| `POST /ai/analyze` | Queue non-clinical analysis | Screening user |
| `GET /ai/analyses?image_id=` | AI history | Care team |
| `GET /queue` | Role-scoped work queue | MO, specialist, navigator |
| `POST /reviews` | Save and sign clinical review | Medical Officer |
| `POST /referrals` | Create referral + printable slip | Medical Officer |
| `GET /slots` | Available appointment slots | MO, navigator |
| `POST /appointments` | Book / request | MO, navigator |
| `PATCH /appointments/{id}` | Confirm, reschedule, cancel, attendance, outcome | Clinician / navigator |
| `POST /appointments/{id}/video-token` | Time-limited token for authorised participant | Participants only |
| `POST /investigations` | Order biopsy/pathology | Specialist, MO |
| `PATCH /investigations/{id}` | Update state, attach report | Specialist |
| `POST /diagnoses` | Clinician-entered result | MO, specialist |
| `PATCH /navigation/{id}` | Contact attempt, status | Navigator |
| `GET /dashboard/summary` | Aggregate counts and rates | District admin |
| `GET /dashboard/export` | Aggregate export only | District admin |
| `GET /healthz` | Health check | Public |

**Standard AI response (research demo)**

```json
{
  "analysis_id": "DEMO-AI-009",
  "screening_id": "DEMO-CASE-001",
  "image_quality": "acceptable",
  "provider": "mock",
  "model_version": "mock-v1",
  "research_label": "suspicious_example",
  "score": null,
  "clinical_use": false,
  "requires_clinician_review": true,
  "warning": "NOT FOR CLINICAL USE"
}
```

## 14. Image quality and AI pipeline

**Image checks (`services/ai`)**

1. Validate extension and decode with Pillow/OpenCV; reject non-images (e.g. a renamed PDF).
2. Enforce a maximum size (e.g. 8 MB) and minimum dimensions.
3. Fix EXIF orientation, strip metadata, compute SHA-256.
4. **Blur:** variance of Laplacian below threshold → recapture.
5. **Brightness:** mean grayscale too low or too high → recapture.
6. **Glare:** fraction of saturated pixels above threshold → recapture.
7. Calibrate thresholds on demo images and record them in `docs/`.

**AI adapter levels**

| Level | What | When |
|---|---|---|
| 1 (required) | Mock adapter with fixed demo labels | Day 4 |
| 2 (optional) | EfficientNet-B0 fine-tuned on a licensed dataset | Only if the core system is complete |
| 3 (never) | Real clinical use | Not allowed |

Research labels: `insufficient_image`, `suspicious_example`, `none_identified`. No score is shown, and there are no heatmaps, boxes or accuracy claims.

If a research model is trained: write `DATASET_CARD.md` and `MODEL_CARD.md`, remove corrupt files, split source images into train/val/test **before** augmentation (no leakage), and report sensitivity, specificity, precision, F1, confusion matrix and sample sizes.

## 15. Telugu and offline-first design

| Area | Implementation |
|---|---|
| i18n | `react-i18next` with `te.json` and `en.json`; no hardcoded English; toggle visible on every page |
| Fonts | Noto Sans Telugu bundled locally; tested on Android and in PDF |
| Usability | 44px+ touch targets, icon + label buttons, progress steps, "Saved" confirmation, minimal typing |
| Offline storage | IndexedDB drafts; payloads encrypted with WebCrypto where feasible (browser storage is not fully protected) |
| Sync queue | Each write has a client UUID + `Idempotency-Key`; states: pending → uploading → confirmed / failed |
| Conflicts | Visible resolution screen; clinician notes are never discarded |

**Offline acceptance test:** airplane mode → create patient and draft → close/reopen → reconnect → sync once → force retry → exactly one server record.

## 16. Security

| Area | Requirement |
|---|---|
| Auth | Argon2/bcrypt, short sessions, refresh handling, MFA for MO/specialist/admin, no shared accounts |
| Authorisation | Role **and** patient/facility check in every query; deny by default; tests per endpoint |
| Transport & storage | HTTPS, encrypted DB and backups, private bucket, signed URLs under 5 minutes |
| Uploads | Decode, size limit, safe filenames, no path traversal, metadata stripped |
| Audit | Log image views, exports, clinical edits, diagnoses, permission changes; no PHI in logs |
| Secrets | Env vars or secret manager; `.env` gitignored; rotate after the event |
| Threats covered | Stolen phone, expired/replayed token, IDOR, mass assignment, leaked signed URL, malicious upload, shared video link, backup leak |
| Governance | Synthetic data only; demo reset script; test users disabled after event; DPDP and telemedicine compliance in the roadmap |
| Privacy in UI | No patient names in browser titles, notifications or URLs; session-timeout screen |

## 17. Screens

Every screen has an ID. Health worker screens are mobile-first; the others target laptop/tablet but work on a phone.

**Health worker app (mobile, 10 screens)**

`HW-01` Login · `HW-02` Home · `HW-03` Register · `HW-04` Consent · `HW-05` History · `HW-06` Camera · `HW-07` Photo check (retake loop) · `HW-08` AI result · `HW-09` Submit · `HW-10` Sync

**Medical Officer & specialist portal (12 screens)**

`MO-01` Queue · `MO-02` Case view · `MO-03` Review · `MO-04` Referral · `MO-05` Book visit · `SP-01` Queue · `SP-02` Consult · `SP-03` Order test · `SP-04` Report · `SP-05` Diagnosis · `TL-01` Timeline

**Navigator & district admin (5 screens)**

`NV-01` Task queue · `NV-02` Task detail · `NV-03` Treatment · `AD-01` Dashboard · `AD-02` Export

**Design rules**

- Status colours: grey = draft, blue = pending, green = confirmed/signed, amber = warning/AI advisory, red = failed/urgent.
- AI card is always amber with *NOT FOR CLINICAL USE*, model version and timestamp.
- Clinician-signed items show a green badge with doctor name, time and version.
- Visible "Saved" feedback after every write; clear retry on failure; offline banner when disconnected.
- Body text ≥ 16px, touch targets ≥ 44px (primary mobile button ≥ 48px).

## 18. Testing

| Test | Input | Expected |
|---|---|---|
| Normal journey | Consent → screening → photo → review → video → biopsy | One continuous record |
| Blurred photo | Defocused image | Recapture warning |
| Invalid file | PDF renamed `.jpg` | Rejected after decode |
| Missing consent | Upload before consent | Rejected with explanation |
| Wrong patient | Doctor A opens unrelated case | 403 |
| AI down | Stop AI container | Case intact; manual review works |
| Network loss | Disconnect during upload | Retry, no duplicate image |
| Double submit | Same POST + same key | Single record |
| False-negative AI | AI low, clinician suspicious | Referral still possible |
| False-positive AI | AI suspicious, clinician disagrees | Discrepancy documented |
| Missed appointment | Mark missed | Navigation task created |
| Bad video token | Expired or wrong token | Join denied; reschedule possible |
| Long Telugu text | Switch language, PDF, mobile | No overflow |
| Concurrent edit | Two users edit one review | Conflict/version error |
| Dashboard | 12 cases, 4 referrals seeded | Exact counts |
| Audit | Change pathology status | Actor/time/action stored |
| Invalid transition | SCREENED → CARE_LINKED | 409 |
| Oversized image | Over limit | 413 |
| Traversal filename | `../../x.jpg` | Sanitised or rejected |

Required evidence: pytest unit tests, API integration tests, Playwright mobile E2E, authorisation tests, offline demo recording, and a known-issues list. Security tests are written to fail first, then fixed.

## 19. Getting started

> The repository is a fresh start: the commands below are the **planned** bootstrap from the build plan. Update this section as the real scripts land.

**Prerequisites:** Git, Node.js (LTS), Python 3.11+, Docker + Docker Compose.

```bash
# 1. Scaffold the repo
git init aarogya-drishti && cd aarogya-drishti
mkdir -p apps/web services/api services/ai docs tests infra

# 2. Frontend
cd apps && npm create vite@latest web -- --template react-ts
cd web && npm install && cd ../..

# 3. Backend
cd services/api && python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install fastapi 'uvicorn[standard]' sqlalchemy alembic \
  'psycopg[binary]' pydantic-settings python-multipart
pip freeze > requirements.txt        # pin and review versions
```

**Environment variables:** copy `.env.example` to `.env` and fill in values. Never commit `.env`. An environment-variable table (no secrets) will live in `docs/`.

**Run locally (target):**

```bash
docker compose up --build -d     # web, api, ai, postgres, minio
# run Alembic migrations, then:
make seed                        # synthetic demo data
curl http://localhost:8000/healthz
make reset                       # reset demo data
```

**Build order (vertical slices, each with passing tests before moving on)**

1. Docker stack + health check + migrations + seed data
2. Auth, roles, facility scoping, audit middleware
3. Patient, consent, screening APIs and Telugu/English forms
4. Image upload, quality checks, mock AI, stored results
5. Review queue, signed review, referral
6. Appointments, video tokens, physical slip
7. Investigations, diagnosis, navigation tasks
8. Timeline and dashboard aggregates
9. Offline sync, security tests, deployment, documentation

**Test accounts:** to be listed here once seeded (synthetic only, disabled after the event).

## 20. Deployment and recovery

1. `docker compose up --build -d` (web, api, ai, postgres, minio)
2. Run Alembic migrations, then seed synthetic data (`make seed`)
3. Verify `GET /healthz` returns 200
4. Open the HTTPS URL on Android; test camera, reload and offline
5. Restart the API; confirm data persists
6. Confirm the bucket is private and signed URLs expire
7. Run automated tests against the deployed URL
8. Take a DB backup and restore into a fresh environment
9. Provide `make reset` for demo data
10. After the event: disable test users and rotate secrets

Free hosting tiers may sleep or wipe files, so use persistent database and object storage and keep a local Docker route as backup.

## 21. Project status

Status labels: **PLANNED → IMPLEMENTED → VERIFIED** (with evidence). Update only with evidence.

| Area | Status |
|---|---|
| All ten modules (A–J) | PLANNED |
| API endpoints | PLANNED (not yet verified) |
| Offline support | PLANNED (verify on a real Android device before claiming) |
| Test matrix | PLANNED (none executed yet) |

## 22. Roadmap and timeline

| Day | Date | Focus |
|---|---|---|
| 1 | 27 Oct | Briefing, requirements, architecture, team setup |
| 2 | 28 Oct | UI/UX, DB schema, project foundation |
| 3 | 29 Oct | Registration, consent, screening forms |
| 4 | 30 Oct | Image capture, quality checks, AI integration |
| 5 ★ | 31 Oct | Medical Officer portal; **minimum complete end-to-end system** |
| 6 | 1 Nov | Video, appointments, referrals |
| 7 | 2 Nov | Diagnostics, records, Telugu, security |
| 8 ★ | 3 Nov | Integration testing, deployment, rehearsal |
| 9 ★ | 4 Nov | Final demo, jury evaluation, awards. **Code freeze 10:00 AM IST** |

**Beyond the hackathon:** any real-world use requires clinical, security, regulatory and health-authority approvals and an approved clinical pilot (including DPDP and telemedicine compliance).

## 23. Hackathon details

| Item | Detail |
|---|---|
| Event | AAROHAN Inter-Centre Hackathon 2026 |
| Organiser | ITDA Paderu, Alluri Sitharama Raju District, Andhra Pradesh |
| Dates | 27 Oct – 4 Nov 2026 |
| Theme | AI for Public Health · Technology for Tribal Communities · From Screening to Treatment |
| Team size | Maximum 5 students; each student in one team only |
| Prize | ₹10,000 per winning team |
| Format | Open-book; AI coding assistants permitted with disclosure |
| Data | Synthetic patients and licensed demo images only (real patient data is prohibited) |

**Judging (100 marks)**

| Criterion | Marks |
|---|---|
| Workflow & integration | 20 |
| AI, image quality, safe integration | 15 |
| Doctor review, teleconsultation, appointments | 15 |
| Records, diagnostics, navigation | 15 |
| Security, privacy, governance | 15 |
| Telugu, offline, accessibility | 10 |
| Deployment, code quality, documentation | 10 |

**Disqualifiers:** real patient data, presenting AI as clinical, exposed records, plagiarism, hardcoded secrets, misleading diagnostic claims.

**Submission checklist:** source repo with daily commits · deployed HTTPS demo URL + test accounts · README · architecture and ER diagrams · role-access matrix · OpenAPI docs · environment-variable table · AI model/dataset cards · threat model · test report · deployment/backup/rollback guide · synthetic dataset + reset command · Telugu UI demo · 5-minute demo video · AI-tool disclosure · roadmap to an approved clinical pilot · live presentation on 4 Nov 2026.

## 24. Known limitations

- Demonstration only: **not a medical device** and not validated for any clinical purpose.
- AI is a mock/research adapter; no accuracy, localisation or diagnostic claims are made.
- Synthetic data and licensed demo images only.
- Offline storage in the browser is not fully protected.
- Free hosting tiers may sleep or wipe files.
- Statuses in [Project status](#21-project-status) are PLANNED until verified with evidence.

## 25. Team and credits

- **Team:** _[Team name]_
- **Members:** _[Member 1 – Member 5]_
- **Centre:** _[Participating AAROHAN centre]_

**AI-tool disclosure:** _[List AI coding assistants, templates and third-party code used]_

**Acknowledgements:** ITDA Paderu and AAROHAN; inspired by IISc TANUH and Aarogya Aarohan oral cancer screening work.

## License

_[Choose a license, e.g. MIT, before making the repository public.]_

---

*Hackathon demonstration only. NOT FOR CLINICAL USE.*
