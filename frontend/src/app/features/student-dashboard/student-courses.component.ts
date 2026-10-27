import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Enrollment, Review } from '../../core/models/models';
import { ConfirmService } from '../../core/services/confirm.service';
import { ContentService, EnrollmentService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-student-courses',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My courses</h1><p>Enrollment requests, approved courses and completion records.</p></div><a routerLink="/courses" class="btn btn-primary btn-sm">Browse courses</a></div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="grid grid-2">
        @for (e of enrollments(); track e.id) {
          <article class="card">
            <div class="flex between"><h3 class="mb-0"><a [routerLink]="['/courses', e.courseSlug]">{{ e.courseTitle }}</a></h3><app-status-badge [status]="e.status" /></div>
            <dl class="kv mt-2">
              <dt>Batch</dt><dd>{{ e.batch ? e.batch.name + ' (' + e.batch.startDate + ')' : 'To be assigned' }}</dd>
              @if (e.batch) { <dt>Timing</dt><dd>{{ e.batch.days.join(', ') }} &middot; {{ e.batch.startTime }}-{{ e.batch.endTime }} &middot; {{ e.batch.mode }}</dd> }
              @if (e.trainerName) { <dt>Trainer</dt><dd>{{ e.trainerName }}</dd> }
              <dt>Requested</dt><dd>{{ e.createdAt | date: 'mediumDate' }}</dd>
              @if (e.adminNote) { <dt>Note from institute</dt><dd>{{ e.adminNote }}</dd> }
            </dl>
            @if (e.status === 'completed' && e.certificateNo) {
              <div class="cert mt-2"><app-icon name="award" [size]="22" /><div><strong>Completion record</strong><div class="small">No. {{ e.certificateNo }} &middot; completed {{ e.completedAt | date: 'mediumDate' }}</div></div></div>
            }
            <div class="flex flex-wrap mt-2">
              @if (e.status === 'pending') { <button type="button" class="btn btn-sm btn-ghost" (click)="withdraw(e)">Withdraw request</button> }
              @if ((e.status === 'approved' || e.status === 'completed') && !reviewed(e.courseId)) { <button type="button" class="btn btn-sm btn-outline" (click)="openReview(e)"><app-icon name="star" [size]="14" /> Write a review</button> }
              @if (reviewed(e.courseId); as r) { <span class="small muted">Your review: <app-status-badge [status]="r.status || 'pending'" /></span> }
            </div>
          </article>
        }
      </div>
      @if (!enrollments().length) { <app-empty-state icon="book" title="You haven't enrolled yet" message="Explore our catalogue and request enrollment in a course that fits your goals." actionLabel="Explore courses" actionLink="/courses" /> }
    }
    @if (reviewFor(); as e) {
      <app-modal [title]="'Review: ' + e.courseTitle" (close)="reviewFor.set(null)">
        <form [formGroup]="reviewForm" (ngSubmit)="submitReview(e)" class="stack">
          <div class="field"><span class="label">Rating</span>
            <div class="stars" role="radiogroup" aria-label="Rating">@for (n of [1, 2, 3, 4, 5]; track n) {
              <button type="button" class="star" [class.on]="n <= reviewForm.controls.rating.value" (click)="reviewForm.controls.rating.setValue(n)" [attr.aria-label]="n + ' stars'" role="radio" [attr.aria-checked]="n === reviewForm.controls.rating.value"><app-icon name="star" [size]="26" /></button> }</div></div>
          <div class="field"><label for="comment">Your feedback</label><textarea id="comment" class="textarea" formControlName="comment" maxlength="1500" placeholder="What did you like? What could be better?"></textarea><app-field-error [control]="reviewForm.controls.comment" label="Feedback" /></div>
          <p class="muted small mb-0">Reviews are published after moderation.</p>
          <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="reviewFor.set(null)">Cancel</button><button type="submit" class="btn btn-primary" [disabled]="saving()">Submit review</button></div>
        </form>
      </app-modal>
    }
  `,
  styles: [`
    h3 a { color: var(--navy-900); }
    .cert { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 12px; background: var(--accent-100); color: var(--navy-900); }
    .cert app-icon { color: var(--accent-600); }
    .stars { display: flex; gap: 4px; } .star { background: none; border: none; cursor: pointer; color: var(--line); padding: 2px; } .star.on { color: var(--accent); }
  `],
})
export class StudentCoursesComponent implements OnInit {
  private enrollmentService = inject(EnrollmentService);
  private content = inject(ContentService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  enrollments = signal<Enrollment[]>([]);
  reviews = signal<Review[]>([]);
  reviewFor = signal<Enrollment | null>(null);
  saving = signal(false);
  reviewForm = this.fb.nonNullable.group({ rating: [5, [Validators.min(1), Validators.max(5)]], comment: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1500)]] });
  private reviewMap = computed(() => new Map(this.reviews().filter((r) => r.status !== 'rejected').map((r) => [r.courseId, r])));

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ enrollments: this.enrollmentService.mine(), reviews: this.content.myReviews() }).subscribe({
      next: (r) => { this.enrollments.set(r.enrollments); this.reviews.set(r.reviews); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  reviewed(courseId: string): Review | undefined { return this.reviewMap().get(courseId); }

  async withdraw(e: Enrollment): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Withdraw request?', message: `Withdraw your enrollment request for ${e.courseTitle}?`, confirmText: 'Withdraw', danger: true }))) return;
    this.enrollmentService.withdraw(e.id).subscribe({ next: () => { this.toast.success('Request withdrawn'); this.load(); }, error: (err: ApiErrorInfo) => this.toast.error(err.message) });
  }
  openReview(e: Enrollment): void { this.reviewForm.reset({ rating: 5, comment: '' }); this.reviewFor.set(e); }
  submitReview(e: Enrollment): void {
    if (this.reviewForm.invalid) { this.reviewForm.markAllAsTouched(); return; }
    this.saving.set(true);
    this.content.submitReview({ courseId: e.courseId, ...this.reviewForm.getRawValue() }).subscribe({
      next: () => { this.saving.set(false); this.reviewFor.set(null); this.toast.success('Thanks! Your review was sent for moderation.'); this.load(); },
      error: (err: ApiErrorInfo) => { this.saving.set(false); this.toast.error(err.message); },
    });
  }
}
