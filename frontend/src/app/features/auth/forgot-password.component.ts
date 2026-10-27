import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { AlertComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, FieldErrorComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell title="Forgot your password?" subtitle="Enter your account email and we'll issue a secure, one-time reset link (valid for 30 minutes).">
      @if (sent()) {
        <app-alert type="success" title="Request received">{{ sent() }}</app-alert>
        <p class="muted small mt-2">Development note: no email service is configured, so reset links are written to the server's private dev outbox (backend/data/outbox.json). See the README.</p>
        <a routerLink="/login" class="btn btn-outline mt-2">Back to login</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
          <div class="field"><label for="email">Email</label><input id="email" type="email" class="input" formControlName="email" autocomplete="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
          @if (error()) { <app-alert type="error">{{ error() }}</app-alert> }
          <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">{{ loading() ? 'Sending...' : 'Send reset link' }}</button>
          <p class="text-center muted mb-0"><a routerLink="/login">Back to login</a></p>
        </form>
      }
    </app-auth-shell>
  `,
})
export class ForgotPasswordComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  loading = signal(false);
  error = signal('');
  sent = signal('');
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  submit(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.auth.forgotPassword(this.form.getRawValue().email.trim()).subscribe({
      next: (msg) => { this.loading.set(false); this.sent.set(msg); },
      error: (e: ApiErrorInfo) => { this.loading.set(false); this.error.set(e.message); },
    });
  }
}
