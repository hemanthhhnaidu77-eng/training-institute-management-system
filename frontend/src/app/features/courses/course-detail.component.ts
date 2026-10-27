import { ChangeDetectionStrategy, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiErrorInfo, Course, Review } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { ContentService, CourseService, EnrollmentService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { courseArt } from '../../shared/components/content.components';
import { AlertComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { initials } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, IconComponent, InrPipe, LoaderComponent, AlertComponent, ModalComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) { <app-loader label="Loading course..." /> }
    @else if (error()) {
      <div class="container section"><app-alert type="error" [title]="error()?.status === 404 ? 'Course not found' : 'Could not load this course'" (retry)="load()">{{ error()?.message }}</app-alert>
      <a routerLink="/courses" class="btn btn-outline mt-3">Back to courses</a></div>
    } @else if (course()) {
      <section class="detail-hero" [style.background]="art(course()!).background">
        <div class="container hero-in">
          <div>
            <a routerLink="/courses" class="back"><app-icon name="chevron-left" [size]="16" /> All courses</a>
            <span class="eyebrow">{{ course()!.category }}</span>
            <h1>{{ course()!.title }}</h1>
            <p class="lead">{{ course()!.shortDescription }}</p>
            <div class="tag-list">
              <span class="badge">{{ course()!.level }}</span><span class="badge">{{ course()!.mode }}</span><span class="badge">{{ course()!.duration }}</span>
              @if (course()!.rating) { <span class="badge badge-accent"><app-icon name="star" [size]="12" /> {{ course()!.rating }} ({{ course()!.reviewCount }})</span> }
              @if (!course()!.enrollmentOpen) { <span class="badge badge-danger">Enrollment closed</span> }
            </div>
          </div>
          <aside class="card buy">
            <div class="price-row"><span class="price big">{{ (course()!.effectiveFee ?? course()!.fee) | inr }}</span>
              @if (course()!.discountedFee != null && course()!.discountedFee! < course()!.fee) { <span class="price-old">{{ course()!.fee | inr }}</span><span class="badge badge-accent">Save {{ (course()!.fee - (course()!.discountedFee || 0)) | inr }}</span> }</div>
            <p class="muted small">Fees in INR, exclusive of applicable taxes.</p>
            <button type="button" class="btn btn-accent w-full" [disabled]="!course()!.enrollmentOpen" (click)="startEnroll()">{{ course()!.enrollmentOpen ? 'Enroll Now' : 'Enrollment closed' }}</button>
            <a class="btn btn-outline w-full mt-2" routerLink="/appointments" [queryParams]="{ courseId: course()!.id, trainerId: course()!.trainerId }">Book Course Consultation</a>
            <ul class="facts">
              <li><app-icon name="clock" [size]="16" /> {{ course()!.duration }}</li>
              <li><app-icon name="monitor" [size]="16" /> {{ course()!.mode }} learning</li>
              <li><app-icon name="calendar" [size]="16" /> {{ course()!.batches?.length || 0 }} upcoming batch{{ (course()!.batches?.length || 0) === 1 ? '' : 'es' }}</li>
              @if (course()!.trainer; as trainer) { <li><app-icon name="user" [size]="16" /> {{ trainer.name }}</li> }
            </ul>
          </aside>
        </div>
      </section>

      <section class="section-sm">
        <div class="container layout">
          <div class="stack">
            <div class="card"><h2 class="h3">About this course</h2><p class="pre">{{ course()!.description }}</p></div>
            <div class="card">
              <h2 class="h3">Syllabus</h2>
              <ol class="syllabus">@for (s of course()!.syllabus; track $index) { <li><span>{{ $index + 1 }}</span>{{ s }}</li> }</ol>
            </div>
            <div class="grid grid-2">
              <div class="card"><h2 class="h3">Prerequisites</h2><ul class="list-check">@for (p of course()!.prerequisites; track $index) { <li>{{ p }}</li> } @empty { <li>None</li> }</ul></div>
              <div class="card"><h2 class="h3">Learning outcomes</h2><ul class="list-check">@for (o of course()!.outcomes; track $index) { <li>{{ o }}</li> }</ul></div>
            </div>
            <div class="card" id="batches">
              <h2 class="h3">Available batches</h2>
              @for (b of course()!.batches || []; track b.id) {
                <div class="batch">
                  <div class="grow"><div class="cell-title">{{ b.name }} <app-status-badge [status]="b.status" /></div>
                    <div class="muted small">{{ b.startDate }} to {{ b.endDate }} &middot; {{ b.days.join(', ') }} &middot; {{ b.startTime }}-{{ b.endTime }} &middot; {{ b.mode }}</div>
                    <div class="muted small">Trainer: {{ b.trainerName }}</div></div>
                  <span class="badge" [class.badge-danger]="b.isFull" [class.badge-success]="!b.isFull">{{ b.isFull ? 'Full' : b.availableSeats + ' seats left' }}</span>
                  <button type="button" class="btn btn-sm btn-primary" [disabled]="b.isFull || !course()!.enrollmentOpen" (click)="startEnroll(b.id)">Enroll</button>
                </div>
              } @empty { <p class="muted mb-0">No batches scheduled yet. You can still request enrollment and we'll assign you to the next batch.</p> }
            </div>
            <div class="card">
              <h2 class="h3">Student reviews</h2>
              @for (r of reviews(); track r.id) {
                <div class="review"><strong>{{ r.studentName }}</strong> <span class="stars">@for (s of stars(r.rating); track $index) { <app-icon name="star" [size]="13" /> }</span><p class="muted mb-0">{{ r.comment }}</p></div>
              } @empty { <p class="muted mb-0">No reviews yet. Enrolled students can review this course from their dashboard.</p> }
            </div>
          </div>
          @if (course()!.trainer; as t) {
            <aside class="card trainer">
              <span class="eyebrow">Your trainer</span>
              <div class="flex"><div class="avatar avatar-lg">@if (t.photoUrl) { <img [src]="t.photoUrl" [alt]="t.name" /> } @else { {{ initials(t.name) }} }</div>
                <div><h3 class="mb-0">{{ t.name }}</h3><p class="muted small mb-0">{{ t.designation }}</p></div></div>
              <p class="small mt-2">{{ t.bio }}</p>
              <div class="tag-list">@for (cert of t.certifications; track cert) { <span class="badge">{{ cert }}</span> }</div>
              <a routerLink="/appointments" [queryParams]="{ trainerId: t.id, courseId: course()!.id }" class="btn btn-outline btn-sm mt-3">Book a session</a>
            </aside>
          }
        </div>
      </section>

      @if (enrollOpen()) {
        <app-modal title="Request enrollment" (close)="enrollOpen.set(false)">
          <form [formGroup]="enrollForm" (ngSubmit)="submitEnroll(course()!)">
            <p class="muted">Course: <strong>{{ course()!.title }}</strong></p>
            <div class="field mb-2">
              <label for="batch">Preferred batch</label>
              <select id="batch" class="select" formControlName="batchId">
                <option value="">Assign me to the next available batch</option>
                @for (b of course()!.batches || []; track b.id) { <option [value]="b.id" [disabled]="b.isFull">{{ b.name }} &middot; starts {{ b.startDate }}{{ b.isFull ? ' (full)' : '' }}</option> }
              </select>
            </div>
            <div class="field mb-2"><label for="note">Note for admissions (optional)</label><textarea id="note" class="textarea" formControlName="note" maxlength="1000" placeholder="Background, preferred timing, questions..."></textarea></div>
            @if (enrollError()) { <app-alert type="error">{{ enrollError() }}</app-alert> }
            <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="enrollOpen.set(false)">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="submitting()">{{ submitting() ? 'Submitting...' : 'Submit request' }}</button></div>
          </form>
        </app-modal>
      }
    }
  `,
  styles: [`
    .detail-hero { color: #d7e2f0; padding: 40px 0 56px; }
    .hero-in { display: grid; grid-template-columns: 1fr 360px; gap: 40px; align-items: start; }
    .back { color: #c9d6e8; display: inline-flex; gap: 4px; align-items: center; margin-bottom: 16px; font-size: 0.9rem; }
    .back:hover { color: var(--accent); }
    h1 { color: var(--white); } .eyebrow { color: var(--accent); display: block; }
    .lead { font-size: 1.1rem; max-width: 640px; }
    .detail-hero .badge { background: rgba(255,255,255,0.14); color: var(--white); }
    .detail-hero .badge-accent { background: var(--accent); color: var(--navy-950); }
    .buy { position: relative; top: 8px; }
    .price-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .big { font-size: 1.8rem; }
    .facts { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 10px; font-size: 0.92rem; color: var(--ink-2); }
    .facts li { display: flex; gap: 8px; align-items: center; }
    .layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
    .trainer { position: sticky; top: calc(var(--nav-h) + 16px); }
    .h3 { font-size: 1.2rem; } .pre { white-space: pre-line; margin: 0; color: var(--ink-2); }
    .syllabus { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .syllabus li { display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: var(--navy-50); border-radius: 10px; }
    .syllabus span { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--navy-900); color: var(--white); display: grid; place-items: center; font-weight: 700; font-size: 0.85rem; }
    .batch { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .batch:last-child { border-bottom: none; } .grow { flex: 1; min-width: 220px; }
    .review { padding: 12px 0; border-bottom: 1px solid var(--line); } .review:last-child { border-bottom: none; }
    .stars { color: var(--accent); display: inline-flex; gap: 1px; vertical-align: middle; }
    @media (max-width: 960px) { .hero-in, .layout { grid-template-columns: 1fr; } .trainer { position: static; } }
  `],
})
export class CourseDetailComponent implements OnChanges {
  @Input() slug = '';
  private courseService = inject(CourseService);
  private content = inject(ContentService);
  private enrollments = inject(EnrollmentService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  course = signal<Course | null>(null);
  reviews = signal<Review[]>([]);
  enrollOpen = signal(false);
  submitting = signal(false);
  enrollError = signal('');
  enrollForm = this.fb.nonNullable.group({ batchId: '', note: '' });
  initials = initials;
  art = (c: Course) => courseArt(c.category);

  ngOnChanges(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.courseService.get(this.slug).subscribe({
      next: (c) => {
        this.course.set(c);
        this.loading.set(false);
        this.content.reviews(c.id).subscribe({ next: (r) => this.reviews.set(r), error: () => this.reviews.set([]) });
      },
      error: (e: ApiErrorInfo) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }

  stars(n: number): number[] { return Array.from({ length: n }); }

  startEnroll(batchId = ''): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.info('Please log in or create a free student account to enroll.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.auth.role() !== 'student') {
      this.toast.info('Enrollment requests are made from student accounts.');
      return;
    }
    this.enrollError.set('');
    this.enrollForm.setValue({ batchId, note: '' });
    this.enrollOpen.set(true);
  }

  submitEnroll(c: Course): void {
    const v = this.enrollForm.getRawValue();
    this.submitting.set(true);
    this.enrollments.request(c.id, v.batchId || null, v.note || undefined).subscribe({
      next: () => {
        this.submitting.set(false);
        this.enrollOpen.set(false);
        this.toast.success('Enrollment request submitted. Track it in My Courses.');
        this.router.navigate(['/student/courses']);
      },
      error: (e: ApiErrorInfo) => {
        this.submitting.set(false);
        this.enrollError.set(e.message);
      },
    });
  }
}
