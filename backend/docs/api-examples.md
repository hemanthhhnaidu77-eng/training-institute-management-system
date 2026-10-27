# API request & response examples

Captured from a local run of this codebase (ids, timestamps and appointment numbers will differ on your machine; long tokens are truncated). Base URL: `http://localhost:3000/api`.

PowerShell users: replace `curl -s -H "Content-Type: application/json" -d '{...}'` with
`Invoke-RestMethod -Method Post -ContentType 'application/json' -Body '{...}' -Uri <url>` (add `-Headers @{ Authorization = "Bearer $token" }` for protected routes).

---

## Health

```http
GET /api/health
```
```json
{ "success": true, "data": { "status": "ok", "storage": "ok", "uptimeSeconds": 2, "timestamp": "2026-10-27T05:46:02.900Z" } }
```

## Register a student

```http
POST /api/auth/register
Content-Type: application/json

{ "fullName": "Asha Verma", "email": "asha@example.com", "mobile": "9876543210", "password": "Secret123", "acceptTerms": true }
```
`201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_5bc56586-cd8d-4685-b05b-c6aa3146b362",
      "role": "student",
      "fullName": "Asha Verma",
      "email": "asha@example.com",
      "mobile": "9876543210",
      "preferredCourseId": null,
      "trainerId": null,
      "isActive": true,
      "lastLoginAt": "2026-10-27T05:46:02.368Z",
      "createdAt": "2026-10-27T05:46:02.368Z",
      "updatedAt": "2026-10-27T05:46:02.368Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5...",
    "expiresAt": "2026-10-27T07:46:02.000Z"
  }
}
```
Note: no `passwordHash` in the response, and a `"role": "admin"` field in the body would be ignored.

## Validation error

```http
POST /api/auth/register
{ "fullName": "A", "email": "bad", "mobile": "123", "password": "short", "acceptTerms": true }
```
`400 Bad Request`
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields",
    "details": [
      { "field": "fullName", "message": "Full Name must be at least 2 characters" },
      { "field": "email", "message": "Email must be a valid email address" },
      { "field": "mobile", "message": "Mobile must be a valid 10-digit Indian mobile number" },
      { "field": "password", "message": "Password must be at least 8 characters" }
    ]
  }
}
```

## Login (invalid credentials)

```http
POST /api/auth/login
{ "email": "asha@example.com", "password": "Wrong1234" }
```
`401 Unauthorized`
```json
{ "success": false, "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }
```
A successful login returns the same shape as registration. Add `"remember": true` for a 7-day token.

## Course search

```http
GET /api/courses?category=Data%20%26%20AI&level=Intermediate
```
```json
{
  "success": true,
  "data": [
    {
      "id": "crs_e502ea4f-...",
      "slug": "data-science",
      "title": "Data Science",
      "category": "Data & AI",
      "level": "Intermediate",
      "mode": "Hybrid",
      "duration": "20 weeks",
      "fee": 70000,
      "discountedFee": 62000,
      "effectiveFee": 62000,
      "trainerName": "Dr. Priya Sharma",
      "batchCount": 1,
      "enrolledCount": 0,
      "rating": null,
      "status": "active",
      "enrollmentOpen": true,
      "syllabus": ["Python for data analysis (NumPy, pandas)", "..."]
    }
  ],
  "meta": { "total": 1, "categories": ["Cloud & DevOps", "Data & AI", "Marketing", "Programming", "Quality Engineering", "Security", "Web Development"] }
}
```
Sort with `sort=popular|title|fee_asc|fee_desc|newest`; paginate with `page` + `limit`.

## Slot availability

```http
GET /api/appointments/availability?date=2026-11-02&trainerId=trn_388bd99c-...
```
```json
{
  "success": true,
  "data": {
    "date": "2026-11-02", "dayOpen": true, "reason": null,
    "slots": [
      { "time": "10:00", "available": true, "reason": null },
      { "time": "11:00", "available": true, "reason": null },
      { "time": "12:00", "available": true, "reason": null }
    ],
    "trainerId": "trn_388bd99c-...", "slotMinutes": 45, "timezone": "Asia/Kolkata"
  }
}
```
Unavailable slots carry a reason: `Time has passed`, `Already booked`, `Fully booked`, `Outside trainer hours`.

## Book an appointment

```http
POST /api/appointments
Authorization: Bearer <student token>   (optional; guests can book too)

{ "fullName": "Asha Verma", "email": "asha@example.com", "mobile": "9876543210", "trainerId": "trn_388bd99c-...",
  "date": "2026-11-02", "time": "11:00", "mode": "Online", "message": "Career switch into web development" }
```
`201 Created`
```json
{
  "success": true,
  "data": {
    "id": "apt_c81d0cb5-ca47-4582-9fcb-5726bd1b498e",
    "appointmentNo": "APT-20261027-BFELTN",
    "userId": "usr_5bc56586-...",
    "date": "2026-11-02", "time": "11:00", "durationMinutes": 45, "mode": "Online",
    "status": "pending", "requestedAction": null,
    "statusHistory": [{ "status": "pending", "at": "2026-10-27T05:46:02.625Z", "by": "Asha Verma", "note": "Booking received" }],
    "trainerName": "Ananya Rao"
  }
}
```

## Booking conflict

Same trainer, same date and time:

`409 Conflict`
```json
{
  "success": false,
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The 11:00 slot on 2026-11-02 is unavailable (Already booked). Available: 10:00, 12:00, 14:00, 15:00, 16:00, 17:00.",
    "details": { "reason": "Already booked", "alternatives": ["10:00", "12:00", "14:00", "15:00", "16:00", "17:00"] }
  }
}
```
Other 409 codes: `DUPLICATE_BOOKING` (same person, overlapping time), `INVALID_TRANSITION`, `BATCH_FULL`, `DUPLICATE_ENROLLMENT`, `EMAIL_TAKEN`.

## Admin: confirm an appointment

```http
PATCH /api/admin/appointments/apt_c81d0cb5-.../status
Authorization: Bearer <admin token>

