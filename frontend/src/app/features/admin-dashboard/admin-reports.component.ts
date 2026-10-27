import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiErrorInfo, Report } from '../../core/models/models';
import { AdminService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';
import { downloadBlob } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, KeyValuePipe, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Reports</h1><p>Registration, enrollment, appointment and inquiry reports with date filters and CSV export.</p></div></div>
    <form class="card toolbar" [formGroup]="form" (ngSubmit)="run()">
      <div class="field"><label for="r-type">Report</label><select id="r-type" class="select" formControlName="type">@for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }</select></div>
      <div class="field"><label for="r-from">From</label><input id="r-from" type="date" class="input" formControlName="from" /></div>
      <div class="field"><label for="r-to">To</label><input id="r-to" type="date" class="input" formControlName="to" /></div>
      <div class="flex btns"><button type="submit" class="btn btn-primary" [disabled]="loading()"><app-icon name="chart" [size]="16" /> Generate</button>
        <button type="button" class="btn btn-outline" [disabled]="exporting()" (click)="exportCsv()"><app-icon name="download" [size]="16" /> {{ exporting() ? 'Exporting...' : 'Export CSV' }}</button></div>
    </form>
    @if (loading()) { <app-loader label="Building report..." /> }
    @else if (error()) { <app-alert type="error" (retry)="run()">{{ error()?.message }}</app-alert> }
    @else if (report()) {
      <div class="flex flex-wrap mb-2 summary"><span class="badge badge-info">{{ report()!.summary.total }} record(s)</span>
        @for (s of report()!.summary.byStatus | keyvalue; track s.key) { <span class="badge">{{ s.key }}: {{ s.value }}</span> }</div>
      @if (report()!.rows.length) {
        <div class="table-wrap"><table class="table">
          <thead><tr>@for (c of report()!.columns; track c.key) { <th>{{ c.label }}</th> }</tr></thead>
          <tbody>@for (row of report()!.rows.slice(0, 200); track $index) { <tr>@for (c of report()!.columns; track c.key) { <td>{{ isDate(c.key) ? (str(row[c.key]) | date: 'short') : str(row[c.key]) }}</td> }</tr> }</tbody>
        </table></div>
        @if (report()!.rows.length > 200) { <p class="muted small mt-2">Showing the first 200 rows. Export CSV for the full report.</p> }
      } @else { <app-empty-state icon="chart" title="No records in this range" message="Try widening the date range." /> }
    } @else { <app-empty-state icon="chart" title="Choose a report" message="Pick a report type and optional date range, then Generate." /> }
  `,
  styles: ['.toolbar { align-items: flex-end; } .toolbar .field { flex: 1 1 160px; } .btns { margin-left: auto; } .summary { gap: 8px; }'],
})
export class AdminReportsComponent {
  private admin = inject(AdminService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly types = [
    { value: 'registrations', label: 'Student registrations' }, { value: 'enrollments', label: 'Course enrollments' },
    { value: 'appointments', label: 'Appointments' }, { value: 'inquiries', label: 'Inquiries' },
  ];
  loading = signal(false);
  exporting = signal(false);
  error = signal<ApiErrorInfo | null>(null);
  report = signal<Report | null>(null);
  form = this.fb.nonNullable.group({ type: 'registrations', from: '', to: '' });

  str(v: unknown): string { return v === null || v === undefined ? '' : String(v); }
  isDate(key: string): boolean { return key === 'createdAt'; }

  run(): void {
    const v = this.form.getRawValue();
    this.loading.set(true); this.error.set(null);
    this.admin.report(v.type, v.from || undefined, v.to || undefined).subscribe({
      next: (r) => { this.report.set(r); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }

  exportCsv(): void {
    const v = this.form.getRawValue();
    this.exporting.set(true);
    this.admin.reportCsv(v.type, v.from || undefined, v.to || undefined).subscribe({
      next: (blob) => { this.exporting.set(false); downloadBlob(blob, `${v.type}-report${v.from ? '-' + v.from : ''}${v.to ? '-to-' + v.to : ''}.csv`); },
      error: (e: ApiErrorInfo) => { this.exporting.set(false); this.toast.error(e.status === 400 ? 'Check the date range.' : e.message || 'Export failed'); },
    });
  }
}
