import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { ApiErrorInfo, PageMeta, StudentDetail, User } from '../../core/models/models';
import { AdminService } from '../../core/services/domain.services';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, PaginationComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { applyServerErrors, mobileValidator } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-admin-students',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, PaginationComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Students</h1><p>Search, view, edit and activate/deactivate student accounts.</p></div></div>
    <form class="toolbar" [formGroup]="filters">
      <input class="input" formControlName="q" placeholder="Search name, email or mobile" aria-label="Search students" />
      <select class="select" formControlName="status" aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
    </form>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Student</th><th>Mobile</th><th>Enrollments</th><th>Registered</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>@for (s of items(); track s.id) {
          <tr><td><div class="cell-title">{{ s.fullName }}</div><div class="muted small">{{ s.email }}</div></td><td>{{ s.mobile }}</td><td>{{ s.enrollmentCount }}</td><td>{{ s.createdAt | date: 'mediumDate' }}</td>
            <td><app-status-badge [status]="s.isActive ? 'active' : 'inactive'" /></td>
            <td><div class="actions"><button type="button" class="btn btn-sm btn-ghost" (click)="view(s)">View</button>
              <button type="button" class="btn btn-sm" [class.btn-outline]="s.isActive" [class.btn-success]="!s.isActive" (click)="toggleActive(s)">{{ s.isActive ? 'Deactivate' : 'Activate' }}</button></div></td></tr>
        }</tbody></table></div>
      @if (!items().length) { <app-empty-state icon="users" title="No students found" message="Students appear here after they register on the website." /> }
      <app-pagination [page]="meta().page || 1" [totalPages]="meta().totalPages || 1" [total]="meta().total" (pageChange)="page.set($event); load()" />
    }
    @if (detail(); as d) {
      <app-modal [title]="d.fullName" [wide]="true" (close)="detail.set(null)">
        <form [formGroup]="edit" (ngSubmit)="save(d)" class="form-grid mb-3">
          <div class="field"><label for="s-name">Full name</label><input id="s-name" class="input" formControlName="fullName" /><app-field-error [control]="edit.controls.fullName" label="Name" /></div>
          <div class="field"><label for="s-mobile">Mobile</label><input id="s-mobile" class="input" formControlName="mobile" /><app-field-error [control]="edit.controls.mobile" label="Mobile" /></div>
          <div class="field"><span class="label">Email</span><span>{{ d.email }}</span></div>
          <div class="field"><span class="label">Last login</span><span>{{ d.lastLoginAt ? (d.lastLoginAt | date: 'medium') : 'Never' }}</span></div>
          <div class="full form-actions"><button type="submit" class="btn btn-primary btn-sm" [disabled]="edit.pristine || saving()">Save changes</button></div>
        </form>
        <h4>Course enrollments</h4>
        <div class="table-wrap mb-3"><table class="table"><thead><tr><th>Course</th><th>Batch</th><th>Status</th><th>Requested</th></tr></thead>
          <tbody>@for (e of d.enrollments; track e.id) { <tr><td>{{ e.courseTitle }}</td><td>{{ e.batch?.name || '-' }}</td><td><app-status-badge [status]="e.status" /></td><td>{{ e.createdAt | date: 'mediumDate' }}</td></tr> }
          @empty { <tr><td colspan="4" class="muted">No enrollments</td></tr> }</tbody></table></div>
        <h4>Appointment history</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>When</th><th>Trainer</th><th>Status</th></tr></thead>
          <tbody>@for (a of d.appointments; track a.id) { <tr><td>{{ a.appointmentNo }}</td><td>{{ a.date }} {{ a.time }}</td><td>{{ a.trainerName || '-' }}</td><td><app-status-badge [status]="a.status" /></td></tr> }
          @empty { <tr><td colspan="4" class="muted">No appointments</td></tr> }</tbody></table></div>
      </app-modal>
    }
  `,
})
export class AdminStudentsComponent implements OnInit {
  private admin = inject(AdminService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private fb = inject(FormBuilder);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<User[]>([]);
  meta = signal<PageMeta>({ total: 0 });
  page = signal(1);
  detail = signal<StudentDetail | null>(null);
  saving = signal(false);
  filters = this.fb.nonNullable.group({ q: '', status: '' });
  edit = this.fb.nonNullable.group({ fullName: ['', [Validators.required, Validators.minLength(2)]], mobile: ['', [Validators.required, mobileValidator]] });

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.admin.students({ ...this.filters.getRawValue(), page: this.page(), limit: 15 }).subscribe({
      next: (r) => { this.items.set(r.items); this.meta.set(r.meta); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  view(s: User): void {
    this.admin.student(s.id).subscribe({
      next: (d) => { this.detail.set(d); this.edit.reset({ fullName: d.fullName, mobile: d.mobile }); },
      error: (e: ApiErrorInfo) => this.toast.error(e.message),
    });
  }
  save(d: StudentDetail): void {
    if (this.edit.invalid) { this.edit.markAllAsTouched(); return; }
    this.saving.set(true);
    this.admin.updateStudent(d.id, this.edit.getRawValue()).subscribe({
      next: (u) => { this.saving.set(false); this.detail.set({ ...d, ...u }); this.edit.markAsPristine(); this.toast.success('Student updated'); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); applyServerErrors(this.edit, e); this.toast.error(e.message); },
    });
  }
  async toggleActive(s: User): Promise<void> {
    const next = !s.isActive;
    if (!next && !(await this.confirm.ask({ title: `Deactivate ${s.fullName}?`, message: 'They will be signed out immediately and cannot log in until reactivated.', confirmText: 'Deactivate', danger: true }))) return;
    this.admin.updateStudent(s.id, { isActive: next }).subscribe({
      next: () => { this.toast.success(next ? 'Account activated' : 'Account deactivated'); this.load(); },
      error: (e: ApiErrorInfo) => this.toast.error(e.message),
    });
  }
}