{ "action": "confirm", "note": "See you online!" }
```
```json
{
  "success": true,
  "data": {
    "appointmentNo": "APT-20261027-BFELTN",
    "status": "confirmed",
    "adminNote": "See you online!",
    "statusHistory": [
      { "status": "pending", "at": "2026-10-27T05:46:02.625Z", "by": "Asha Verma", "note": "Booking received" },
      { "status": "confirmed", "at": "2026-10-27T05:46:02.861Z", "by": "Institute Administrator", "note": "See you online!" }
    ]
  }
}
```
Actions: `confirm`, `reject`, `cancel`, `complete`, `reschedule` (+ `date`, `time`), `dismiss_request`.

## Student: cancel / reschedule

```http
PATCH /api/appointments/:id/cancel        { "reason": "Exam that day" }
PATCH /api/appointments/:id/reschedule    { "date": "2026-11-04", "time": "15:00", "reason": "Clash" }
```
Pending appointments change immediately (`"immediate": true`). Confirmed ones store a `requestedAction` for the admin (`"immediate": false`).

## Contact inquiry

```http
POST /api/inquiries
{ "name": "Ravi Kumar", "email": "ravi@example.com", "category": "Fees and Payment", "subject": "Instalments", "message": "Do you offer instalments for Data Science?" }
```
`201 Created`
```json
{ "success": true, "data": { "id": "inq_94721d69-...", "ticketNo": "INQ-20261027-GL4YF", "status": "new", "createdAt": "2026-10-27T05:46:02.657Z" } }
```

## Authorisation errors

```http
GET /api/students            (no token)
```
`401` `{ "success": false, "error": { "code": "NO_TOKEN", "message": "Please log in to continue" } }`

```http
GET /api/dashboard/admin     (student token)
```
`403` `{ "success": false, "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action" } }`

Expired token: `401 TOKEN_EXPIRED`. After logout or password change: `401 TOKEN_REVOKED`.

## Admin dashboard (computed from records)

```http
GET /api/dashboard/admin
```
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalStudents": 1, "activeStudents": 1, "totalTrainers": 7, "activeCourses": 12,
      "totalAppointments": 1, "pendingAppointments": 1, "confirmedAppointments": 0, "appointmentRequests": 0,
      "totalInquiries": 1, "openInquiries": 1, "pendingEnrollments": 0, "pendingReviews": 0, "activeBatches": 10
    },
    "trend": [
      { "month": "2026-09", "registrations": 0, "enrollments": 0, "appointments": 0 },
      { "month": "2026-10", "registrations": 1, "enrollments": 0, "appointments": 1 }
    ]
  }
}
```

## CSV report

```http
GET /api/admin/reports/appointments?from=2026-10-01&to=2026-10-31&format=csv
```
```
Appointment ID,Name,Email,Date,Time,Mode,Course,Trainer,Status,Booked at
APT-20261027-BFELTN,Asha Verma,asha@example.com,2026-11-02,11:00,Online,,Ananya Rao,confirmed,2026-10-27T05:46:02.626Z
```
Without `format=csv` the same report is returned as JSON with `columns`, `rows` and a `summary` by status.
