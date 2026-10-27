import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, ServiceItem } from '../../core/models/models';
import { ServiceCatalogService } from '../../core/services/domain.services';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

const CTA_ROUTES: Record<ServiceItem['ctaType'], string> = { courses: '/courses', appointment: '/appointments', contact: '/contact', placements: '/placements', batches: '/batches' };

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="What we offer" title="Training & career services" subtitle="Flexible learning formats and career support designed around your goals." />
    <section class="section">
      <div class="container">
        @if (loading()) { <app-loader label="Loading services..." /> }
        @else if (error()) { <app-alert type="error" title="Could not load services" (retry)="load()">{{ error()?.message }}</app-alert> }
        @else {
          <div class="grid grid-3">
            @for (s of services(); track s.id) {
              <article class="card card-hover svc">
                <div class="icon-tile" [class.accent]="$index % 3 === 1"><app-icon [name]="s.icon" [size]="22" /></div>
                <h3 class="mt-2">{{ s.title }}</h3>
                <p class="muted">{{ s.description }}</p>
                <ul class="list-check small">@for (b of s.benefits; track b) { <li>{{ b }}</li> }</ul>
                <div class="foot">
                  <span class="badge"><app-icon name="monitor" [size]="12" /> {{ s.deliveryMode }}</span>
                  <a class="btn btn-sm btn-primary" [routerLink]="route(s)" [queryParams]="params(s)">{{ s.ctaLabel }}</a>
                </div>
              </article>
            }
          </div>
          @if (!services().length) { <app-empty-state title="No services published yet" message="Please check back soon." /> }
        }
      </div>
    </section>
  `,
  styles: [`
    .svc { display: flex; flex-direction: column; }
    .svc .list-check { margin-bottom: 16px; }
    .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid var(--line); }
  `],
})
export class ServicesPageComponent implements OnInit {
  private catalog = inject(ServiceCatalogService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  services = signal<ServiceItem[]>([]);

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalog.list().subscribe({
      next: (s) => { this.services.set(s); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  route(s: ServiceItem): string { return CTA_ROUTES[s.ctaType] || '/contact'; }
  params(s: ServiceItem): Record<string, string> | null {
    if (s.ctaType === 'appointment') return { serviceId: s.id };
    if (s.ctaType === 'contact') return { subject: s.title };
    return null;
  }
}
