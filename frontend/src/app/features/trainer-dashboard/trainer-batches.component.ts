import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Batch, SessionRecord } from '../../core/models/models';
import { TrainerPortalService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { applyServerErrors, todayLocal } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-trainer-batches',
  standalone: true,
  imports: [ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My batches</h1><p>Batch details and session completion records.</p></div></div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="grid grid-2">
        @for (b of batches(); track b.id) {
          <article class="card">
            <div class="flex between"><h3 class="mb-0">{{ b.name }}</h3><app-status-badge [status]="b.status" /></div>
            <p class="muted small">{{ b.courseTitle }}</p>
            <dl class="kv"><dt>Dates</dt><dd>{{ b.startDate }} to {{ b.endDate }}</dd><dt>Timing</dt><dd>{{ b.days.join(', ') }} &middot; {{ b.startTime }}-{{ b.endTime }}</dd>
              <dt>Mode</dt><dd>{{ b.mode }}{{ b.location ? ' · ' + b.location : '' }}</dd><dt>Seats</dt><dd>{{ b.seatsTaken }} / {{ b.capacity }}</dd>
              <dt>Sessions logged</dt><dd>{{ countFor(b.id) }}</dd></dl>
            <button type="button" class="btn btn-sm btn-primary mt-2" (click)="openRecord(b)">Record session</button>
          </article>
        }
      </div>
      @if (!batches().length) { <app-empty-state icon="layers" title="No batches assigned" message="An administrator assigns trainers to batches." /> }
      <section class="card mt-3">
        <h3>Session completion records</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Batch</th><th>Topic</th><th>Attendees</th><th>Notes</th></tr></thead>
          <tbody>@for (s of sessions(); track s.id) { <tr><td>{{ s.date }}</td><td>{{ s.batchName }}</td><td class="cell-title">{{ s.topic }}</td><td>{{ s.attendeesCount ?? '-' }}</td><td class="small">{{ s.notes || '-' }}</td></tr> }</tbody></table></div>
        @if (!sessions().length) { <p class="muted mt-2 mb-0">No sessions recorded yet.</p> }
      </section>
    }
    @if (recordFor(); as b) {
      <app-modal [title]="'Record session: ' + b.name" (close)="recordFor.set(null)">
        <form [formGroup]="form" (ngSubmit)="save(b)" class="form-grid">
          <div class="field"><label for="s-date">Date</label><input id="s-date" type="date" class="input" formControlName="date" [max]="today" /><app-field-error [control]="form.controls.date" label="Date" /></div>
          <div class="field"><label for="s-att">Attendees</label><input id="s-att" type="number" min="0" class="input" formControlName="attendeesCount" /></div>
          <div class="field full"><label for="s-topic">Topic covered</label><input id="s-topic" class="input" formControlName="topic" maxlength="200" /><app-field-error [control]="form.controls.topic" label="Topic" /></div>
          <div class="field full"><label for="s-notes">Notes</label><textarea id="s-notes" class="textarea" formControlName="notes" maxlength="1500"></textarea></div>
          <div class="full form-actions"><button type="button" class="btn btn-ghost" (click)="recordFor.set(null)">Cancel</button><button type="submit" class="btn btn-primary" [disabled]="saving()">Save record</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class TrainerBatchesComponent implements OnInit {
  private portal = inject(TrainerPortalService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly today = todayLocal();
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  batches = signal<Batch[]>([]);
  sessions = signal<SessionRecord[]>([]);
  recordFor = signal<Batch | null>(null);
  saving = signal(false);
  form = this.fb.group({
    date: [this.today, Validators.required],
    topic: ['', [Validators.required, Validators.maxLength(200)]],
    notes: [''],
    attendeesCount: [null as number | null, Validators.min(0)],
  });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    forkJoin({ batches: this.portal.batches(), sessions: this.portal.sessions() }).subscribe({
      next: (r) => { this.batches.set(r.batches); this.sessions.set(r.sessions); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  countFor(batchId: string): number { return this.sessions().filter((s) => s.batchId === batchId).length; }
  openRecord(b: Batch): void { this.form.reset({ date: this.today, topic: '', notes: '', attendeesCount: null }); this.recordFor.set(b); }
  save(b: Batch): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.portal.recordSession({ batchId: b.id, date: v.date, topic: v.topic, notes: v.notes || null, attendeesCount: v.attendeesCount ?? null }).subscribe({
      next: (s) => { this.saving.set(false); this.recordFor.set(null); this.sessions.update((l) => [s, ...l]); this.toast.success('Session recorded'); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); applyServerErrors(this.form, e); this.toast.error(e.message); },
    });
  }
}
