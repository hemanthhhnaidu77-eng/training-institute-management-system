import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, Appointment, Course, ScheduleData, TrainerStudent } from '../../core/models/models';
import { AppointmentService, TrainerPortalService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { ScheduleViewComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';

@Component({
  selector: 'app-trainer-courses',
  standalone: true,
  imports: [RouterLink, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My courses</h1><p>Courses you lead or are qualified to teach.</p></div></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="grid grid-2">
        @for (c of items(); track c.id) {
          <article class="card">
            <div class="flex between"><h3 class="mb-0"><a [routerLink]="['/courses', c.slug]">{{ c.title }}</a></h3><app-status-badge [status]="c.status" /></div>
            <p class="muted small">{{ c.category }} &middot; {{ c.level }} &middot; {{ c.mode }} &middot; {{ c.duration }}</p>
            <span class="badge" [class.badge-accent]="c.isPrimaryTrainer">{{ c.isPrimaryTrainer ? 'Lead trainer' : 'Co-trainer' }}</span>
            <details class="mt-2"><summary class="small">Syllabus ({{ c.syllabus.length }} modules)</summary><ol class="small">@for (s of c.syllabus; track $index) { <li>{{ s }}</li> }</ol></details>
          </article>
        }
      </div>
      @if (!items().length) { <app-empty-state icon="book" title="No courses assigned yet" message="An administrator assigns courses to trainers." /> }
    }
  `,
})
export class TrainerCoursesComponent implements OnInit {
  private portal = inject(TrainerPortalService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Course[]>([]);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.portal.courses().subscribe({ next: (c) => { this.items.set(c); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
}

@Component({
  selector: 'app-trainer-schedule',
  standalone: true,
  imports: [ScheduleViewComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My schedule</h1><p>Weekly timetable and upcoming sessions for your batches.</p></div></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (data()) {
      @if (data()!.batches.length) { <app-schedule-view [batches]="data()!.batches" [sessions]="data()!.sessions" /> }
      @else { <app-empty-state icon="calendar" title="No batches assigned" /> }
    }
  `,
})
export class TrainerScheduleComponent implements OnInit {
  private portal = inject(TrainerPortalService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  data = signal<ScheduleData | null>(null);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.portal.schedule().subscribe({ next: (d) => { this.data.set(d); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
}

@Component({
  selector: 'app-trainer-appointments',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Appointments</h1><p>Consultations booked with you. You can confirm pending ones and mark sessions completed.</p></div>
      <select class="select filter" [formControl]="status" aria-label="Filter by status"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rescheduled">Rescheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>When</th><th>Visitor</th><th>Topic</th><th>Mode</th><th>Status</th><th class="sr-only">Actions</th></tr></thead>
        <tbody>
          @for (a of filtered(); track a.id) {
            <tr>
              <td class="cell-title">{{ a.date }}<br /><span class="muted small">{{ a.time }}</span></td>
              <td>{{ a.fullName }}<br /><span class="muted small">{{ a.appointmentNo }}</span></td>
              <td>{{ a.courseTitle || a.serviceTitle || 'General' }}</td><td>{{ a.mode }}</td>
              <td><app-status-badge [status]="a.status" /></td>
              <td><div class="actions">
                <button type="button" class="btn btn-sm btn-ghost" (click)="detail.set(a)">Details</button>
                @if (a.status === 'pending') { <button type="button" class="btn btn-sm btn-success" (click)="act(a, 'confirm')">Confirm</button> }
                @if (a.status === 'confirmed' || a.status === 'rescheduled') { <button type="button" class="btn btn-sm btn-primary" (click)="act(a, 'complete')">Mark completed</button> }
              </div></td>
            </tr>
          }
        </tbody>
      </table></div>
      @if (!filtered().length) { <app-empty-state icon="clock" title="No appointments" message="Bookings made with you will appear here." /> }
    }
    @if (detail(); as a) {
      <app-modal [title]="'Appointment ' + a.appointmentNo" (close)="detail.set(null)">
        <dl class="kv"><dt>Visitor</dt><dd>{{ a.fullName }}</dd><dt>Email</dt><dd>{{ a.email }}</dd><dt>Mobile</dt><dd>{{ a.mobile }}</dd>
          <dt>When</dt><dd>{{ a.date }} {{ a.time }} ({{ a.durationMinutes }} min)</dd><dt>Mode</dt><dd>{{ a.mode }}</dd>
          <dt>Topic</dt><dd>{{ a.courseTitle || a.serviceTitle || 'General' }}</dd><dt>Message</dt><dd>{{ a.message || '-' }}</dd>
          <dt>Status</dt><dd><app-status-badge [status]="a.status" /></dd></dl>
        <h4 class="mt-3">History</h4>
        <ul class="small">@for (h of a.statusHistory; track h.at) { <li>{{ h.status }} &middot; {{ h.at | date: 'medium' }} &middot; {{ h.by }}{{ h.note ? ': ' + h.note : '' }}</li> }</ul>
      </app-modal>
    }
  `,
  styles: ['.filter { width: auto; min-width: 180px; }'],
})
export class TrainerAppointmentsComponent implements OnInit {
  private service = inject(AppointmentService);
  private toast = inject(ToastService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Appointment[]>([]);
  detail = signal<Appointment | null>(null);
  status = new FormControl('', { nonNullable: true });
  private statusValue = signal('');
  filtered = computed(() => this.items().filter((a) => !this.statusValue() || a.status === this.statusValue()));

  ngOnInit(): void { this.status.valueChanges.subscribe((v) => this.statusValue.set(v)); this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.trainerList().subscribe({ next: (a) => { this.items.set(a); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
  act(a: Appointment, action: 'confirm' | 'complete'): void {
    this.service.trainerAction(a.id, action).subscribe({
      next: (u) => { this.items.update((l) => l.map((x) => (x.id === u.id ? u : x))); this.toast.success(action === 'confirm' ? 'Appointment confirmed' : 'Marked as completed'); },
      error: (e: ApiErrorInfo) => this.toast.error(e.message),
    });
  }
}

@Component({
  selector: 'app-trainer-students',
  standalone: true,
  imports: [ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Students</h1><p>Learners enrolled in your batches only.</p></div>
      <input class="input filter" [formControl]="q" placeholder="Search students" aria-label="Search students" /></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Student</th><th>Email</th><th>Course</th><th>Batch</th><th>Status</th></tr></thead>
        <tbody>@for (s of filtered(); track s.enrollmentId) { <tr><td class="cell-title">{{ s.fullName }}</td><td><a [href]="'mailto:' + s.email">{{ s.email }}</a></td><td>{{ s.courseTitle }}</td><td>{{ s.batchName }}</td><td><app-status-badge [status]="s.status" /></td></tr> }</tbody>
      </table></div>
      @if (!filtered().length) { <app-empty-state icon="users" title="No students yet" message="Students appear here once their enrollment in your batch is approved." /> }
    }
  `,
  styles: ['.filter { width: auto; min-width: 220px; }'],
})
export class TrainerStudentsComponent implements OnInit {
  private portal = inject(TrainerPortalService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<TrainerStudent[]>([]);
  q = new FormControl('', { nonNullable: true });
  private term = signal('');
  filtered = computed(() => {
    const t = this.term().toLowerCase();
    return this.items().filter((s) => !t || `${s.fullName} ${s.email} ${s.batchName} ${s.courseTitle}`.toLowerCase().includes(t));
  });
  ngOnInit(): void { this.q.valueChanges.subscribe((v) => this.term.set(v)); this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.portal.students().subscribe({ next: (s) => { this.items.set(s); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
}
