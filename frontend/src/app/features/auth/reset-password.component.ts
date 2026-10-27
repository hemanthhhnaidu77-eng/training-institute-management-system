import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiErrorInfo } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { AlertComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { matchFields, passwordStrength } from '../../shared/utils/form-utils';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, FieldErrorComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell title="Choose a new password" subtitle="Resetting signs you out of all other devices.">
      @if (!token) {
        <app-alert type="error" title="Missing reset token">Open the full link from your reset message, or request a new one.</app-alert>
        <a routerLink="/forgot-password" class="btn btn-outline mt-2">Request a new link</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
          <div class="field"><label for="pw">New password</label><input id="pw" type="password" class="input" formControlName="password" autocomplete="new-password" /><span class="hint">8+ characters with letters and numbers.</span><app-field-error [control]="form.controls.password" label="Password" /></div>
          <div class="field"><label for="pw2">Confirm new password</label><input id="pw2" type="password" class="input" formControlName="confirmPassword" autocomplete="new-password" /><app-field-error [control]="form.controls.confirmPassword" label="Confirm password" /></div>
          @if (error()) { <app-alert type="error">{{ error() }} <a routerLink="/forgot-password">Request a new link</a></app-alert> }
          <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">{{ loading() ? 'Saving...' : 'Update password' }}</button>
        </form>
      }
    </app-auth-shell>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  token = '';
  loading = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group(
    { password: ['', [Validators.required, passwordStrength]], confirmPassword: ['', Validators.required] },
    { validators: matchFields('password', 'confirmPassword') }
  );

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('token') || '';
    this.token = /^[a-f0-9]{32,128}$/.test(t) ? t : '';
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => { this.loading.set(false); this.auth.clearSession(); this.router.navigate(['/login'], { queryParams: { reset: 1 } }); },
      error: (e: ApiErrorInfo) => { this.loading.set(false); this.error.set(e.message); },
    });
  }
}
