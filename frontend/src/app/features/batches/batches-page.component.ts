import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Batch, Course } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { BatchService, CourseService, EnrollmentService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-batches-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeroComponent, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Batches & schedule" title="Upcoming batches" subtitle="Compare start dates, timings and seats. Request enrollment in a couple of clicks." />
    <section class="section-sm">
      <div class="container">
        <form class="toolbar" [formGroup]="filters">
          <label class="sr-only" for="bcourse">Course</label>
          <select id="bcourse" class="select" formControlName="courseId"><option value="">All courses</option>@for (c of courses(); track c.id) { <option [value]="c.id">{{ c.title }}</option> }</select>
          <label class="sr-only" for="bmode">Mode</label>
          <select id="bmode" class="select" formControlName="mode"><option value="">Any mode</option><option>Online</option><option>Offline</option><option>Hybrid</option></select>
          <label class="sr-only" for="bstatus">Status</label>
          <select id="bstatus" class="select" formControlName="status"><option value="">Upcoming &amp; ongoing</option><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select>
        </form>
        @if (loading()) { <app-loader label="Loading batches..." /> }
        @else if (error()) { <app-alert type="error" title="Could not load batches" (retry)="load()">{{ error()?.message }}</app-alert> }
        @else {
          <div class="grid grid-2">
            @for (b of visible(); track b.id) {
              <article class="card batch">
                <div class="flex between"><span class="eyebrow mb-0">{{ b.mode }}</span><app-status-badge [status]="b.status" /></div>
                <h3 class="mt-2 mb-0"><a [routerLink]="['/courses', b.courseSlug]">{{ b.courseTitle }}</a></h3>
                <p class="muted mb-2">{{ b.name }} &middot; Trainer: {{ b.trainerName }}</p>
                <div class="facts">
                  <span><app-icon name="calendar" [size]="15" /> Starts {{ b.startDate }}</span>
                  <span><app-icon name="clock" [size]="15" /> {{ b.startTime }}-{{ b.endTime }}</span>
                  <span><app-icon name="layers" [size]="15" /> {{ b.days.join(', ') }}</span>
                  <span><app-icon name="book" [size]="15" /> {{ b.courseDuration }}</span>
                </div>
                <div class="seats"><div class="bar"><span [style.width.%]="pct(b)"></span></div>
                  <small>{{ b.isFull ? 'Batch full' : b.availableSeats + ' of ' + b.capacity + ' seats available' }}</small></div>
                <div class="flex flex-wrap mt-2">
                  <button type="button" class="btn btn-sm btn-outline" (click)="detail.set(b)">View details</button>
                  <button type="button" class="btn btn-sm btn-primary" [disabled]="b.isFull || b.status === 'completed'" (click)="requestEnroll(b)">Request enrollment</button>
                </div>
              </article>
            }
          </div>
          @if (!visible().length) { <app-empty-state icon="calendar" title="No batches match" message="Try another course or mode, or book a consultation to hear about new batches." actionLabel="Book a consultation" actionLink="/appointments" /> }
        }
      </div>
    </section>
    @if (detail(); as b) {
      <app-modal [title]="b.name" (close)="detail.set(null)">
        <dl class="kv">
          <dt>Course</dt><dd>{{ b.courseTitle }}</dd><dt>Trainer</dt><dd>{{ b.trainerName }}</dd>
          <dt>Dates</dt><dd>{{ b.startDate }} to {{ b.endDate }}</dd><dt>Weekly schedule</dt><dd>{{ b.days.join(', ') }}</dd>
          <dt>Class timings</dt><dd>{{ b.startTime }} - {{ b.endTime }}</dd><dt>Duration</dt><dd>{{ b.courseDuration }}</dd>
          <dt>Mode</dt><dd>{{ b.mode }}</dd><dt>Location</dt><dd>{{ b.location || 'To be shared' }}</dd>
          <dt>Seats</dt><dd>{{ b.availableSeats }} available of {{ b.capacity }}</dd><dt>Status</dt><dd><app-status-badge [status]="b.status" /></dd>
        </dl>
        @if (b.notes) { <p class="muted mt-2">{{ b.notes }}</p> }
        <div class="form-actions mt-3"><a class="btn btn-ghost" [routerLink]="['/courses', b.courseSlug]">Course page</a>
          <button type="button" class="btn btn-primary" [disabled]="b.isFull" (click)="requestEnroll(b)">Request enrollment</button></div>
      </app-modal>
    }
  `,
  styles: [`
    .batch h3 a { color: var(--navy-900); }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9rem; color: var(--ink-2); }
    .facts span { display: inline-flex; gap: 6px; align-items: center; }
    .seats { margin-top: 14px; } .bar { height: 8px; border-radius: 99px; background: var(--navy-100); overflow: hidden; margin-bottom: 4px; }
    .bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--accent)); }
    .seats small { color: var(--ink-3); }
  `],
})
export class BatchesPageComponent implements OnInit {
  private batchService = inject(BatchService);
  private courseService = inject(CourseService);
  private enrollments = inject(EnrollmentService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  batches = signal<Batch[]>([]);
  visible = signal<Batch[]>([]);
  courses = signal<Course[]>([]);
  detail = signal<Batch | null>(null);
  filters = this.fb.nonNullable.group({ courseId: '', mode: '', status: '' });

  ngOnInit(): void {
    this.filters.valueChanges.subscribe(() => this.applyFilters());
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ batches: this.batchService.list(), courses: this.courseService.list({ sort: 'title' }) }).subscribe({
      next: (r) => { this.batches.set(r.batches); this.courses.set(r.courses.items); this.applyFilters(); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }

  applyFilters(): void {
    const f = this.filters.getRawValue();
    this.visible.set(this.batches().filter((b) =>
      (!f.courseId || b.courseId === f.courseId) && (!f.mode || b.mode === f.mode) && (f.status ? b.status === f.status : ['upcoming', 'ongoing'].includes(b.status))));
  }

  pct(b: Batch): number { return b.capacity ? Math.round(((b.seatsTaken || 0) / b.capacity) * 100) : 0; }

  async requestEnroll(b: Batch): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Log in or register as a student to request enrollment.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/batches' } });
      return;
    }
    if (this.auth.role() !== 'student') { this.toast.info('Enrollment requests are made from student accounts.'); return; }
    const ok = await this.confirm.ask({ title: 'Request enrollment', message: `Request a seat in "${b.name}" for ${b.courseTitle}? Our team will review and confirm.`, confirmText: 'Send request' });
    if (!ok) return;
    this.enrollments.request(b.courseId, b.id).subscribe({
      next: () => { this.detail.set(null); this.toast.success('Enrollment requested. Track it in My Courses.'); this.load(); },
      error: (e: ApiErrorInfo) => this.toast.error(e.message),
    });
  }
}
