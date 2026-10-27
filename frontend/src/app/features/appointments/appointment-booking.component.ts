import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Appointment, Availability, Course, ServiceItem, Trainer } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { AppointmentService, CourseService, ServiceCatalogService, TrainerService } from '../../core/services/domain.services';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, LoaderComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { applyServerErrors, mobileValidator, notPastDate, todayLocal } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-appointment-booking',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeroComponent, IconComponent, LoaderComponent, AlertComponent, FieldErrorComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Free consultation" title="Book an appointment" subtitle="Pick a date and an open slot. You'll get an appointment ID instantly; our team confirms within one working day." />
    <section class="section-sm">
      <div class="container">
        @if (booked(); as a) {
          <div class="card confirm fade-up">
            <div class="icon-tile accent big"><app-icon name="check" [size]="30" /></div>
            <h2>Booking received!</h2>
            <p class="muted">Keep your appointment ID for reference.</p>
            <div class="apt-id">{{ a.appointmentNo }}</div>
            <dl class="kv">
              <dt>Date &amp; time</dt><dd>{{ a.date }} at {{ a.time }} ({{ a.durationMinutes }} min)</dd>
              <dt>Mode</dt><dd>{{ a.mode }}</dd>
              @if (a.trainerName) { <dt>Trainer</dt><dd>{{ a.trainerName }}</dd> }
              @if (a.courseTitle) { <dt>Course</dt><dd>{{ a.courseTitle }}</dd> }
              @if (a.serviceTitle) { <dt>Service</dt><dd>{{ a.serviceTitle }}</dd> }
              <dt>Status</dt><dd><app-status-badge [status]="a.status" /></dd>
            </dl>
            <div class="flex flex-wrap mt-3 center">
              @if (auth.role() === 'student') { <a routerLink="/student/appointments" class="btn btn-primary">Manage my appointments</a> }
              @else if (!auth.isLoggedIn()) { <a routerLink="/register" class="btn btn-primary">Create an account to manage bookings</a> }
              <button type="button" class="btn btn-outline" (click)="bookAnother()">Book another</button>
            </div>
            @if (!auth.isLoggedIn()) { <p class="muted small mt-2">Guest bookings can be changed by contacting us with your appointment ID.</p> }
          </div>
        } @else if (loadingLists()) {
          <app-loader label="Preparing the booking form..." />
        } @else if (listError()) {
          <app-alert type="error" title="Booking is temporarily unavailable" (retry)="loadLists()">{{ listError()?.message }}</app-alert>
        } @else {
          <form class="layout" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="card stack">
              <h3>1. Your details</h3>
              <div class="form-grid">
                <div class="field full"><label for="fullName">Full name<span class="req">*</span></label>
                  <input id="fullName" class="input" formControlName="fullName" autocomplete="name" /><app-field-error [control]="form.controls.fullName" label="Full name" /></div>
                <div class="field"><label for="email">Email address<span class="req">*</span></label>
                  <input id="email" type="email" class="input" formControlName="email" autocomplete="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
                <div class="field"><label for="mobile">Mobile number<span class="req">*</span></label>
                  <input id="mobile" type="tel" class="input" formControlName="mobile" autocomplete="tel" placeholder="98765 43210" /><app-field-error [control]="form.controls.mobile" label="Mobile number" /></div>
              </div>
              <h3 class="mt-2">2. What would you like to discuss?</h3>
              <div class="form-grid">
                <div class="field"><label for="courseId">Course of interest</label>
                  <select id="courseId" class="select" formControlName="courseId"><option value="">Not sure yet</option>@for (c of courses(); track c.id) { <option [value]="c.id">{{ c.title }}</option> }</select></div>
                <div class="field"><label for="serviceId">Service of interest</label>
                  <select id="serviceId" class="select" formControlName="serviceId"><option value="">General counselling</option>@for (s of services(); track s.id) { <option [value]="s.id">{{ s.title }}</option> }</select></div>
                <div class="field full"><label for="trainerId">Preferred trainer</label>
                  <select id="trainerId" class="select" formControlName="trainerId"><option value="">Any available counsellor</option>@for (t of trainers(); track t.id) { <option [value]="t.id">{{ t.name }} ({{ t.specialization }})</option> }</select>
                  <span class="hint">Choosing a trainer shows only their free slots.</span></div>
                <div class="field full"><label for="message">Message or requirements</label>
                  <textarea id="message" class="textarea" formControlName="message" maxlength="1500" placeholder="Tell us about your background and goals"></textarea></div>
              </div>
            </div>
            <div class="card stack side">
              <h3>3. Pick a time</h3>
              <div class="field"><label for="date">Appointment date<span class="req">*</span></label>
                <input id="date" type="date" class="input" formControlName="date" [min]="minDate" [max]="maxDate" /><app-field-error [control]="form.controls.date" label="Date" /></div>
              <div class="field">
                <span class="label" id="slot-label">Available time slot<span class="req">*</span></span>
                @if (!form.controls.date.value) { <p class="muted small mb-0">Select a date to see open slots.</p> }
                @else if (slotsLoading()) { <app-loader [inline]="true" label="Checking availability..." /> }
                @else if (slotsError()) { <app-alert type="error" (retry)="loadSlots()">{{ slotsError() }}</app-alert> }
                @else if (availability()) {
                  @if (!availability()!.dayOpen) { <app-alert type="warning">{{ availability()!.reason }}</app-alert> }
                  @else {
                    <div class="slots" role="radiogroup" aria-labelledby="slot-label">
                      @for (s of availability()!.slots; track s.time) {
                        <button type="button" role="radio" class="slot" [class.selected]="form.controls.time.value === s.time" [disabled]="!s.available"
                                [attr.aria-checked]="form.controls.time.value === s.time" [title]="s.reason || 'Available'" (click)="pickSlot(s.time)">
                          {{ s.time }}@if (!s.available) { <small>{{ s.reason }}</small> }
                        </button>
                      }
                    </div>
                    <span class="hint">Each slot is {{ availability()!.slotMinutes }} minutes ({{ availability()!.timezone }}).</span>
                  }
                }
                <app-field-error [control]="form.controls.time" label="Time slot" />
              </div>
              <fieldset class="field modes">
                <legend class="label">Consultation mode<span class="req">*</span></legend>
                @for (m of modes; track m) {
                  <label class="mode" [class.selected]="form.controls.mode.value === m"><input type="radio" formControlName="mode" [value]="m" /> {{ m }}</label>
                }
              </fieldset>
              @if (submitError(); as err) { <app-alert type="error" title="Booking not completed">{{ err }}</app-alert> }
              <button type="submit" class="btn btn-accent btn-lg w-full" [disabled]="submitting()">{{ submitting() ? 'Booking...' : 'Confirm booking' }}</button>
              <p class="muted small mb-0">By booking you agree to be contacted about your request. See our <a routerLink="/terms">privacy terms</a>.</p>
            </div>
          </form>
        }
      </div>
    </section>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
    .side { position: sticky; top: calc(var(--nav-h) + 16px); }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
    h3 { margin: 0; }
    .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .slot { min-height: 48px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--white); font-weight: 600; color: var(--navy-900); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.15; padding: 4px; }
    .slot small { font-weight: 500; font-size: 0.66rem; color: var(--ink-3); }
    .slot:hover:not([disabled]) { border-color: var(--navy-700); }
    .slot.selected { background: var(--navy-900); color: var(--white); border-color: var(--navy-900); }
    .slot[disabled] { background: #f2f4f8; color: #9aa6b8; cursor: not-allowed; text-decoration: line-through; }
    .slot[disabled] small { text-decoration: none; }
    .modes { border: none; padding: 0; margin: 0; display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; }
    .modes legend { margin-bottom: 8px; width: 100%; }
    .mode { display: inline-flex; gap: 6px; align-items: center; border: 1.5px solid var(--line); border-radius: 999px; padding: 8px 14px; cursor: pointer; font-size: 0.92rem; }
    .mode.selected { border-color: var(--navy-900); background: var(--navy-50); }
    .mode input { accent-color: var(--navy-900); }
    .confirm { max-width: 620px; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; }
    .big { width: 64px; height: 64px; border-radius: 20px; margin-bottom: 12px; }
    .apt-id { font-family: var(--font-display); font-size: 1.6rem; font-weight: 800; letter-spacing: 0.06em; color: var(--navy-900); background: var(--accent-100); border: 2px dashed var(--accent); border-radius: 14px; padding: 10px 24px; margin: 4px 0 20px; }
    .confirm .kv { text-align: left; width: 100%; max-width: 420px; }
    .center { justify-content: center; }
  `],
})
export class AppointmentBookingComponent implements OnInit {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private appointments = inject(AppointmentService);
  private courseService = inject(CourseService);
  private catalog = inject(ServiceCatalogService);
  private trainerService = inject(TrainerService);
  private fb = inject(FormBuilder);

  readonly modes = ['Online', 'Phone', 'In Person'] as const;
  readonly minDate = todayLocal();
  readonly maxDate = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();

  loadingLists = signal(true);
  listError = signal<ApiErrorInfo | null>(null);
  courses = signal<Course[]>([]);
  services = signal<ServiceItem[]>([]);
  trainers = signal<Trainer[]>([]);
  availability = signal<Availability | null>(null);
  slotsLoading = signal(false);
  slotsError = signal('');
  submitting = signal(false);
  submitError = signal('');
  booked = signal<Appointment | null>(null);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    mobile: ['', [Validators.required, mobileValidator]],
    courseId: [''],
    serviceId: [''],
    trainerId: [''],
    date: ['', [Validators.required, notPastDate]],
    time: ['', Validators.required],
    mode: ['Online', Validators.required],
    message: ['', Validators.maxLength(1500)],
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.form.patchValue({ courseId: q.get('courseId') || '', serviceId: q.get('serviceId') || '', trainerId: q.get('trainerId') || '' });
    const u = this.auth.user();
    if (u) this.form.patchValue({ fullName: u.fullName, email: u.email, mobile: u.mobile });
    this.form.controls.date.valueChanges.subscribe(() => this.loadSlots());
    this.form.controls.trainerId.valueChanges.subscribe(() => this.loadSlots());
    this.loadLists();
  }

  loadLists(): void {
    this.loadingLists.set(true);
    this.listError.set(null);
    forkJoin({ courses: this.courseService.list({ sort: 'title' }), services: this.catalog.list(), trainers: this.trainerService.list() }).subscribe({
      next: (r) => {
        this.courses.set(r.courses.items);
        this.services.set(r.services);
        this.trainers.set(r.trainers);
        this.loadingLists.set(false);
      },
      error: (e: ApiErrorInfo) => { this.listError.set(e); this.loadingLists.set(false); },
    });
  }

  loadSlots(): void {
    const { date, trainerId } = this.form.getRawValue();
    this.form.controls.time.setValue('');
    this.availability.set(null);
    this.slotsError.set('');
    if (!date || this.form.controls.date.invalid) return;
    this.slotsLoading.set(true);
    this.appointments.availability(date, trainerId || null).subscribe({
      next: (a) => { this.availability.set(a); this.slotsLoading.set(false); },
      error: (e: ApiErrorInfo) => { this.slotsError.set(e.message); this.slotsLoading.set(false); },
    });
  }

  pickSlot(time: string): void {
    this.form.controls.time.setValue(time);
    this.form.controls.time.markAsTouched();
  }

  submit(): void {
    this.submitError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set('Please complete the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.appointments.book({ ...v, courseId: v.courseId || null, serviceId: v.serviceId || null, trainerId: v.trainerId || null, message: v.message || null }).subscribe({
      next: (a) => { this.submitting.set(false); this.booked.set(a); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      error: (e: ApiErrorInfo) => {
        this.submitting.set(false);
        applyServerErrors(this.form, e);
        this.submitError.set(e.message);
        if (e.code === 'SLOT_UNAVAILABLE') this.loadSlots();
      },
    });
  }

  bookAnother(): void {
    this.booked.set(null);
    this.form.patchValue({ date: '', time: '', message: '' });
    this.form.markAsUntouched();
    this.availability.set(null);
  }
}
