import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, forkJoin } from 'rxjs';
import { ApiErrorInfo, Appointment, Availability, Course, PageMeta, Trainer } from '../../core/models/models';
import { AppointmentService, CourseService, TrainerService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, PaginationComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';
import { todayLocal } from '../../shared/utils/form-utils';

type Action = 'confirm' | 'reject' | 'cancel' | 'complete' | 'reschedule' | 'dismiss_request';

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Appointments</h1><p>Confirm, reject, reschedule, cancel or complete bookings. Conflicts are checked on the server.</p></div></div>
    <form class="toolbar" [formGroup]="filters">
      <input class="input" formControlName="q" placeholder="Search ID, name, email" aria-label="Search" />
      <select class="select" formControlName="status" aria-label="Status"><option value="">All statuses</option>@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select>
      <select class="select" formControlName="trainerId" aria-label="Trainer"><option value="">All trainers</option>@for (t of trainers(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select>
      <select class="select" formControlName="courseId" aria-label="Course"><option value="">All courses</option>@for (c of courses(); track c.id) { <option [value]="c.id">{{ c.title }}</option> }</select>
      <input class="input" type="date" formControlName="from" aria-label="From date" />
      <input class="input" type="date" formControlName="to" aria-label="To date" />
      <label class="check small"><input type="checkbox" formControlName="hasRequest" /> Only with requests</label>
    </form>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>When</th><th>Visitor</th><th>Trainer / topic</th><th>Mode</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>@for (a of items(); track a.id) {
          <tr>
            <td class="cell-title">{{ a.date }}<div class="muted small">{{ a.time }}</div></td>
            <td><div class="cell-title">{{ a.fullName }}</div><div class="muted small">{{ a.appointmentNo }} &middot; {{ a.mobile }}</div></td>
            <td>{{ a.trainerName || 'Any counsellor' }}<div class="muted small">{{ a.courseTitle || a.serviceTitle || 'General' }}</div></td>
            <td>{{ a.mode }}</td>
            <td><app-status-badge [status]="a.status" />
              @if (a.requestedAction; as r) { <div class="badge badge-warning mt-2">{{ r.type }} requested{{ r.type === 'reschedule' ? ': ' + r.date + ' ' + r.time : '' }}</div> }</td>
            <td><div class="actions">
              <button type="button" class="btn btn-sm btn-ghost" (click)="detail.set(a)">Details</button>
              @if (a.status === 'pending') { <button type="button" class="btn btn-sm btn-success" (click)="quick(a, 'confirm')">Confirm</button><button type="button" class="btn btn-sm btn-outline" (click)="openAction(a, 'reject')">Reject</button> }
              @if (isActive(a)) { <button type="button" class="btn btn-sm btn-outline" (click)="openAction(a, 'reschedule')">Reschedule</button><button type="button" class="btn btn-sm btn-ghost danger" (click)="openAction(a, 'cancel')">Cancel</button> }
              @if (a.status === 'confirmed' || a.status === 'rescheduled') { <button type="button" class="btn btn-sm btn-primary" (click)="quick(a, 'complete')">Complete</button> }
              @if (a.requestedAction) { <button type="button" class="btn btn-sm btn-ghost" (click)="openAction(a, 'dismiss_request')">Decline request</button> }
            </div></td>
          </tr>
        }</tbody></table></div>
      @if (!items().length) { <app-empty-state icon="clock" title="No appointments match" message="Adjust the filters or wait for new bookings." /> }
      <app-pagination [page]="meta().page || 1" [totalPages]="meta().totalPages || 1" [total]="meta().total" (pageChange)="page.set($event); load()" />
    }

    @if (detail(); as a) {
      <app-modal [title]="'Appointment ' + a.appointmentNo" (close)="detail.set(null)">
        <dl class="kv"><dt>Name</dt><dd>{{ a.fullName }}</dd><dt>Email</dt><dd>{{ a.email }}</dd><dt>Mobile</dt><dd>{{ a.mobile }}</dd>
          <dt>When</dt><dd>{{ a.date }} {{ a.time }} ({{ a.durationMinutes }} min)</dd><dt>Mode</dt><dd>{{ a.mode }}</dd>
          <dt>Trainer</dt><dd>{{ a.trainerName || 'Any counsellor' }}</dd><dt>Course</dt><dd>{{ a.courseTitle || '-' }}</dd><dt>Service</dt><dd>{{ a.serviceTitle || '-' }}</dd>
          <dt>Message</dt><dd>{{ a.message || '-' }}</dd><dt>Account</dt><dd>{{ a.userId ? 'Registered student' : 'Guest booking' }}</dd>
          @if (a.requestedAction; as r) { <dt>Request</dt><dd>{{ r.type }}{{ r.date ? ' to ' + r.date + ' ' + r.time : '' }}{{ r.reason ? ' (' + r.reason + ')' : '' }}</dd> }</dl>
        <h4 class="mt-3">Status history</h4>
        <ul class="small hist">@for (h of a.statusHistory; track h.at) { <li><app-status-badge [status]="h.status" /> {{ h.at | date: 'medium' }} &middot; {{ h.by }}{{ h.note ? ': ' + h.note : '' }}</li> }</ul>
      </app-modal>
    }

    @if (pending(); as p) {
      <app-modal [title]="titles[p.action]" (close)="pending.set(null)">
        <p><strong>{{ p.appt.fullName }}</strong> &middot; {{ p.appt.date }} {{ p.appt.time }} &middot; {{ p.appt.trainerName || 'Any counsellor' }}</p>
        <form [formGroup]="actionForm" (ngSubmit)="submitAction()" class="stack">
          @if (p.action === 'reschedule') {
            <div class="field"><label for="ndate">New date</label><input id="ndate" type="date" class="input" formControlName="date" [min]="today" (change)="loadSlots()" /></div>
            @if (slotsLoading()) { <app-loader [inline]="true" label="Checking slots..." /> }
            @else if (slots()) {
              @if (!slots()!.dayOpen) { <app-alert type="warning">{{ slots()!.reason }}</app-alert> }
              @else { <div class="slots">@for (s of slots()!.slots; track s.time) { <button type="button" class="slot" [class.selected]="actionForm.controls.time.value === s.time" [disabled]="!s.available" [title]="s.reason || 'Available'" (click)="actionForm.controls.time.setValue(s.time)">{{ s.time }}</button> }</div> }
            }
          }
          <div class="field"><label for="anote">Note (shared with the student)</label><textarea id="anote" class="textarea" formControlName="note" maxlength="500"></textarea></div>
          @if (actionError()) { <app-alert type="error">{{ actionError() }}</app-alert> }
          <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="pending.set(null)">Close</button>
            <button type="submit" class="btn" [class.btn-danger]="p.action === 'cancel' || p.action === 'reject'" [class.btn-primary]="p.action !== 'cancel' && p.action !== 'reject'" [disabled]="saving() || (p.action === 'reschedule' && (!actionForm.controls.date.value || !actionForm.controls.time.value))">Confirm</button></div>
        </form>
      </app-modal>
    }
  `,
  styles: [`
    .toolbar .check { white-space: nowrap; } .danger { color: var(--danger); } .hist { list-style: none; padding: 0; display: grid; gap: 6px; }
    .slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .slot { min-height: 42px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--white); font-weight: 600; cursor: pointer; }
    .slot.selected { background: var(--navy-900); color: var(--white); border-color: var(--navy-900); }
    .slot[disabled] { background: #f2f4f8; color: #9aa6b8; cursor: not-allowed; text-decoration: line-through; }
  `],
})
export class AdminAppointmentsComponent implements OnInit {
  private service = inject(AppointmentService);
  private trainerService = inject(TrainerService);
  private courseService = inject(CourseService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly statuses = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'];
  readonly today = todayLocal();
  readonly titles: Record<Action, string> = { confirm: 'Confirm appointment', reject: 'Reject appointment', cancel: 'Cancel appointment', complete: 'Complete appointment', reschedule: 'Reschedule appointment', dismiss_request: 'Decline student request' };
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Appointment[]>([]);
  meta = signal<PageMeta>({ total: 0 });
  page = signal(1);
  trainers = signal<Trainer[]>([]);
  courses = signal<Course[]>([]);
  detail = signal<Appointment | null>(null);
  pending = signal<{ appt: Appointment; action: Action } | null>(null);
  slots = signal<Availability | null>(null);
  slotsLoading = signal(false);
  saving = signal(false);
  actionError = signal('');
  filters = this.fb.nonNullable.group({ q: '', status: '', trainerId: '', courseId: '', from: '', to: '', hasRequest: false });
  actionForm = this.fb.nonNullable.group({ date: [''], time: [''], note: ['', Validators.maxLength(500)] });

  ngOnInit(): void {
    forkJoin({ trainers: this.trainerService.list(), courses: this.courseService.list({ sort: 'title' }) }).subscribe({
      next: (r) => { this.trainers.set(r.trainers); this.courses.set(r.courses.items); },
      error: () => undefined,
    });
    this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }
  isActive(a: Appointment): boolean { return ['pending', 'confirmed', 'rescheduled'].includes(a.status); }
  load(): void {
    const f = this.filters.getRawValue();
    this.loading.set(true); this.error.set(null);
    this.service.adminList({ ...f, hasRequest: f.hasRequest ? 'true' : null, page: this.page(), limit: 15, sort: f.from || f.status === 'pending' ? 'oldest' : null }).subscribe({
      next: (r) => { this.items.set(r.items); this.meta.set(r.meta); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  quick(a: Appointment, action: Action): void { this.run(a, { action }); }
  openAction(a: Appointment, action: Action): void {
    this.actionError.set('');
    this.slots.set(null);
    const r = a.requestedAction;
    this.actionForm.reset({ date: action === 'reschedule' && r?.type === 'reschedule' ? r.date || '' : '', time: action === 'reschedule' && r?.type === 'reschedule' ? r.time || '' : '', note: '' });
    this.pending.set({ appt: a, action });
    if (action === 'reschedule' && this.actionForm.controls.date.value) this.loadSlots(false);
  }
  loadSlots(resetTime = true): void {
    const p = this.pending();
    const date = this.actionForm.controls.date.value;
    if (!p || !date) return;
    if (resetTime) this.actionForm.controls.time.setValue('');
    this.slotsLoading.set(true);
    this.service.availability(date, p.appt.trainerId).subscribe({
      next: (s) => {
        // The appointment's own current slot shows as booked; that's expected.
        this.slots.set(s); this.slotsLoading.set(false);
      },
      error: (e: ApiErrorInfo) => { this.actionError.set(e.message); this.slotsLoading.set(false); },
    });
  }
  submitAction(): void {
    const p = this.pending();
    if (!p) return;
    const v = this.actionForm.getRawValue();
    this.run(p.appt, { action: p.action, note: v.note || undefined, ...(p.action === 'reschedule' ? { date: v.date, time: v.time } : {}) }, true);
  }
  private run(a: Appointment, body: { action: Action; date?: string; time?: string; note?: string }, inModal = false): void {
    this.saving.set(true);
    this.service.adminAction(a.id, body).subscribe({
      next: () => { this.saving.set(false); this.pending.set(null); this.toast.success(`${this.titles[body.action].split(' ')[0]} done for ${a.appointmentNo}`); this.load(); },
      error: (e: ApiErrorInfo) => {
        this.saving.set(false);
        if (inModal) { this.actionError.set(e.message); if (e.code === 'SLOT_UNAVAILABLE') this.loadSlots(); } else this.toast.error(e.message);
      },
    });
  }
}
