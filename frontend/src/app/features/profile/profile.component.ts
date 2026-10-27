import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiErrorInfo, Course, Trainer } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CourseService, ProfileService, TrainerService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { applyServerErrors, initials, matchFields, mobileValidator, passwordStrength } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, FieldErrorComponent, AlertComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My profile</h1><p>Manage your personal details and password.</p></div></div>
    @if (loading()) { <app-loader /> }
    @else if (loadError()) { <app-alert type="error" (retry)="load()">{{ loadError()?.message }}</app-alert> }
    @else {
      <div class="grid grid-2 top">
        <section class="card">
          <div class="flex mb-3"><div class="avatar avatar-lg">{{ initials(auth.user()?.fullName) }}</div>
            <div><h3 class="mb-0">{{ auth.user()?.fullName }}</h3><span class="muted">{{ auth.user()?.email }}</span><br /><span class="badge mt-2">{{ auth.role() }}</span></div></div>
          <form [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate class="stack">
            <div class="field"><label for="p-name">Full name</label><input id="p-name" class="input" formControlName="fullName" /><app-field-error [control]="profile.controls.fullName" label="Full name" /></div>
            <div class="field"><label for="p-email">Email</label><input id="p-email" class="input" [value]="auth.user()?.email" disabled /><span class="hint">Contact the institute to change your login email.</span></div>
            <div class="field"><label for="p-mobile">Mobile number</label><input id="p-mobile" class="input" formControlName="mobile" /><app-field-error [control]="profile.controls.mobile" label="Mobile" /></div>
            @if (auth.role() === 'student') {
              <div class="field"><label for="p-course">Preferred course</label><select id="p-course" class="select" formControlName="preferredCourseId"><option value="">None</option>@for (c of courses(); track c.id) { <option [value]="c.id">{{ c.title }}</option> }</select></div>
            }
            <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="savingProfile() || profile.pristine">{{ savingProfile() ? 'Saving...' : 'Save changes' }}</button></div>
          </form>
        </section>
        <section class="card">
          <h3>Change password</h3>
          <p class="muted small">Changing your password signs you out on other devices.</p>
          <form [formGroup]="password" (ngSubmit)="changePassword()" novalidate class="stack">
            <div class="field"><label for="cur">Current password</label><input id="cur" type="password" class="input" formControlName="currentPassword" autocomplete="current-password" /><app-field-error [control]="password.controls.currentPassword" label="Current password" /></div>
            <div class="field"><label for="new">New password</label><input id="new" type="password" class="input" formControlName="newPassword" autocomplete="new-password" /><app-field-error [control]="password.controls.newPassword" label="New password" /></div>
            <div class="field"><label for="conf">Confirm new password</label><input id="conf" type="password" class="input" formControlName="confirmPassword" autocomplete="new-password" /><app-field-error [control]="password.controls.confirmPassword" label="Confirm password" /></div>
            <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="savingPassword()">{{ savingPassword() ? 'Updating...' : 'Update password' }}</button></div>
          </form>
        </section>
      </div>
      @if (auth.role() === 'trainer') {
        <section class="card mt-3">
          <h3>Public trainer profile</h3>
          @if (trainer(); as t) {
            <p class="muted small">Shown on the Trainers page. Availability and course assignments are managed by the administrator ({{ t.availabilityDays.join(', ') }}, {{ t.availableFrom }}-{{ t.availableTo }}).</p>
            <form [formGroup]="trainerForm" (ngSubmit)="saveTrainer()" class="form-grid">
              <div class="field full"><label for="t-spec">Specialization</label><input id="t-spec" class="input" formControlName="specialization" /></div>
              <div class="field full"><label for="t-bio">Biography</label><textarea id="t-bio" class="textarea" formControlName="bio" maxlength="2000"></textarea></div>
              <div class="field"><label for="t-cert">Certifications (one per line)</label><textarea id="t-cert" class="textarea" formControlName="certifications"></textarea></div>
              <div class="field"><label for="t-photo">Photo URL</label><input id="t-photo" class="input" formControlName="photoUrl" placeholder="https://..." /><app-field-error [control]="trainerForm.controls.photoUrl" label="Photo URL" /></div>
              <div class="full form-actions"><button type="submit" class="btn btn-primary" [disabled]="savingTrainer()">{{ savingTrainer() ? 'Saving...' : 'Save trainer profile' }}</button></div>
            </form>
          } @else if (trainerError()) { <app-alert type="warning">{{ trainerError() }}</app-alert> }
          @else { <app-loader [inline]="true" /> }
        </section>
      }
    }
  `,
  styles: ['.top { align-items: start; }'],
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private courseService = inject(CourseService);
  private trainerService = inject(TrainerService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  loadError = signal<ApiErrorInfo | null>(null);
  courses = signal<Course[]>([]);
  trainer = signal<Trainer | null>(null);
  trainerError = signal('');
  savingProfile = signal(false);
  savingPassword = signal(false);
  savingTrainer = signal(false);
  initials = initials;

  profile = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    mobile: ['', [Validators.required, mobileValidator]],
    preferredCourseId: [''],
  });
  password = this.fb.nonNullable.group(
    { currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, passwordStrength]], confirmPassword: ['', Validators.required] },
    { validators: matchFields('newPassword', 'confirmPassword') }
  );
  trainerForm = this.fb.nonNullable.group({ specialization: ['', Validators.required], bio: ['', Validators.required], certifications: [''], photoUrl: ['', Validators.pattern(/^(https?:\/\/\S+)?$/)] });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.profileService.get().subscribe({
      next: (u) => {
        this.auth.updateUser(u);
        this.profile.reset({ fullName: u.fullName, mobile: u.mobile, preferredCourseId: u.preferredCourseId || '' });
        this.loading.set(false);
      },
      error: (e: ApiErrorInfo) => { this.loadError.set(e); this.loading.set(false); },
    });
    if (this.auth.role() === 'student') this.courseService.list({ sort: 'title' }).subscribe({ next: (r) => this.courses.set(r.items), error: () => undefined });
    if (this.auth.role() === 'trainer') {
      this.trainerService.me().subscribe({
        next: (t) => { this.trainer.set(t); this.trainerForm.reset({ specialization: t.specialization, bio: t.bio, certifications: t.certifications.join('\n'), photoUrl: t.photoUrl || '' }); },
        error: (e: ApiErrorInfo) => this.trainerError.set(e.message),
      });
    }
  }

  saveProfile(): void {
    if (this.profile.invalid) { this.profile.markAllAsTouched(); return; }
    const v = this.profile.getRawValue();
    this.savingProfile.set(true);
    this.profileService.update({ fullName: v.fullName, mobile: v.mobile, ...(this.auth.role() === 'student' ? { preferredCourseId: v.preferredCourseId || null } : {}) }).subscribe({
      next: (u) => { this.savingProfile.set(false); this.auth.updateUser(u); this.profile.markAsPristine(); this.toast.success('Profile updated'); },
      error: (e: ApiErrorInfo) => { this.savingProfile.set(false); applyServerErrors(this.profile, e); this.toast.error(e.message); },
    });
  }

  changePassword(): void {
    if (this.password.invalid) { this.password.markAllAsTouched(); return; }
    const v = this.password.getRawValue();
    this.savingPassword.set(true);
    this.auth.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => { this.savingPassword.set(false); this.password.reset(); this.toast.success('Password updated. Other sessions were signed out.'); },
      error: (e: ApiErrorInfo) => { this.savingPassword.set(false); if (!applyServerErrors(this.password, e)) this.toast.error(e.message); },
    });
  }

  saveTrainer(): void {
    if (this.trainerForm.invalid) { this.trainerForm.markAllAsTouched(); return; }
    const v = this.trainerForm.getRawValue();
    this.savingTrainer.set(true);
    this.trainerService.updateMe({ specialization: v.specialization, bio: v.bio, certifications: v.certifications.split('\n').map((s) => s.trim()).filter(Boolean), photoUrl: v.photoUrl || null }).subscribe({
      next: (t) => { this.savingTrainer.set(false); this.trainer.set(t); this.toast.success('Trainer profile saved'); },
      error: (e: ApiErrorInfo) => { this.savingTrainer.set(false); applyServerErrors(this.trainerForm, e); this.toast.error(e.message); },
    });
  }
}
