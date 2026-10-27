import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Settings, Trainer, User } from '../../core/models/models';
import { AdminService, SettingsService, TrainerService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, LoaderComponent, ModalComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { applyServerErrors, mobileValidator, passwordStrength } from '../../shared/utils/form-utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, LoaderComponent, AlertComponent, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>System settings</h1><p>Institute details, branding, appointment rules and staff accounts.</p></div></div>
    <div class="tabs">@for (t of tabs; track t) { <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">{{ t }}</button> }</div>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      @if (tab() !== 'Staff accounts') {
        <form [formGroup]="form" (ngSubmit)="save()" class="card">
          @if (tab() === 'Institute') {
            <div class="form-grid">
              <div class="field"><label for="s-name">Institute name</label><input id="s-name" class="input" formControlName="instituteName" /></div>
              <div class="field"><label for="s-tag">Tagline</label><input id="s-tag" class="input" formControlName="tagline" /></div>
              <div class="field"><label for="s-email">Email</label><input id="s-email" type="email" class="input" formControlName="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
              <div class="field"><label for="s-phone">Phone</label><input id="s-phone" class="input" formControlName="phone" /></div>
              <div class="field full"><label for="s-addr">Address</label><textarea id="s-addr" class="textarea" formControlName="address"></textarea></div>
              <div class="field"><label for="s-hours">Working hours</label><input id="s-hours" class="input" formControlName="workingHours" /></div>
              <div class="field"><label for="s-map">Google Maps embed URL</label><input id="s-map" class="input" formControlName="mapEmbedUrl" placeholder="https://www.google.com/maps/embed?..." /></div>
            </div>
          }
          @if (tab() === 'Social & branding') {
            <div class="form-grid" formGroupName="socials">
              @for (s of socialKeys; track s) { <div class="field"><label [for]="'so-' + s">{{ s }}</label><input [id]="'so-' + s" class="input" [formControlName]="s" placeholder="https://..." /></div> }
            </div>
            <hr class="divider" />
            <div class="form-grid" formGroupName="branding">
              <div class="field"><label for="b-logo">Logo text (max 6)</label><input id="b-logo" class="input" formControlName="logoText" maxlength="6" /></div>
              <div class="field"><label for="b-primary">Primary colour</label><input id="b-primary" type="color" class="input color" formControlName="primaryColor" /></div>
              <div class="field"><label for="b-accent">Accent colour</label><input id="b-accent" type="color" class="input color" formControlName="accentColor" /></div>
            </div>
            <p class="hint">Colours are stored for theming; the stylesheet tokens in styles.css define the live palette.</p>
          }
          @if (tab() === 'Appointments') {
            <div class="form-grid" formGroupName="appointment">
              <div class="field full"><label for="a-slots">Daily time slots (comma separated, HH:MM)</label><input id="a-slots" class="input" formControlName="slots" /></div>
              <div class="field full"><span class="label">Working days</span>
                <div class="days">@for (d of days; track d) { <label class="check"><input type="checkbox" [checked]="hasDay(d)" (change)="toggleDay(d)" /> {{ d }}</label> }</div></div>
              <div class="field"><label for="a-len">Slot length (minutes)</label><input id="a-len" type="number" class="input" formControlName="slotMinutes" min="15" max="120" /></div>
              <div class="field"><label for="a-cap">Counsellors per slot (no trainer chosen)</label><input id="a-cap" type="number" class="input" formControlName="counselorsPerSlot" min="1" max="20" /></div>
              <div class="field"><label for="a-win">Booking window (days ahead)</label><input id="a-win" type="number" class="input" formControlName="bookingWindowDays" min="1" max="180" /></div>
            </div>
          }
          @if (saveError()) { <app-alert type="error" class="mt-2">{{ saveError() }}</app-alert> }
          <div class="form-actions mt-3"><button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save settings' }}</button></div>
        </form>
      } @else {
        <section class="card">
          <div class="flex between mb-2"><div><h3 class="mb-0">Staff accounts</h3><p class="muted small mb-0">Admin and trainer logins are created here only (public registration creates students).</p></div>
            <button type="button" class="btn btn-primary btn-sm" (click)="openStaff()">Create staff account</button></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th></tr></thead>
            <tbody>@for (u of staff(); track u.id) { <tr><td class="cell-title">{{ u.fullName }}</td><td>{{ u.email }}</td><td><span class="badge">{{ u.role }}</span></td><td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'Never' }}</td><td><span class="badge" [class.badge-success]="u.isActive" [class.badge-danger]="!u.isActive">{{ u.isActive ? 'Active' : 'Inactive' }}</span></td></tr> }</tbody></table></div>
        </section>
      }
    }
    @if (staffOpen()) {
      <app-modal title="Create staff account" (close)="staffOpen.set(false)">
        <form [formGroup]="staffForm" (ngSubmit)="createStaff()" class="form-grid">
          <div class="field"><label for="st-role">Role</label><select id="st-role" class="select" formControlName="role"><option value="trainer">Trainer</option><option value="admin">Administrator</option></select></div>
          @if (staffForm.controls.role.value === 'trainer') {
            <div class="field"><label for="st-trainer">Trainer profile</label><select id="st-trainer" class="select" formControlName="trainerId"><option value="">Select...</option>@for (t of unlinkedTrainers(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select><app-field-error [control]="staffForm.controls.trainerId" label="Trainer profile" /></div>
          }
          <div class="field full"><label for="st-name">Full name</label><input id="st-name" class="input" formControlName="fullName" /><app-field-error [control]="staffForm.controls.fullName" label="Full name" /></div>
          <div class="field"><label for="st-email">Email</label><input id="st-email" type="email" class="input" formControlName="email" /><app-field-error [control]="staffForm.controls.email" label="Email" /></div>
          <div class="field"><label for="st-mobile">Mobile</label><input id="st-mobile" class="input" formControlName="mobile" /><app-field-error [control]="staffForm.controls.mobile" label="Mobile" /></div>
          <div class="field full"><label for="st-pw">Temporary password</label><input id="st-pw" type="password" class="input" formControlName="password" autocomplete="new-password" /><span class="hint">Share it securely; ask the user to change it after first login.</span><app-field-error [control]="staffForm.controls.password" label="Password" /></div>
          @if (staffError()) { <div class="full"><app-alert type="error">{{ staffError() }}</app-alert></div> }
          <div class="full form-actions"><button type="button" class="btn btn-ghost" (click)="staffOpen.set(false)">Cancel</button><button type="submit" class="btn btn-primary" [disabled]="saving()">Create account</button></div>
        </form>
      </app-modal>
    }
  `,
  styles: ['.days { display: flex; flex-wrap: wrap; gap: 16px; } .color { padding: 4px; height: 46px; } .divider { margin: 24px 0; }'],
})
export class AdminSettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private admin = inject(AdminService);
  private trainerService = inject(TrainerService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly tabs = ['Institute', 'Social & branding', 'Appointments', 'Staff accounts'];
  readonly socialKeys = ['facebook', 'instagram', 'linkedin', 'youtube', 'x'] as const;
  readonly days = DAYS;
  tab = signal('Institute');
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  saving = signal(false);
  saveError = signal('');
  staff = signal<User[]>([]);
  trainers = signal<Trainer[]>([]);
  unlinkedTrainers = signal<Trainer[]>([]);
  staffOpen = signal(false);
  staffError = signal('');
  workingDays = signal<string[]>([]);

  form = this.fb.nonNullable.group({
    instituteName: [''], tagline: [''], email: ['', Validators.email], phone: [''], address: [''], workingHours: [''], mapEmbedUrl: [''],
    socials: this.fb.nonNullable.group({ facebook: [''], instagram: [''], linkedin: [''], youtube: [''], x: [''] }),
    branding: this.fb.nonNullable.group({ logoText: [''], primaryColor: ['#0b2545'], accentColor: ['#f2a541'] }),
    appointment: this.fb.nonNullable.group({ slots: [''], slotMinutes: [45], counselorsPerSlot: [2], bookingWindowDays: [60] }),
  });
  staffForm = this.fb.nonNullable.group({
    role: ['trainer'], trainerId: [''], fullName: ['', [Validators.required, Validators.minLength(2)]], email: ['', [Validators.required, Validators.email]],
    mobile: ['', [Validators.required, mobileValidator]], password: ['', [Validators.required, passwordStrength]],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(null);
    forkJoin({ settings: this.settingsService.get(true), staff: this.admin.staff(), trainers: this.trainerService.list({ includeInactive: 'true' }) }).subscribe({
      next: (r) => { this.patch(r.settings); this.staff.set(r.staff); this.trainers.set(r.trainers); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }

  private patch(s: Settings): void {
    this.form.patchValue({
      instituteName: s.instituteName, tagline: s.tagline, email: s.email, phone: s.phone, address: s.address, workingHours: s.workingHours, mapEmbedUrl: s.mapEmbedUrl || '',
      socials: { facebook: s.socials.facebook || '', instagram: s.socials.instagram || '', linkedin: s.socials.linkedin || '', youtube: s.socials.youtube || '', x: s.socials.x || '' },
      branding: { logoText: s.branding.logoText, primaryColor: s.branding.primaryColor.toLowerCase(), accentColor: s.branding.accentColor.toLowerCase() },
      appointment: { slots: s.appointment.slots.join(', '), slotMinutes: s.appointment.slotMinutes, counselorsPerSlot: s.appointment.counselorsPerSlot, bookingWindowDays: s.appointment.bookingWindowDays },
    });
    this.workingDays.set([...s.appointment.workingDays]);
  }

  hasDay(d: string): boolean { return this.workingDays().includes(d); }
  toggleDay(d: string): void { this.workingDays.update((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d])); }

  save(): void {
    this.saveError.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const nullIfEmpty = (s: string) => (s.trim() ? s.trim() : null);
    const body = {
      ...v,
      mapEmbedUrl: nullIfEmpty(v.mapEmbedUrl),
      socials: Object.fromEntries(Object.entries(v.socials).map(([k, val]) => [k, nullIfEmpty(val)])),
      appointment: { ...v.appointment, slots: v.appointment.slots.split(',').map((s) => s.trim()).filter(Boolean).sort(), workingDays: this.workingDays() },
    };
    this.saving.set(true);
    this.settingsService.update(body as unknown as Partial<Settings>).subscribe({
      next: (s) => { this.saving.set(false); this.patch(s); this.toast.success('Settings saved'); },
      error: (e: ApiErrorInfo) => {
        this.saving.set(false);
        const details = Array.isArray(e.details) ? e.details.map((d) => `${d.field}: ${d.message}`).join('; ') : '';
        this.saveError.set(details || e.message);
      },
    });
  }

  openStaff(): void {
    this.staffError.set('');
    this.staffForm.reset({ role: 'trainer', trainerId: '', fullName: '', email: '', mobile: '', password: '' });
    this.unlinkedTrainers.set(this.trainers().filter((t) => !t.userId && t.isActive !== false));
    this.staffOpen.set(true);
  }

  createStaff(): void {
    this.staffError.set('');
    if (this.staffForm.invalid) { this.staffForm.markAllAsTouched(); return; }
    const v = this.staffForm.getRawValue();
    this.saving.set(true);
    this.admin.createStaff({ ...v, trainerId: v.role === 'trainer' ? v.trainerId || null : null }).subscribe({
      next: (u) => { this.saving.set(false); this.staffOpen.set(false); this.toast.success(`${u.role} account created for ${u.email}`); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); applyServerErrors(this.staffForm, e); this.staffError.set(e.message); },
    });
  }
}
