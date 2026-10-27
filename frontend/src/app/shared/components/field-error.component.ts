import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/** Displays the first validation message for a control once it has been touched. */
@Component({
  selector: 'app-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  template: `@if (message) { <span class="error-text" role="alert">{{ message }}</span> }`,
})
export class FieldErrorComponent implements OnInit, OnDestroy {
  @Input({ required: true }) control: AbstractControl | null = null;
  @Input() label = 'This field';
  private sub?: Subscription;
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.sub = this.control?.statusChanges.subscribe(() => this.cdr.markForCheck());
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get message(): string {
    const c = this.control;
    if (!c || !c.errors || !(c.touched || c.dirty)) return '';
    const e = c.errors;
    if (e['server']) return e['server'];
    if (e['required']) return `${this.label} is required`;
    if (e['email']) return 'Enter a valid email address';
    if (e['minlength']) return `${this.label} must be at least ${e['minlength'].requiredLength} characters`;
    if (e['maxlength']) return `${this.label} must be at most ${e['maxlength'].requiredLength} characters`;
    if (e['min']) return `${this.label} must be at least ${e['min'].min}`;
    if (e['max']) return `${this.label} must be at most ${e['max'].max}`;
    if (e['mobile']) return 'Enter a valid 10-digit Indian mobile number';
    if (e['passwordStrength']) return 'Use at least 8 characters with letters and numbers';
    if (e['mismatch']) return 'Passwords do not match';
    if (e['pastDate']) return 'Choose today or a future date';
    if (e['requiredTrue']) return 'Please accept to continue';
    if (e['pattern']) return `${this.label} has an invalid format`;
    return `${this.label} is invalid`;
  }
}
