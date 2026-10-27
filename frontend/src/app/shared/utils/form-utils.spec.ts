import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors, matchFields, mobileValidator, notPastDate, passwordStrength, todayLocal } from './form-utils';

describe('form-utils validators', () => {
  it('accepts valid Indian mobile numbers and rejects invalid ones', () => {
    expect(mobileValidator(new FormControl('9876543210'))).toBeNull();
    expect(mobileValidator(new FormControl('+91 98765 43210'))).toBeNull();
    expect(mobileValidator(new FormControl('12345'))).toEqual({ mobile: true });
    expect(mobileValidator(new FormControl('5876543210'))).toEqual({ mobile: true });
  });

  it('enforces password strength', () => {
    expect(passwordStrength(new FormControl('Secret123'))).toBeNull();
    expect(passwordStrength(new FormControl('password'))).toEqual({ passwordStrength: true });
    expect(passwordStrength(new FormControl('12345678'))).toEqual({ passwordStrength: true });
  });

  it('flags mismatched confirmation passwords', () => {
    const group = new FormGroup({ password: new FormControl('Secret123'), confirm: new FormControl('Secret124') }, { validators: matchFields('password', 'confirm') });
    expect(group.get('confirm')?.hasError('mismatch')).toBeTrue();
    group.get('confirm')?.setValue('Secret123');
    expect(group.get('confirm')?.hasError('mismatch')).toBeFalse();
  });

  it('rejects past dates', () => {
    expect(notPastDate(new FormControl('2000-01-01'))).toEqual({ pastDate: true });
    expect(notPastDate(new FormControl(todayLocal()))).toBeNull();
  });

  it('maps server validation details onto controls', () => {
    const form = new FormGroup({ email: new FormControl('a@b.co') });
    const applied = applyServerErrors(form, { status: 400, code: 'VALIDATION_ERROR', message: 'x', details: [{ field: 'email', message: 'Email already used' }] });
    expect(applied).toBeTrue();
    expect(form.get('email')?.errors?.['server']).toBe('Email already used');
  });
});
