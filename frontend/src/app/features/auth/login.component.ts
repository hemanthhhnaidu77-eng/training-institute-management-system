import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiErrorInfo } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, FieldErrorComponent, AlertComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell title="Welcome back" subtitle="Log in to your student, trainer or admin account.">
      @if (notice()) { <app-alert type="info" class="mb-2">{{ notice() }}</app-alert> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" class="input" formControlName="email" autocomplete="username" />
          <app-field-error [control]="form.controls.email" label="Email" />
        </div>
        <div class="field">
          <div class="flex between"><label for="password">Password</label><a routerLink="/forgot-password" class="small">Forgot password?</a></div>
          <div class="input-group">
            <input id="password" [type]="show() ? 'text' : 'password'" class="input" formControlName="password" autocomplete="current-password" />
            <button type="button" class="btn btn-icon btn-ghost addon" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="show()">
              <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
            </button>
          </div>
          <app-field-error [control]="form.controls.password" label="Password" />
        </div>
        <label class="check"><input type="checkbox" formControlName="remember" /> <span>Remember me on this device <span class="muted small">(stays signed in up to 7 days; don't use on shared computers)</span></span></label>
        @if (error()) { <app-alert type="error">{{ error() }}</app-alert> }
        <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">{{ loading() ? 'Signing in...' : 'Log in' }}</button>
        <p class="text-center muted mb-0">New here? <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl }">Create a student account</a></p>
      </form>
    </app-auth-shell>
  `,
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  show = signal(false);
  loading = signal(false);
  error = signal('');
  notice = signal('');
  returnUrl: string | null = null;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false],
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const r = q.get('returnUrl');
    this.returnUrl = r && r.startsWith('/') && !r.startsWith('//') ? r : null;
    if (q.get('loggedOut')) this.notice.set('You have been logged out securely.');
    if (q.get('reset')) this.notice.set('Password updated. Please log in with your new password.');
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { email, password, remember } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.login(email.trim(), password, remember).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`);
        const dashboard = this.auth.dashboardUrl(user.role);
        const target = this.returnUrl && (this.returnUrl.startsWith(dashboard) || !/^\/(admin|student|trainer)/.test(this.returnUrl)) ? this.returnUrl : dashboard;
        this.router.navigateByUrl(target);
      },
      error: (e: ApiErrorInfo) => { this.loading.set(false); this.error.set(e.message); },
    });
  }
}
