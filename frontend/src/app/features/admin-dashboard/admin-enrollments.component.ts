import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { ApiErrorInfo, Batch, Enrollment, PageMeta } from '../../core/models/models';
import { BatchService, EnrollmentService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, PaginationComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';

const NEXT: Record<string, { status: string; label: string; cls: string }[]> = {
  pending: [{ status: 'approved', label: 'Approve', cls: 'btn-success' }, { status: 'rejected', label: 'Reject', cls: 'btn-outline' }],
  approved: [{ status: 'completed', label: 'Mark completed', cls: 'btn-primary' }, { status: 'cancelled', label: 'Cancel', cls: 'btn-outline' }],
  rejected: [{ status: 'pending', label: 'Reopen', cls: 'btn-outline' }],
  cancelled: [{ status: 'pending', label: 'Reopen', cls: 'btn-outline' }],
  completed: [],
};

@Component({
  selector: 'app-admin-enrollments',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Enrollments</h1><p>Review requests, assign batches and track progress.</p></div></div>
    <form class="toolbar" [formGroup]="filters">
      <input class="input" formControlName="q" placeholder="Search student or course" aria-label="Search enrollments" />
      <select class="select" formControlName="status" aria-label="Status"><option value="">All statuses</option>@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select>
    </form>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Student</th><th>Course</th><th>Batch</th><th>Requested</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>@for (e of items(); track e.id) {
          <tr><td><div class="cell-title">{{ e.studentName }}</div><div class="muted small">{{ e.studentEmail }}</div></td><td>{{ e.courseTitle }}@if (e.note) { <div class="muted small">"{{ e.note }}"</div> }</td>
            <td>{{ e.batch?.name || 'Not assigned' }}</td><td>{{ e.createdAt | date: 'mediumDate' }}</td><td><app-status-badge [status]="e.status" /></td>
            <td><div class="actions">@for (a of next(e.status); track a.status) { <button type="button" class="btn btn-sm" [class]="'btn btn-sm ' + a.cls" (click)="open(e, a.status)">{{ a.label }}</button> }</div></td></tr>
        }</tbody></table></div>
      @if (!items().length) { <app-empty-state icon="graduation" title="No enrollment requests" message="Requests from students will appear here." /> }
      <app-pagination [page]="meta().page || 1" [totalPages]="meta().totalPages || 1" [total]="meta().total" (pageChange)="page.set($event); load()" />
    }
    @if (action(); as a) {
      <app-modal [title]="'Set enrollment to ' + a.status" (close)="action.set(null)">
        <p><strong>{{ a.enrollment.studentName }}</strong> &middot; {{ a.enrollment.courseTitle }}</p>
        @if (a.status === 'approved' || a.status === 'completed') {
          <div class="field mb-2"><label for="batch">Assign batch</label>
            <select id="batch" class="select" [formControl]="batchCtrl"><option value="">No batch yet</option>
              @for (b of batches(); track b.id) { <option [value]="b.id" [disabled]="b.isFull && b.id !== a.enrollment.batchId">{{ b.name }} &middot; {{ b.startDate }} &middot; {{ b.availableSeats }} seats left</option> }</select></div>
        }
        <div class="field mb-2"><label for="note">Note to student (optional)</label><textarea id="note" class="textarea" [formControl]="noteCtrl" maxlength="1000"></textarea></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="action.set(null)">Cancel</button><button type="button" class="btn btn-primary" [disabled]="saving()" (click)="apply()">Confirm</button></div>
      </app-modal>
    }
  `,
})
export class AdminEnrollmentsComponent implements OnInit {
  private service = inject(EnrollmentService);
  private batchService = inject(BatchService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly statuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Enrollment[]>([]);
  meta = signal<PageMeta>({ total: 0 });
  page = signal(1);
  batches = signal<Batch[]>([]);
  action = signal<{ enrollment: Enrollment; status: string } | null>(null);
  saving = signal(false);
  filters = this.fb.nonNullable.group({ q: '', status: 'pending' });
  batchCtrl = this.fb.nonNullable.control('');
  noteCtrl = this.fb.nonNullable.control('');

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }
  next(status: string) { return NEXT[status] || []; }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.adminList({ ...this.filters.getRawValue(), page: this.page(), limit: 15 }).subscribe({
      next: (r) => { this.items.set(r.items); this.meta.set(r.meta); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  open(enrollment: Enrollment, status: string): void {
    this.batchCtrl.setValue(enrollment.batchId || '');
    this.noteCtrl.setValue('');
    this.action.set({ enrollment, status });
    if (status === 'approved' || status === 'completed') {
      this.batchService.list({ courseId: enrollment.courseId }).subscribe({ next: (b) => this.batches.set(b.filter((x) => x.status !== 'cancelled')), error: () => this.batches.set([]) });
    }
  }
  apply(): void {
    const a = this.action();
    if (!a) return;
    this.saving.set(true);
    const body: { status: string; batchId?: string | null; adminNote?: string } = { status: a.status };
    if (a.status === 'approved' || a.status === 'completed') body.batchId = this.batchCtrl.value || null;
    if (this.noteCtrl.value) body.adminNote = this.noteCtrl.value;
    this.service.adminStatus(a.enrollment.id, body).subscribe({
      next: () => { this.saving.set(false); this.action.set(null); this.toast.success(`Enrollment ${a.status}`); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); this.toast.error(e.message); },
    });
  }
}
