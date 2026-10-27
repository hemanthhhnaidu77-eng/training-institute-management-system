import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, Review } from '../../core/models/models';
import { AdminService } from '../../core/services/domain.services';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Reviews</h1><p>Approve student course reviews before they're published. Optionally promote them to testimonials.</p></div>
      <div class="flex flex-wrap"><a routerLink="/admin/testimonials" class="btn btn-outline btn-sm">Manage testimonials</a><a routerLink="/admin/faqs" class="btn btn-outline btn-sm">Manage FAQs</a></div></div>
    <div class="toolbar"><select class="select" [formControl]="status" aria-label="Filter status"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="stack">
        @for (r of items(); track r.id) {
          <article class="card">
            <div class="flex between flex-wrap"><div><strong>{{ r.studentName }}</strong> <span class="muted">on {{ r.courseTitle }}</span>
              <span class="stars">@for (s of stars(r.rating); track $index) { <app-icon name="star" [size]="14" /> }</span></div><app-status-badge [status]="r.status || 'pending'" /></div>
            <p class="mt-2">{{ r.comment }}</p>
            <div class="flex flex-wrap between"><span class="muted small">{{ r.createdAt | date: 'medium' }}{{ r.testimonialId ? ' · published as testimonial' : '' }}</span>
              <div class="flex flex-wrap">
                @if (r.status !== 'approved') { <button type="button" class="btn btn-sm btn-success" (click)="moderate(r, 'approved', false)">Approve</button><button type="button" class="btn btn-sm btn-outline" (click)="moderate(r, 'approved', true)">Approve + testimonial</button> }
                @if (r.status !== 'rejected') { <button type="button" class="btn btn-sm btn-ghost" (click)="moderate(r, 'rejected', false)">Reject</button> }
                <button type="button" class="btn btn-sm btn-ghost danger" (click)="remove(r)">Delete</button>
              </div></div>
          </article>
        } @empty { <app-empty-state icon="star" title="Nothing to moderate" message="New student reviews will appear here." /> }
      </div>
    }
  `,
  styles: ['.stars { color: var(--accent); display: inline-flex; gap: 1px; vertical-align: middle; margin-left: 6px; } .danger { color: var(--danger); }'],
})
export class AdminReviewsComponent implements OnInit {
  private admin = inject(AdminService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Review[]>([]);
  status = new FormControl('pending', { nonNullable: true });

  ngOnInit(): void { this.status.valueChanges.subscribe(() => this.load()); this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.admin.reviews(this.status.value || undefined).subscribe({ next: (r) => { this.items.set(r); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
  stars(n: number): number[] { return Array.from({ length: n }); }
  moderate(r: Review, status: string, publish: boolean): void {
    this.admin.moderateReview(r.id, status, publish).subscribe({ next: () => { this.toast.success(`Review ${status}${publish ? ' and published as testimonial' : ''}`); this.load(); }, error: (e: ApiErrorInfo) => this.toast.error(e.message) });
  }
  async remove(r: Review): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Delete review?', message: 'This permanently removes the review.', confirmText: 'Delete', danger: true }))) return;
    this.admin.deleteReview(r.id).subscribe({ next: () => { this.toast.success('Review deleted'); this.load(); }, error: (e: ApiErrorInfo) => this.toast.error(e.message) });
  }
}
