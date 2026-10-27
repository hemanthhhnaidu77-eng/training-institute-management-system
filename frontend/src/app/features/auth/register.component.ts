import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiErrorInfo, Course } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { applyServerErrors, matchFields, mobileValidator, passwordStrength } from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, FieldErrorComponent, AlertComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell title="Create your student account" subtitle="Free to join. Enroll in courses and book consultations from your dashboard.">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form-grid">
        <div class="field full"><label for="fullName">Full name<span class="req">*</span></label><input id="fullName" class="input" formControlName="fullName" autocomplete="name" /><app-field-error [control]="form.controls.fullName" label="Full name" /></div>
        <div class="field"><label for="email">Email<span class="req">*</span></label><input id="email" type="email" class="input" formControlName="email" autocomplete="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
        <div class="field"><label for="mobile">Mobile number<span class="req">*</span></label><input id="mobile" type="tel" class="input" formControlName="mobile" autocomplete="tel" placeholder="98765 43210" /><app-field-error [control]="form.controls.mobile" label="Mobile number" /></div>
        <div class="field">
          <label for="password">Password<span class="req">*</span></label>
          <div class="input-group">
            <input id="password" [type]="show() ? 'text' : 'password'" class="input" formControlName="password" autocomplete="new-password" />
            <button type="button" class="btn btn-icon btn-ghost addon" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" /></button>
          </div>
          <span class="hint">8+ characters with letters and numbers.</span>
          <app-field-error [control]="form.controls.password" label="Password" />
        </div>
        <div class="field"><label for="confirm">Confirm password<span class="req">*</span></label><input id="confirm" [type]="show() ? 'text' : 'password'" class="input" formControlName="confirmPassword" autocomplete="new-password" /><app-field-error [control]="form.controls.confirmPassword" label="Confirm password" /></div>
        <div class="field full"><label for="course">Preferred course</label>
          <select id="course" class="select" formControlName="preferredCourseId"><option value="">I'm still exploring</option>@for (c of courses(); track c.id) { <option [value]="c.id">{{ c.title }}</option> }</select>
          @if (coursesError()) { <span class="hint">Course list unavailable right now; you can choose later.</span> }
        </div>
        <div class="field full">
          <label class="check"><input type="checkbox" formControlName="acceptTerms" /> <span>I accept the <a routerLink="/terms" target="_blank">terms and privacy policy</a><span class="req">*</span></span></label>
          <app-field-error [control]="form.controls.acceptTerms" label="Terms" />
        </div>
        @if (error()) { <div class="full"><app-alert type="error">{{ error() }}</app-alert></div> }
        <div class="full"><button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">{{ loading() ? 'Creating account...' : 'Create account' }}</button></div>
        <p class="full text-center muted mb-0">Already registered? <a routerLink="/login">Log in</a></p>
      </form>
    </app-auth-shell>
  `,
})
export class RegisterComponent implements OnInit {
  private auth = inject(AuthService);
  private courseService = inject(CourseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  show = signal(false);
  loading = signal(false);
  error = signal('');
  courses = signal<Course[]>([]);
  coursesError = signal(false);

  form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, mobileValidator]],
      password: ['', [Validators.required, passwordStrength, Validators.maxLength(128)]],
      confirmPassword: ['', Validators.required],
      preferredCourseId: [''],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: matchFields('password', 'confirmPassword') }
  );

  ngOnInit(): void {
    this.courseService.list({ sort: 'title' }).subscribe({ next: (r) => this.courses.set(r.items), error: () => this.coursesError.set(true) });
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { confirmPassword, ...v } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.register({ ...v, preferredCourseId: v.preferredCourseId || null }).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Account created. Welcome!');
        const r = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(r && r.startsWith('/') && !r.startsWith('//') && !/^\/(admin|trainer)/.test(r) ? r : '/student');
      },
      error: (e: ApiErrorInfo) => { this.loading.set(false); applyServerErrors(this.form, e); this.error.set(e.message); },
    });
  }
}
