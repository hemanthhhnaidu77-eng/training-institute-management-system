import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeroComponent } from '../../shared/components/content.components';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [PageHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero title="Terms & privacy" subtitle="Template text. Have it reviewed and replaced by your legal advisor before going live." />
    <section class="section-sm"><div class="container narrow card">
      <h3>1. Accounts</h3><p class="muted">Student accounts are personal. Keep your password confidential. Staff accounts are created only by administrators.</p>
      <h3>2. Enrollment &amp; fees</h3><p class="muted">Enrollment requests are subject to review and seat availability. Fees, taxes and payment schedules are confirmed by the admissions team before payment.</p>
      <h3>3. Appointments</h3><p class="muted">Appointments are confirmed by the institute. You can cancel or request a reschedule from your dashboard.</p>
      <h3>4. Placement assistance</h3><p class="muted">We provide career support services. We do not guarantee employment or specific salary outcomes.</p>
      <h3>5. Your data</h3><p class="muted">We store the information you submit (name, contact details, course interests, bookings and messages) to deliver our services. Passwords are stored only as secure hashes. We do not sell personal data. Contact us to access or delete your information.</p>
    </div></section>
  `,
  styles: ['.narrow { max-width: 860px; } h3 { margin-top: 12px; }'],
})
export class TermsComponent {}
