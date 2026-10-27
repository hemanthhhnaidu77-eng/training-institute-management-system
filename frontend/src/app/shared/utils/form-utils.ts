import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ApiErrorInfo, FieldError } from '../../core/models/models';

export const MOBILE_PATTERN = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;

export const mobileValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '').toString().trim();
  if (!v) return null;
  return MOBILE_PATTERN.test(v) ? null : { mobile: true };
};

export const passwordStrength: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value ?? '') as string;
  if (!v) return null;
  return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? null : { passwordStrength: true };
};

/** Group validator: flags `confirmKey` with { mismatch } when it differs from `key`. */
export function matchFields(key: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(key);
    const b = group.get(confirmKey);
    if (!a || !b) return null;
    const errors = { ...(b.errors || {}) };
    if (b.value && a.value !== b.value) errors['mismatch'] = true;
    else delete errors['mismatch'];
    b.setErrors(Object.keys(errors).length ? errors : null);
    return null;
  };
}

export function todayLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const notPastDate: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value as string;
  if (!v) return null;
  return v < todayLocal() ? { pastDate: true } : null;
};

/** Maps server-side validation details onto matching form controls. */
export function applyServerErrors(form: FormGroup, err: ApiErrorInfo): boolean {
  if (!Array.isArray(err.details)) return false;
  let applied = false;
  for (const d of err.details as FieldError[]) {
    const control = form.get(d.field.split('[')[0]);
    if (control) {
      control.setErrors({ ...(control.errors || {}), server: d.message });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}

export function initials(name: string | null | undefined): string {
  return (name || '?').split(/\s+/).filter((p) => /[A-Za-z]/.test(p[0] || '')).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
