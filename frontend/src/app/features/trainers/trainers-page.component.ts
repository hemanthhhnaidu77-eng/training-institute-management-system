import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiErrorInfo, Trainer } from '../../core/models/models';
import { TrainerService } from '../../core/services/domain.services';
import { PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';
import { initials } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-trainers-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, PageHeroComponent, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Our mentors" title="Meet the trainers" subtitle="Practitioners who teach what they build every day." />
    <section class="section-sm">
      <div class="container">
        <div class="toolbar">
          <label for="tq" class="sr-only">Search trainers</label>
          <input id="tq" class="input" [formControl]="search" placeholder="Search by name or specialization" />
        </div>
        @if (loading()) { <app-loader label="Loading trainers..." /> }
        @else if (error()) { <app-alert type="error" title="Could not load trainers" (retry)="load()">{{ error()?.message }}</app-alert> }
        @else {
          <div class="grid grid-2">
            @for (t of trainers(); track t.id) {
              <article class="card trainer">
                <div class="top">
                  <div class="avatar avatar-lg">@if (t.photoUrl) { <img [src]="t.photoUrl" [alt]="'Photo of ' + t.name" /> } @else { {{ initials(t.name) }} }</div>
                  <div>
                    <h3 class="mb-0">{{ t.name }}</h3>
                    <p class="muted mb-0">{{ t.designation }}</p>
                    <span class="badge badge-accent mt-2">{{ t.experienceYears }}+ years experience</span>
                  </div>
                </div>
                <p class="spec"><strong>Specialization:</strong> {{ t.specialization }}</p>
                <p class="muted small">{{ t.bio }}</p>
                @if (t.certifications.length) { <div class="tag-list mb-2">@for (c of t.certifications; track c) { <span class="badge"><app-icon name="award" [size]="12" /> {{ c }}</span> }</div> }
                @if (t.courses?.length) {
                  <p class="small mb-2"><strong>Courses taught:</strong> @for (c of t.courses || []; track c.id; let last = $last) { <a [routerLink]="['/courses', c.slug]">{{ c.title }}</a>{{ last ? '' : ', ' }} }</p>
                }
                <div class="foot">
                  <span class="small muted"><app-icon name="calendar" [size]="14" /> {{ t.availabilityDays.join(', ') }} &middot; {{ t.availableFrom }}-{{ t.availableTo }}</span>
                  <a class="btn btn-sm btn-primary" routerLink="/appointments" [queryParams]="{ trainerId: t.id }">Book a Session</a>
                </div>
              </article>
            }
          </div>
          @if (!trainers().length) { <app-empty-state icon="users" title="No trainers found" message="Try a different search term." /> }
        }
      </div>
    </section>
  `,
  styles: [`
    .trainer { display: flex; flex-direction: column; }
    .top { display: flex; gap: 18px; align-items: center; margin-bottom: 14px; }
    .spec { margin-bottom: 8px; font-size: 0.93rem; }
    .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid var(--line); }
    .foot span { display: inline-flex; gap: 6px; align-items: center; }
  `],
})
export class TrainersPageComponent implements OnInit {
  private trainerService = inject(TrainerService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  trainers = signal<Trainer[]>([]);
  search = new FormControl('', { nonNullable: true });
  initials = initials;

  ngOnInit(): void {
    this.search.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load());
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.trainerService.list({ q: this.search.value }).subscribe({
      next: (t) => { this.trainers.set(t); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
