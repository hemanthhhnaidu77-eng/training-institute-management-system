# Manual testing checklist

Run backend (`npm run dev`) and frontend (`npm start`), seed data loaded. Test at desktop width and at ~375 px (mobile) in DevTools. Keep the browser console open: there should be no errors.

## Public pages (logged out)

- [ ] **Home:** hero headline, 3 CTAs work (Explore Courses → /courses, Book a Free Consultation → /appointments, Student Login → /login). Stats show real counts. Popular courses, categories (click → filtered catalogue), trainers, testimonials show "Sample content" labels, batches, events, FAQ, newsletter (valid email → success toast; duplicate → "already subscribed"; invalid → inline error).
- [ ] Stop the backend and reload Home → error alert with Retry (no fake data). Start backend → Retry works.
- [ ] **Navbar:** every link works, active link highlighted, mobile menu opens/closes, Escape closes menus. **Footer:** course/service/contact/social links.
- [ ] **About:** all sections render; placeholder logos labelled.
- [ ] **Courses:** search by keyword, filter category/level/mode, sort by fee/title/newest, Reset, empty state on no match, URL keeps filters on reload.
- [ ] **Course detail:** syllabus, prerequisites, outcomes, batches with seats, trainer card, reviews. "Enroll Now" while logged out → login with return URL. "Book Course Consultation" → booking form prefilled with course.
- [ ] Unknown slug `/courses/nope` → "Course not found".
- [ ] **Services:** 16 cards, each CTA goes to courses / booking (service preselected) / contact (subject prefilled) / batches / placements.
- [ ] **Trainers:** search works, "Book a Session" preselects the trainer.
- [ ] **Batches:** filters, View details modal, Request enrollment while logged out → login.
- [ ] **Placements:** "no guarantee" messaging, sample labels, CTAs.
- [ ] **Appointments:** required/email/mobile validation; past date blocked; slots load after choosing a date; picking a trainer changes slots; closed day shows warning; booking shows confirmation with appointment ID. Book the same trainer/date/slot in another browser → "slot unavailable" with alternatives, slots refresh.
- [ ] **Contact:** validation, success shows ticket number, inquiry appears in Admin → Inquiries.
- [ ] **FAQ:** category chips filter; accordions expand with keyboard (Tab + Enter).
- [ ] **404:** `/does-not-exist` shows the not-found page.

## Authentication

- [ ] Register: field validation, password strength, confirm mismatch, terms required, duplicate email → server error on the email field. Success → student dashboard.
- [ ] Login: wrong password → generic error; show/hide password; Remember me keeps you signed in after closing the browser; without it, closing the tab logs you out.
- [ ] Logout → redirected to login with "logged out securely". Back button does not reveal dashboards.
- [ ] Forgot password: same message for existing and unknown emails; link appears in `backend/data/outbox.json`; reset works once; reusing link fails; old sessions are signed out.
- [ ] Visiting `/admin` as a student redirects to `/student`; `/student` while logged out → login with return URL.
- [ ] Deactivated student (Admin → Students) cannot log in and is signed out on next request.

## Student dashboard

- [ ] Overview cards match reality; empty states with helpful CTAs for a new account.
- [ ] Request enrollment from course detail and from Batches; duplicate request rejected; withdraw pending request.
- [ ] After admin approval: course shows "approved", batch, trainer; My Schedule shows weekly timetable and sessions; notification received.
- [ ] After admin marks completed: completion record number shown; Write a review → pending until admin approves.
- [ ] My Appointments: tabs, status history, cancel pending (instant), reschedule pending (slot picker), on confirmed appointments buttons become "Request ..." and show the pending request banner.
- [ ] Notifications: mark one read, mark all read, unread badge in sidebar/topbar updates.
- [ ] Profile: update name/mobile/preferred course; change password (wrong current password shows field error; success keeps you logged in).

## Trainer dashboard (seeded trainer login)

- [ ] Overview counts; My Courses (lead/co-trainer badge, syllabus); My Batches (record a session; future date rejected); My Schedule.
- [ ] Appointments: only bookings with this trainer; Confirm pending; Mark completed.
- [ ] Students: only students in own batches. Attempting `/api/students` with a trainer token returns 403.
- [ ] Profile: edit bio/certifications/photo URL; changes show on the public Trainers page.

## Admin dashboard

- [ ] Overview figures update after creating records; "Needs attention" links work; activity feed records actions.
- [ ] Students: search, status filter, pagination, details modal (enrollments + appointments), edit, deactivate/activate.
- [ ] Courses: create (validation errors shown per field), edit (fees, syllabus lines, trainer, enrollment open), archive → hidden from catalogue; delete permanently blocked when batches/enrollments exist.
- [ ] Trainers: create, assign courses, availability days/hours (booking slots follow), deactivate (hidden publicly, login disabled).
- [ ] Batches: create with course/trainer/days/capacity; end date before start rejected; capacity below allocated seats rejected; delete with students blocked.
- [ ] Enrollments: approve with batch (full batch rejected), reject with note, complete, reopen.
- [ ] Appointments: filters (status, trainer, course, date range, requests only); confirm, reject, reschedule (conflicting slot rejected), cancel, complete, decline request.
- [ ] Services: create/edit/disable (disappears from Services page), order changes display order.
- [ ] Inquiries: search, open, add internal note, mark in progress/resolved/closed, reply by email link.
- [ ] Reviews: approve, approve + testimonial (appears on Home), reject, delete. Testimonials/FAQs/Events CRUD reflect on the public site.
- [ ] Reports: each type with and without date range; CSV downloads and opens in Excel.
- [ ] Settings: institute info changes footer/contact page; socials; appointment slots/working days/window affect booking; staff account creation (trainer must be linked to an unlinked trainer profile).

## Data & resilience

- [ ] Restart the backend: all data persists.
- [ ] `npm run backup`, edit/corrupt a JSON file, restart → server logs recovery and restores from backup.
- [ ] Two browsers booking the same slot at the same moment → only one succeeds.
