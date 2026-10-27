import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, Faq } from '../../core/models/models';
import { ContentService } from '../../core/services/domain.services';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Help centre" title="Frequently asked questions" subtitle="Enrollment, fees, schedules, certificates, appointments and more." />
    <section class="section-sm">
      <div class="container narrow">
        @if (loading()) { <app-loader label="Loading FAQs..." /> }
        @else if (error()) { <app-alert type="error" title="Could not load FAQs" (retry)="load()">{{ error()?.message }}</app-alert> }
        @else {
          <div class="chips mb-3" role="tablist" aria-label="FAQ categories">
            <button type="button" class="chip" [class.active]="!active()" (click)="active.set('')" role="tab" [attr.aria-selected]="!active()">All</button>
            @for (c of categories(); track c) { <button type="button" class="chip" [class.active]="active() === c" (click)="active.set(c)" role="tab" [attr.aria-selected]="active() === c">{{ c }}</button> }
          </div>
          @for (group of grouped(); track group.category) {
            <h2 class="cat">{{ group.category }}</h2>
            @for (f of group.items; track f.id) { <details class="faq"><summary>{{ f.question }}</summary><p>{{ f.answer }}</p></details> }
          }
          @if (!faqs().length) { <app-empty-state title="No FAQs yet" message="Have a question? Send it to us." actionLabel="Contact us" actionLink="/contact" /> }
          <div class="card ask mt-3"><div><h3 class="mb-0">Still have questions?</h3><p class="muted mb-0">Talk to a counsellor for free.</p></div>
            <div class="flex flex-wrap"><a routerLink="/appointments" class="btn btn-primary">Book a consultation</a><a routerLink="/contact" class="btn btn-outline">Contact us</a></div></div>
        }
      </div>
    </section>
  `,
  styles: [`.narrow { max-width: 860px; } .chips { display: flex; flex-wrap: wrap; gap: 8px; } .cat { font-size: 1.2rem; margin: 28px 0 12px; } .ask { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }`],
})
export class FaqComponent implements OnInit {
  private content = inject(ContentService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  faqs = signal<Faq[]>([]);
  active = signal('');
  categories = computed(() => [...new Set(this.faqs().map((f) => f.category))]);
  grouped = computed(() =>
    this.categories().filter((c) => !this.active() || c === this.active()).map((category) => ({ category, items: this.faqs().filter((f) => f.category === category) })));

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.content.faqs().subscribe({
      next: (f) => { this.faqs.set(f); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
