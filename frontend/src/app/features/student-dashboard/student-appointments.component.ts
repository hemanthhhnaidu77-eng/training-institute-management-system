import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, Appointment, Availability } from '../../core/models/models';
import { AppointmentService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { notPastDate, todayLocal } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-student-appointments',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My appointments</h1><p>Upcoming and past consultations, with status history.</p></div><a routerLink="/appointments" class="btn btn-accent btn-sm">Book new</a></div>
    <div class="tabs">@for (t of tabs; track t.key) { <button type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }}</button> }</div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="stack">
        @for (a of filtered(); track a.id) {
          <article class="card">
            <div class="flex between flex-wrap">
              <div><div class="cell-title">{{ a.date }} at {{ a.time }} &middot; {{ a.mode }}</div><div class="muted small">ID {{ a.appointmentNo }}{{ a.trainerName ? ' · ' + a.trainerName : '' }}{{ a.courseTitle ? ' · ' + a.courseTitle : '' }}</div></div>
              <app-status-badge [status]="a.status" />
            </div>
            @if (a.requestedAction; as r) { <app-alert type="info" class="mt-2">You requested to {{ r.type }}{{ r.type === 'reschedule' ? ' to ' + r.date + ' at ' + r.time : '' }}. Awaiting the institute.</app-alert> }
            @if (a.adminNote) { <p class="small mt-2 mb-0"><strong>Note:</strong> {{ a.adminNote }}</p> }
            <details class="history mt-2"><summary class="small">Status history</summary>
              <ul>@for (h of a.statusHistory; track h.at) { <li class="small"><app-status-badge [status]="h.status" /> {{ h.at | date: 'medium' }} by {{ h.by }}{{ h.note ? ': ' + h.note : '' }}</li> }</ul></details>
            @if (isActive(a) && !a.requestedAction) {
              <div class="flex flex-wrap mt-2">
                <button type="button" class="btn btn-sm btn-outline" (click)="openReschedule(a)">{{ a.status === 'pending' ? 'Reschedule' : 'Request reschedule' }}</button>
                <button type="button" class="btn btn-sm btn-ghost danger" (click)="openCancel(a)">{{ a.status === 'pending' ? 'Cancel' : 'Request cancellation' }}</button>
              </div>
            }
          </article>
        } @empty { <app-empty-state icon="clock" title="No appointments here" message="Book a free consultation with a counsellor or trainer." actionLabel="Book an appointment" actionLink="/appointments" /> }
      </div>
    }

    @if (cancelFor(); as a) {
      <app-modal title="Cancel appointment" (close)="cancelFor.set(null)">
        <p>{{ a.status === 'pending' ? 'This will cancel your booking immediately.' : 'Your appointment is confirmed, so we will send a cancellation request to the institute.' }}</p>
        <div class="field mb-2"><label for="reason">Reason (optional)</label><textarea id="reason" class="textarea" [formControl]="reason" maxlength="500"></textarea></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="cancelFor.set(null)">Keep appointment</button><button type="button" class="btn btn-danger" [disabled]="saving()" (click)="confirmCancel(a)">Confirm</button></div>
      </app-modal>
    }
    @if (rescheduleFor(); as a) {
      <app-modal title="Reschedule appointment" (close)="rescheduleFor.set(null)">
        <form [formGroup]="rForm" (ngSubmit)="confirmReschedule(a)" class="stack">
          <div class="field"><label for="rdate">New date</label><input id="rdate" type="date" class="input" formControlName="date" [min]="today" (change)="loadSlots(a)" /></div>
          @if (slotsLoading()) { <app-loader [inline]="true" label="Checking slots..." /> }
          @else if (slots()) {
            @if (!slots()!.dayOpen) { <app-alert type="warning">{{ slots()!.reason }}</app-alert> }
            @else { <div class="slots">@for (s of slots()!.slots; track s.time) { <button type="button" class="slot" [class.selected]="rForm.controls.time.value === s.time" [disabled]="!s.available" (click)="rForm.controls.time.setValue(s.time)" [title]="s.reason || 'Available'">{{ s.time }}</button> }</div> }
          }
          <div class="field"><label for="rreason">Reason (optional)</label><input id="rreason" class="input" formControlName="reason" maxlength="500" /></div>
          @if (rError()) { <app-alert type="error">{{ rError() }}</app-alert> }
          <div class="form-actions"><button type="button" class="btn btn-ghost" (click)="rescheduleFor.set(null)">Close</button><button type="submit" class="btn btn-primary" [disabled]="saving() || rForm.invalid">{{ a.status === 'pending' ? 'Move appointment' : 'Send request' }}</button></div>
        </form>
      </app-modal>
    }
  `,
  styles: [`
    .history summary { cursor: pointer; color: var(--navy-700); } .history ul { list-style: none; padding: 8px 0 0; margin: 0; display: grid; gap: 6px; }
    .danger { color: var(--danger); }
    .slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .slot { min-height: 42px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--white); font-weight: 600; cursor: pointer; }
    .slot.selected { background: var(--navy-900); color: var(--white); border-color: var(--navy-900); }
    .slot[disabled] { background: #f2f4f8; color: #9aa6b8; cursor: not-allowed; text-decoration: line-through; }
  `],
})
export class StudentAppointmentsComponent implements OnInit {
  private service = inject(AppointmentService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly tabs = [{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past & cancelled' }, { key: 'all', label: 'All' }];
  readonly today = todayLocal();
  tab = signal('upcoming');
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Appointment[]>([]);
  cancelFor = signal<Appointment | null>(null);
  rescheduleFor = signal<Appointment | null>(null);
  slots = signal<Availability | null>(null);
  slotsLoading = signal(false);
  saving = signal(false);
  rError = signal('');
  reason = this.fb.nonNullable.control('');
  rForm = this.fb.nonNullable.group({ date: ['', [Validators.required, notPastDate]], time: ['', Validators.required], reason: [''] });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.mine().subscribe({
      next: (a) => { this.items.set(a); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  isActive(a: Appointment): boolean { return ['pending', 'confirmed', 'rescheduled'].includes(a.status); }
  filtered(): Appointment[] {
    const t = this.tab();
    if (t === 'all') return this.items();
    const upcoming = (a: Appointment) => this.isActive(a) && a.date >= this.today;
    return this.items().filter((a) => (t === 'upcoming' ? upcoming(a) : !upcoming(a)));
  }
  openCancel(a: Appointment): void { this.reason.setValue(''); this.cancelFor.set(a); }
  confirmCancel(a: Appointment): void {
    this.saving.set(true);
    this.service.cancel(a.id, this.reason.value).subscribe({
      next: (r) => { this.saving.set(false); this.cancelFor.set(null); this.toast.success(r.immediate ? 'Appointment cancelled' : 'Cancellation request sent'); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); this.toast.error(e.message); },
    });
  }
  openReschedule(a: Appointment): void { this.rForm.reset({ date: '', time: '', reason: '' }); this.slots.set(null); this.rError.set(''); this.rescheduleFor.set(a); }
  loadSlots(a: Appointment): void {
    const date = this.rForm.controls.date.value;
    this.rForm.controls.time.setValue('');
    if (!date || this.rForm.controls.date.invalid) return;
    this.slotsLoading.set(true);
    this.service.availability(date, a.trainerId).subscribe({
      next: (s) => { this.slots.set(s); this.slotsLoading.set(false); },
      error: (e: ApiErrorInfo) => { this.rError.set(e.message); this.slotsLoading.set(false); },
    });
  }
  confirmReschedule(a: Appointment): void {
    const v = this.rForm.getRawValue();
    this.saving.set(true);
    this.rError.set('');
    this.service.reschedule(a.id, v.date, v.time, v.reason).subscribe({
      next: (r) => { this.saving.set(false); this.rescheduleFor.set(null); this.toast.success(r.immediate ? 'Appointment moved' : 'Reschedule request sent'); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); this.rError.set(e.message); if (e.code === 'SLOT_UNAVAILABLE') this.loadSlots(a); },
    });
  }
}
