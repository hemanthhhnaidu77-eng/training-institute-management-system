# Training Institute Website & Management System

A full-stack, role-based website and management system for an IT / skills training institute.

- **Frontend:** Angular 18 (standalone components, signals, reactive forms, lazy-loaded routes)
- **Backend:** Node.js + Express REST API (JavaScript, CommonJS)
- **Storage:** JSON files on the server (no database), behind a swappable repository layer
- **Auth:** JWT access tokens (HS256, expiry, revocation) + bcrypt password hashing
- **Roles:** Admin, Student, Trainer, each with its own dashboard and server-side permissions

The institute name **"Navigate Tech Academy"**, address, phone numbers, testimonials and partner logos are **placeholders / sample content**. Change them in *Admin → Settings* and *Admin → Testimonials*. No real placement statistics are shown; homepage figures are computed live from your own records.

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Folder structure](#folder-structure)
4. [Prerequisites](#prerequisites)
5. [Installation (Windows)](#installation-windows)
6. [Environment configuration](#environment-configuration)
7. [JSON storage](#json-storage)
8. [Seed data & demo accounts](#seed-data--demo-accounts)
9. [API overview](#api-overview)
10. [Authentication & roles](#authentication--roles)
11. [Tests](#tests)
12. [Security notes](#security-notes)
13. [Known limitations](#known-limitations)
14. [Migrating to a database later](#migrating-to-a-database-later)
15. [Troubleshooting](#troubleshooting)

---

## Features

**Public website:** Home (hero, popular courses, categories, why-us, live stats, trainers, placement support, testimonials, upcoming batches, workshops/events, FAQ, consultation CTA, newsletter), About, Courses (search, category/level/mode filters, sorting, detail pages with syllabus, prerequisites, outcomes, batches, reviews, Enroll Now, Book Consultation), Services (16 services with benefits, delivery mode and working CTAs), Trainers, Batches & Schedule (seat availability, enrollment requests), Placements & Career Support, Appointment booking, Contact (inquiry form, map placeholder, socials), FAQ (categorised), Terms, Login, Register, Forgot/Reset password, 404.

**Appointment booking:** live slot availability per date/trainer, past-date and past-time prevention, trainer working days/hours, booking window, per-slot counsellor capacity, server-side conflict detection inside a serialised critical section (no double booking even under concurrent requests), duplicate-booking prevention per person, unique appointment IDs (`APT-YYYYMMDD-XXXXXX`), statuses *Pending / Confirmed / Completed / Cancelled / Rescheduled*, student cancel/reschedule (instant while pending, request once confirmed), admin confirm/reject/reschedule/cancel/complete/decline-request, trainer confirm/complete for their own appointments, full status history.

**Student dashboard:** overview cards (enrolled, upcoming appointments, upcoming classes, completed, pending inquiries), My Courses (enrollment status, withdraw, completion records, course reviews), My Appointments (history, cancel, reschedule), My Schedule (weekly timetable + next 4 weeks), Notifications, Profile + change password.

**Trainer dashboard:** overview, assigned courses, assigned batches with session-completion records, weekly schedule, appointments (confirm/complete), students in own batches only, profile (bio/certifications/photo).

**Admin dashboard:** live statistics and 6-month trend, recent registrations/activity/sessions; Students (search, filter, details, edit, activate/deactivate, enrollments + appointment history); Courses, Trainers, Batches, Services, Testimonials, FAQs, Events (full CRUD, archive/deactivate, assignments, capacity, display order); Enrollments (approve/reject/complete with seat checks, batch assignment); Appointments (filters by date/trainer/course/status/requests, all actions); Inquiries (search, status, internal notes); Reviews (moderation, publish as testimonial); Reports (registrations, enrollments, appointments, inquiries with date range + CSV export); Settings (institute info, hours, socials, branding, appointment rules, staff accounts).

---

## Architecture

```
 Browser (Angular SPA :4200)
   │  components → feature services → ApiService (HttpClient)
   │  interceptors: auth (Bearer token) + error (normalise, handle 401)
   │  guards: authGuard / roleGuard / guestGuard  (UX only)
   ▼  REST/JSON  (CORS: only CORS_ORIGINS)
 Express API (:3000)  /api/*
   helmet · cors · json(100kb) · rate limits · request log (no bodies)
   routes → validate(schema) → authenticate → authorize(role) → controller
   controllers (thin) → services (business rules, ownership, conflicts)
   services → Repository (create/update/remove/mutate)
   Repository → JsonStore (per-file promise queue, atomic temp+rename writes)
   ▼
 backend/data/*.json  (+ data/backups/<timestamp>/)
```

- **Controllers** translate HTTP ↔ service calls and use a consistent envelope: `{ "success": true, "data": ..., "meta": ... }` or `{ "success": false, "error": { "code", "message", "details" } }`.
- **Services** hold all rules (booking conflicts, seat limits, status transitions, ownership checks).
- **Repository/JsonStore** is the only code that touches files. Swap it for a database adapter without changing services (see [migration](#migrating-to-a-database-later)).

---

## Folder structure

```
training-institute-management/
├── README.md
├── .gitignore
├── backend/
│   ├── package.json · .env.example
│   ├── data/                  # JSON "database" (one file per collection)
│   ├── docs/                  # openapi.json, api-examples.md, manual-testing-checklist.md
│   ├── scripts/               # init-data, seed (+ seed-data), create-user, backup, restore
│   ├── src/
│   │   ├── app.js · server.js
│   │   ├── config/            # env loading + validation
│   │   ├── storage/           # jsonStore.js, repository.js, index.js (repos)
│   │   ├── middleware/        # auth, errorHandler, rateLimiters, validateRequest, requestLogger
│   │   ├── validation/        # request schemas
│   │   ├── services/          # auth, course, trainer, batch, enrollment, appointment(+Rules), inquiry,
│   │   │                      # review, catalogs(services/testimonials/faqs/events), dashboard, report,
│   │   │                      # settings, notification, activity, profile, student, trainerPortal, mail
│   │   ├── controllers/       # auth, resource, workflow, account controllers
│   │   ├── routes/index.js    # every endpoint + its middleware chain
│   │   └── utils/             # ApiError, validate, query, ids, dates, csv, sanitize, response
│   └── tests/                 # node:test suites (+ helpers/env.js)
└── frontend/
    ├── package.json · angular.json · tsconfig*.json
    └── src/
        ├── index.html · main.ts · styles.css (design tokens) · favicon.svg · assets/
        ├── environments/      # apiUrl only (no secrets)
        └── app/
            ├── app.component.ts · app.config.ts · app.routes.ts
            ├── core/          # models, services (Auth, Course, Trainer, ServiceCatalog, Appointment,
            │                  # Enrollment, Batch, Dashboard, Inquiry, Notification, Profile, ...),
            │                  # interceptors, guards
            ├── shared/        # components (icon, loader, alert, empty state, modal, confirm dialog,
            │                  # toasts, pagination, status badge, course card, schedule view, field error),
            │                  # pipes (inr), utils (validators, server-error mapping)
            ├── layout/        # public-layout (navbar/footer), dashboard-layout (sidebar/topbar)
            └── features/      # home, about, courses, services, trainers, batches, placements,
                               # appointments, contact, faq, legal, auth, profile,
                               # student-dashboard, trainer-dashboard, admin-dashboard, not-found
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20.11+ LTS** (20.x or 22.x recommended) | Includes npm 10. Check with `node -v` |
| npm | 10+ | `npm -v` |
| Angular CLI | 18.x | Installed locally by `npm install`; global install optional: `npm i -g @angular/cli@18` |
| Browser | Chrome / Edge / Firefox (latest) | Chrome or Edge needed for `ng test` |

Ports: **frontend 4200**, **backend 3000**.

---

## Installation (Windows)

Commands below work in **PowerShell**. `cmd.exe` equivalents are shown where they differ.

### 1. Backend

```powershell
cd training-institute-management\backend
npm install

# create your environment file
Copy-Item .env.example .env          # cmd.exe:  copy .env.example .env

# generate a strong JWT secret and paste it into .env as JWT_SECRET=...
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
notepad .env

# create any missing JSON data files (safe to re-run, never overwrites)
npm run init-data

# load demo courses, services, trainers, batches, FAQs, events + dev accounts
npm run seed

# start the API (auto-restarts on file changes)
npm run dev                           # or: npm start
```

Verify the API is up (new terminal):

```powershell
Invoke-RestMethod http://localhost:3000/api/health      # cmd.exe / Git Bash: curl http://localhost:3000/api/health
```

Expected: `{ success: true, data: { status: "ok", storage: "ok", ... } }`.

### 2. Frontend

```powershell
cd ..\frontend
npm install
# API URL lives in src\environments\environment.development.ts (default http://localhost:3000/api)
npm start                              # runs: ng serve --port 4200
```

Open **http://localhost:4200**.

If you change the backend port or host, update **both** `frontend/src/environments/environment*.ts` (`apiUrl`) and `backend/.env` (`CORS_ORIGINS`, `FRONTEND_URL`).

### Production build (optional)

```powershell
cd frontend
npm run build          # output: frontend\dist\training-institute\browser
```

Serve `dist/.../browser` from any static host with an SPA fallback to `index.html`, set `apiUrl` in `environment.ts` to your API URL, and set `NODE_ENV=production`, `CORS_ORIGINS=https://your-site` on the API. Never serve `backend/data` statically.

---

## Environment configuration

`backend/.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | `production` hides internal error details |
| `PORT` | `3000` | API port |
| `CORS_ORIGINS` | `http://localhost:4200` | Comma-separated list of allowed browser origins |
| `FRONTEND_URL` | `http://localhost:4200` | Used to build password-reset links |
| `JWT_SECRET` | *(required, 32+ chars)* | HMAC signing key. The server refuses to start without it |
| `JWT_EXPIRES_IN` | `2h` | Normal session length |
| `JWT_REMEMBER_EXPIRES_IN` | `7d` | Session length when "Remember me" is ticked |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor (4-15) |
| `DATA_DIR` | `backend/data` | Where JSON files live |
| `DEV_MAIL_OUTBOX` | `true` (dev) / `false` (prod) | Write outgoing mail to `data/outbox.json` instead of sending |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_TRAINER_PASSWORD` | empty | Optional seed credentials; random ones are generated if empty |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so rate limits see real client IPs |

The frontend only holds the **public** API URL. No secrets are ever placed in Angular environment files.

---

## JSON storage

Each collection is one file in `backend/data/`:

`users, courses, trainers, services, batches, enrollments, appointments, inquiries, testimonials, faqs, notifications, reviews, events, newsletter, activity, session_records, revoked_tokens, password_resets, outbox` (arrays) and `settings` (object).

How it stays safe:

- **Whitelisted collections:** file names are never taken from requests; unknown names throw. No path traversal.
- **Serialised writes:** every read-modify-write on a collection runs through a per-collection promise queue, so concurrent requests in the same process cannot interleave or lose updates. Booking conflict checks run *inside* that critical section.
- **Atomic writes:** data is written to a temp file and renamed over the original (with retries for Windows file locks), so a crash never leaves half-written JSON.
- **Validation before save:** every request body is validated and sanitised; unknown fields are dropped (no mass assignment).
- **IDs & timestamps:** UUID-based ids with prefixes (`crs_…`, `apt_…`) plus `createdAt` / `updatedAt` on every record.
- **Graceful recovery:** missing files are created with valid defaults. On startup, a malformed file is copied to `name.json.corrupt-<timestamp>` and restored from the newest backup (or reset to empty if no backup exists). A UTF-8 BOM added by Windows editors is tolerated.
- **Not public:** Express never serves `data/` statically.

### Backup & recovery

```powershell
npm run backup                 # copies all files to data\backups\<timestamp>-manual\
npm run restore                # lists available backups
npm run restore -- <name>      # stop the server first; takes a safety backup, then restores
```

`npm run seed -- --force` also takes a backup before replacing demo content. Copy `data/backups` off the machine regularly.

---

## Seed data & demo accounts

```powershell
npm run seed              # seeds only EMPTY collections (safe to re-run)
npm run seed -- --force   # backs up, then replaces demo content (users are kept)
```

Seeds 12 courses (Full Stack, Java, Python, Data Science, AI & ML, Angular, Node.js & Express, Cloud, Cybersecurity, Data Analytics, Software Testing, Digital Marketing), 16 services, 7 trainers, 10 batches with dates relative to today, 13 FAQs, 3 events and 4 testimonials clearly labelled **sample**.

**Accounts.** There is no hardcoded default password. On first seed the script creates:

- 1 admin: `SEED_ADMIN_EMAIL` (default `admin@institute.local`)
- 2 trainer logins linked to trainer profiles (`ananya.trainer@institute.local`, `priya.trainer@institute.local`)

Passwords come from `SEED_ADMIN_PASSWORD` / `SEED_TRAINER_PASSWORD` if set; otherwise strong random passwords are generated and **printed once** in your terminal. Store them, then change them via *My Profile → Change password*.

Students register through the website. More admin/trainer accounts can be created by an admin (*Settings → Staff accounts*) or from the server console:

```powershell
$env:CREATE_USER_PASSWORD="ChooseAStrong1"; npm run create-user -- --role admin --name "Jane Admin" --email jane@example.com --mobile 9876543210
npm run create-user -- --role trainer --trainer-id trn_xxx --name "Trainer Name" --email t@example.com --mobile 9876543211   # prompts for the password
```

---

## API overview

Base URL `http://localhost:3000/api`. Machine-readable spec: **`GET /api/docs`** (OpenAPI 3, also in `backend/docs/openapi.json`). Real request/response samples: [`backend/docs/api-examples.md`](backend/docs/api-examples.md).

| Area | Endpoints |
|------|-----------|
| System | `GET /health`, `GET /docs` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` |
| Profile | `GET/PATCH /profile`, `GET /notifications/my`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Courses | `GET /courses` (q, category, level, mode, sort, page, limit), `GET /courses/:idOrSlug`, `POST`, `PUT /:id`, `DELETE /:id` (archive; `?hard=true` deletes if unused) |
| Trainers | `GET /trainers`, `GET /trainers/:id`, `POST`, `PUT /:id`, `DELETE /:id` (deactivate; `?hard=true`), `GET/PATCH /trainers/me` |
| Services | `GET /services`, `GET /services/:id`, `POST`, `PUT /:id`, `DELETE /:id`, `PATCH /services/reorder` |
| Batches | `GET /batches`, `GET /batches/:id`, `POST`, `PUT /:id`, `DELETE /:id` |
| Appointments | `GET /appointments/availability?date&trainerId`, `POST /appointments`, `GET /appointments/my`, `GET /appointments/:id`, `PATCH /appointments/:id/cancel`, `PATCH /appointments/:id/reschedule`, `GET /admin/appointments`, `PATCH /admin/appointments/:id/status` |
| Enrollments | `POST /enrollments`, `GET /enrollments/my`, `PATCH /enrollments/:id/cancel`, `GET /admin/enrollments`, `PATCH /admin/enrollments/:id/status` |
| Students | `GET /students`, `GET /students/:id`, `PATCH /students/:id` |
| Inquiries | `POST /inquiries`, `GET /inquiries/my`, `GET /admin/inquiries`, `GET /admin/inquiries/:id`, `PATCH /admin/inquiries/:id/status`, `POST /admin/inquiries/:id/notes` |
| Content | `/testimonials`, `/faqs`, `/events` (GET public; POST/PUT/DELETE admin), `POST /newsletter`, `GET /admin/newsletter` |
| Reviews | `GET /reviews?courseId`, `GET /reviews/my`, `POST /reviews`, `GET /admin/reviews`, `PATCH /admin/reviews/:id/status`, `DELETE /admin/reviews/:id` |
| Dashboards | `GET /dashboard/student`, `/dashboard/student/schedule`, `/dashboard/admin`, `/dashboard/trainer` |
| Trainer portal | `GET /trainer/courses`, `/trainer/batches`, `/trainer/students`, `/trainer/schedule`, `/trainer/appointments`, `PATCH /trainer/appointments/:id/status`, `GET/POST /trainer/sessions` |
| Admin | `GET/POST /admin/users` (staff), `GET /admin/reports/:type?from&to&format=csv`, `GET /admin/activity`, `GET/PUT /settings` |

Status codes: `200/201` success, `400` validation (`details[]` per field), `401` missing/expired/revoked token, `403` wrong role or disabled account, `404` not found (also used for records you don't own), `409` conflicts (slot taken, duplicate, full batch, invalid transition), `413` body too large, `429` rate limited, `503` storage problem.

---

## Authentication & roles

| Role | Created by | Can access |
|------|-----------|-----------|
| Student | Public registration only | Own profile, enrollments, appointments, reviews, notifications |
| Trainer | Admin (Settings → Staff accounts) or `create-user` CLI | Own trainer profile, assigned courses/batches, students in own batches, own appointments (confirm/complete), session records |
| Admin | Seed script, CLI, or another admin | Everything, including staff provisioning |

- Passwords: bcrypt (via `bcryptjs`, a pure-JavaScript implementation producing standard `$2b$` hashes; chosen so `npm install` needs no C++ build tools on Windows). Never stored or returned in plain text; hashes never leave the server.
- Tokens: HS256 JWT with `iss`, `aud`, `exp`, `jti`. Verified on every protected request together with the user's active status.
- Logout revokes the token's `jti` (persisted in `revoked_tokens.json`). Password change/reset and deactivation bump a per-user `tokenVersion`, invalidating every older token. `POST /auth/refresh` rotates a still-valid token.
- Angular stores the token in `sessionStorage` (or `localStorage` with "Remember me"). Route guards are convenience only; **the API enforces every permission and ownership check**.
- Password reset issues a random 256-bit token, stores only its SHA-256 hash, expires in 30 minutes and is single-use. Responses are identical whether or not the email exists. **No email service is configured**: in development the message (with the link) is written to `backend/data/outbox.json`; in production nothing is sent until you plug a real transport into `src/services/mailService.js`.

---

## Tests

### Backend

```powershell
cd backend
npm test
```

Suites (Node's built-in `node:test` + `supertest`):

- `storage.test.js`: file init/defaults, persistence across instances, serialised concurrent writes, rollback on error, path traversal rejection, malformed JSON quarantine + restore, BOM tolerance, backup/restore.
- `validate.test.js`: email/mobile/password rules, required fields, mass-assignment stripping, HTML/control-char sanitising, strict dates/times.
- `appointmentRules.test.js`: past dates/times, closed days, booking window, trainer hours, double-booking, counsellor capacity, reschedule exclusion, duplicate detection.
- `appointmentService.test.js`: unique IDs + persistence, **10 concurrent bookings for one slot → exactly 1 succeeds**, past booking refused, ownership, request/approval flows, reschedule conflict checks.
- `services.test.js`: trainer and course CRUD, slug rules, fee rules, archive vs delete, enrollment duplicate prevention, approval with seat limits, completion certificate numbers, review gating + moderation, inquiry workflow, dashboard figures.
- `api.test.js` (HTTP): health, registration + bcrypt hash, duplicate/terms errors, invalid credentials, missing/tampered/expired/forged JWTs, role authorisation, course/trainer CRUD, appointment conflicts + ownership + trainer scope, enrollment approval, inquiry submission, malformed JSON/oversized bodies, logout revocation, password change, password reset single-use, deactivation.

### Frontend

```powershell
cd frontend
npm test            # Karma + Jasmine in Chrome (watch mode)
npm run test:ci     # single headless run
```

Specs cover validators (mobile, password strength, match, past dates, server error mapping), login form validation + server error display + password toggle, appointment form validation + past dates + backend-unreachable state, guards, and dashboard loading/error handling (no mock data substituted on failure).

Manual checklist for every page and role: [`backend/docs/manual-testing-checklist.md`](backend/docs/manual-testing-checklist.md).

### Build verification notes

The authoring environment had Node.js but no npm registry access, so dependencies could not be installed there. What *was* executed: the storage, validation, booking-rule, appointment-service and domain-service suites (37 tests, all passing, no third-party deps needed), the seed script, and the HTTP suite (15 tests) against minimal local stand-ins for Express/JWT/bcrypt; all TypeScript files were parsed and all 55 Angular templates were checked for structure and missing imports. **Not yet executed:** `npm install`, the HTTP suite against the real Express/bcrypt/jsonwebtoken packages, `ng build` type-checking and the Karma specs. Run `npm test` (backend) and `npm run build` + `npm run test:ci` (frontend) after installing, and fix anything they report before relying on the system.

---

## Security notes

- Helmet security headers, `x-powered-by` disabled, JSON body limit 100 kB, strict CORS allow-list.
- Rate limits: auth endpoints (20 / 15 min), password reset (5 / hour), public forms (15 / 15 min), whole API (300 / min).
- Every protected route: `authenticate` → `authorize(role)` → service-level ownership checks (students only see their own records; trainers only their own batches/students/appointments).
- Public trainer data excludes email/phone/account links. User objects never include `passwordHash` or `tokenVersion`.
- Login uses constant-ish timing for unknown emails and a single generic error message.
- Input is validated and sanitised server-side (types, lengths, enums, formats, HTML stripped from plain text). Angular escapes all output; the app never uses `innerHTML`. The only trusted iframe is a Google Maps embed URL set by an admin.
- CSV exports neutralise spreadsheet formula injection.
- Logs contain method, path, status and duration only. No bodies, tokens or passwords.
- Production: set `NODE_ENV=production` (hides internal error messages), use HTTPS, rotate `JWT_SECRET` if leaked (this signs everyone out), keep `.env` and `data/` private and backed up.
- Token storage in Web Storage is readable by JavaScript on the page. Mitigated by Angular's escaping, short expiry and revocation; for higher assurance move to httpOnly cookies with CSRF protection.

---

## Known limitations

- **JSON files are not a database.** No multi-statement transactions, indexes or query engine. Every request reads whole files, so performance degrades as collections grow (fine for thousands of records, not millions).
- **Single process only.** The write queue lives in memory. Running multiple API instances (cluster mode, several containers, serverless) against the same files can corrupt data or allow double bookings. Run exactly one instance.
- Cross-collection operations (e.g. creating a testimonial when approving a review) are separate writes; a crash between them can leave them partially applied.
- No payment processing, real email/SMS, file uploads (images are URLs) or video classroom integration.
- Times use the configured institute time zone (default Asia/Kolkata); slots are fixed daily times.
- Revoked token ids are kept until the token would have expired anyway.

---

## Migrating to a database later

1. Keep the `Repository` interface (`all`, `find`, `findOne`, `findById`, `create`, `update`, `remove`, `mutate`) and implement it for your database (e.g. a PostgreSQL or MongoDB adapter).
2. Implement `mutate(fn)` as a **transaction** (with row locks / `SELECT ... FOR UPDATE`, or a unique index on `(trainerId, date, time)` for active appointments) so booking and seat checks stay race-free across instances.
3. Swap the repositories in `src/storage/index.js`; services and controllers stay unchanged.
4. Write a one-off script that reads each `data/*.json` file and inserts the records (ids and timestamps are already portable).
5. Add indexes on `users.email`, `appointments(trainerId,date,time,status)`, `enrollments(studentId,courseId)`, `courses.slug`.
6. Move `revoked_tokens` to Redis or a table with TTL, and then scale out horizontally.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `JWT_SECRET is missing or shorter than 32 characters` | Create `backend/.env` from `.env.example` and set a long random `JWT_SECRET` |
| `EADDRINUSE :3000` / `:4200` | Another process uses the port. `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`, or change `PORT` (and update `apiUrl` + `CORS_ORIGINS`) |
| Browser shows "Cannot reach the server" | Start the backend; check `apiUrl` in `frontend/src/environments/environment.development.ts` |
| CORS error in the console | `CORS_ORIGINS` in `backend/.env` must exactly match the page origin, e.g. `http://localhost:4200` (no trailing slash). Restart the API after editing `.env` |
| `ng : File ... cannot be loaded because running scripts is disabled` | Use `npm start` / `npx ng ...`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `EPERM: operation not permitted, rename ...` | Antivirus/indexer locked a data file. Writes retry automatically; exclude `backend\data` from real-time scanning if it persists |
| `... .json is malformed` | Restart the server (auto-recovers from the latest backup) or `npm run restore -- <backup>` |
| Lost the seeded admin password | Stop the server and run `npm run create-user -- --role admin ...` to add a new admin |
| Node version errors | Use Node 20.11+ or 22 LTS (`node -v`) |
| Reset link "invalid or expired" | Links are single-use and last 30 minutes. Request a new one; in development open `backend/data/outbox.json` for the latest link |
