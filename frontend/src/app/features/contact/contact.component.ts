import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ApiErrorInfo, Settings } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { InquiryService, SettingsService } from '../../core/services/domain.services';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { applyServerErrors, mobileValidator } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeroComponent, IconComponent, AlertComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Contact us" title="Let's talk about your goals" subtitle="Questions about courses, fees, batches or corporate training? We usually reply within one working day." />
    <section class="section-sm">
      <div class="container layout">
        <aside class="stack">
          <div class="card info">
            <h3>Reach us</h3>
            <p><app-icon name="map-pin" /> <span>{{ settings()?.address || 'Loading address...' }}</span></p>
            <p><app-icon name="phone" /> <span>{{ settings()?.phone }}</span></p>
            <p><app-icon name="mail" /> <a [href]="'mailto:' + (settings()?.email || '')">{{ settings()?.email }}</a></p>
            <p><app-icon name="clock" /> <span>{{ settings()?.workingHours }}</span></p>
            <div class="socials">
              @for (s of socials(); track s.key) { <a [href]="s.url" target="_blank" rel="noopener noreferrer" class="btn btn-icon btn-ghost" [attr.aria-label]="s.key"><app-icon [name]="s.icon" /></a> }
            </div>
          </div>
          <div class="map card">
            @if (mapUrl()) { <iframe [src]="mapUrl()" title="Institute location map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe> }
            @else { <div class="map-ph"><app-icon name="map-pin" [size]="32" /><span>Map placeholder</span><small class="muted">Add a Google Maps embed URL in Admin &rarr; Settings</small></div> }
          </div>
        </aside>
        <div class="card">
          @if (ticket()) {
            <div class="done">
              <div class="icon-tile accent"><app-icon name="check" [size]="26" /></div>
              <h2>Thanks, we've got your message</h2>
              <p class="muted">Your reference number is <strong>{{ ticket() }}</strong>. Our team will get back to you soon.</p>
              <button type="button" class="btn btn-outline" (click)="ticket.set('')">Send another message</button>
            </div>
          } @else {
            <h3>Send us a message</h3>
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form-grid">
              <div class="field"><label for="c-name">Full name<span class="req">*</span></label><input id="c-name" class="input" formControlName="name" autocomplete="name" /><app-field-error [control]="form.controls.name" label="Name" /></div>
              <div class="field"><label for="c-email">Email<span class="req">*</span></label><input id="c-email" type="email" class="input" formControlName="email" autocomplete="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
              <div class="field"><label for="c-mobile">Mobile (optional)</label><input id="c-mobile" type="tel" class="input" formControlName="mobile" autocomplete="tel" /><app-field-error [control]="form.controls.mobile" label="Mobile" /></div>
              <div class="field"><label for="c-cat">Inquiry category<span class="req">*</span></label>
                <select id="c-cat" class="select" formControlName="category">@for (c of categories; track c) { <option [value]="c">{{ c }}</option> }</select></div>
              <div class="field full"><label for="c-subject">Subject<span class="req">*</span></label><input id="c-subject" class="input" formControlName="subject" maxlength="150" /><app-field-error [control]="form.controls.subject" label="Subject" /></div>
              <div class="field full"><label for="c-msg">Message<span class="req">*</span></label><textarea id="c-msg" class="textarea" formControlName="message" maxlength="3000" rows="6"></textarea>
                <span class="hint">{{ form.controls.message.value.length }}/3000</span><app-field-error [control]="form.controls.message" label="Message" /></div>
              @if (error()) { <div class="full"><app-alert type="error">{{ error() }}</app-alert></div> }
              <div class="full form-actions"><button type="submit" class="btn btn-primary btn-lg" [disabled]="submitting()">{{ submitting() ? 'Sending...' : 'Send message' }}</button></div>
            </form>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 380px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .info p { display: flex; gap: 12px; align-items: flex-start; color: var(--ink-2); }
    .info app-icon { color: var(--accent-600); margin-top: 2px; }
    .socials { display: flex; gap: 4px; }
    .map { padding: 0; overflow: hidden; height: 240px; }
    .map iframe { width: 100%; height: 100%; border: 0; }
    .map-ph { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--navy-700); background: repeating-linear-gradient(45deg, var(--navy-50), var(--navy-50) 12px, #fff 12px, #fff 24px); font-weight: 600; }
    .done { text-align: center; padding: 32px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  `],
})
export class ContactComponent implements OnInit {
  private inquiries = inject(InquiryService);
  private settingsService = inject(SettingsService);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(FormBuilder);

  readonly categories = ['Course Information', 'Fees and Payment', 'Admissions', 'Corporate Training', 'Placement Support', 'Technical Support', 'Feedback', 'Other'];
  settings = signal<Settings | null>(null);
  socials = signal<{ key: string; url: string; icon: string }[]>([]);
  mapUrl = signal<SafeResourceUrl | null>(null);
  submitting = signal(false);
  error = signal('');
  ticket = signal('');

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    mobile: ['', mobileValidator],
    category: ['Course Information', Validators.required],
    subject: ['', [Validators.required, Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(3000)]],
  });

  ngOnInit(): void {
    const subject = this.route.snapshot.queryParamMap.get('subject');
    if (subject) this.form.patchValue({ subject: subject.slice(0, 150) });
    const u = this.auth.user();
    if (u) this.form.patchValue({ name: u.fullName, email: u.email, mobile: u.mobile });
    this.settingsService.get().subscribe({
      next: (s) => {
        this.settings.set(s);
        const icons: Record<string, string> = { facebook: 'facebook', instagram: 'instagram', linkedin: 'linkedin', youtube: 'youtube', x: 'twitter' };
        this.socials.set(Object.entries(s.socials || {}).filter(([, v]) => !!v).map(([key, url]) => ({ key, url: url as string, icon: icons[key] || 'globe' })));
        // Only trust Google Maps embeds configured by an admin.
        if (s.mapEmbedUrl && /^https:\/\/(www\.)?google\.com\/maps\/embed/.test(s.mapEmbedUrl)) this.mapUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(s.mapEmbedUrl));
      },
      error: () => undefined,
    });
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.inquiries.submit({ ...v, mobile: v.mobile || null }).subscribe({
      next: (r) => { this.submitting.set(false); this.ticket.set(r.ticketNo); this.form.reset({ category: 'Course Information' }); },
      error: (e: ApiErrorInfo) => { this.submitting.set(false); applyServerErrors(this.form, e); this.error.set(e.message); },
    });
  }
}
