import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiErrorInfo, Course } from '../../core/models/models';
import { CourseService } from '../../core/services/domain.services';
import { CourseCardComponent, PageHeroComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeroComponent, CourseCardComponent, LoaderComponent, AlertComponent, EmptyStateComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Course catalogue" title="Industry-ready courses" subtitle="Search, filter and compare programs by category, level and learning mode." />
    <section class="section-sm">
      <div class="container">
        <form class="filters card" [formGroup]="filters" (ngSubmit)="load()" role="search">
          <div class="field search">
            <label for="q" class="sr-only">Search courses</label>
            <div class="input-group">
              <input id="q" class="input" formControlName="q" placeholder="Search by course, topic or skill" />
              <span class="addon muted"><app-icon name="search" /></span>
            </div>
          </div>
          <div class="field"><label for="category" class="sr-only">Category</label>
            <select id="category" class="select" formControlName="category"><option value="">All categories</option>@for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }</select></div>
          <div class="field"><label for="level" class="sr-only">Level</label>
            <select id="level" class="select" formControlName="level"><option value="">All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
          <div class="field"><label for="mode" class="sr-only">Mode</label>
            <select id="mode" class="select" formControlName="mode"><option value="">Any mode</option><option>Online</option><option>Offline</option><option>Hybrid</option></select></div>
          <div class="field"><label for="sort" class="sr-only">Sort</label>
            <select id="sort" class="select" formControlName="sort"><option value="popular">Most popular</option><option value="title">Title (A-Z)</option><option value="fee_asc">Fee: low to high</option><option value="fee_desc">Fee: high to low</option><option value="newest">Newest</option></select></div>
          <button type="button" class="btn btn-ghost" (click)="reset()">Reset</button>
        </form>

        @if (loading()) { <app-loader label="Loading courses..." /> }
        @else if (error()) { <app-alert type="error" title="Could not load courses" (retry)="load()">{{ error()?.message }}</app-alert> }
        @else {
          <p class="muted small mb-2">{{ courses().length }} course{{ courses().length === 1 ? '' : 's' }} found</p>
          <div class="grid grid-3">
            @for (c of courses(); track c.id) { <app-course-card [course]="c" /> }
          </div>
          @if (!courses().length) {
            <app-empty-state icon="search" title="No courses match your filters" message="Try a different keyword or clear the filters.">
              <button type="button" class="btn btn-primary btn-sm" (click)="reset()">Clear filters</button>
            </app-empty-state>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: 2fr repeat(4, 1fr) auto; gap: 12px; margin-bottom: 24px; padding: 16px; align-items: center; }
    @media (max-width: 1024px) { .filters { grid-template-columns: 1fr 1fr; } .search { grid-column: 1 / -1; } }
  `],
})
export class CourseListComponent implements OnInit {
  private courseService = inject(CourseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  courses = signal<Course[]>([]);
  categories = signal<string[]>([]);
  filters = this.fb.nonNullable.group({ q: '', category: '', level: '', mode: '', sort: 'popular' });

  ngOnInit(): void {
    const p = this.route.snapshot.queryParamMap;
    this.filters.patchValue({ q: p.get('q') || '', category: p.get('category') || '', level: p.get('level') || '', mode: p.get('mode') || '' }, { emitEvent: false });
    this.filters.valueChanges.pipe(debounceTime(300), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))).subscribe(() => this.load());
    this.load();
  }

  load(): void {
    const v = this.filters.getRawValue();
    this.router.navigate([], { queryParams: { q: v.q || null, category: v.category || null, level: v.level || null, mode: v.mode || null }, replaceUrl: true });
    this.loading.set(true);
    this.error.set(null);
    this.courseService.list(v).subscribe({
      next: (r) => {
        this.courses.set(r.items);
        if (r.categories.length) this.categories.set(r.categories);
        this.loading.set(false);
      },
      error: (e: ApiErrorInfo) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }

  reset(): void { this.filters.setValue({ q: '', category: '', level: '', mode: '', sort: 'popular' }); }
}
