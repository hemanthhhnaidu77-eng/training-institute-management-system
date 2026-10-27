import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Batch, ClassSession, Course } from '../../core/models/models';
import { InrPipe } from '../pipes/inr.pipe';
import { StatusBadgeComponent } from './feedback.components';
import { IconComponent } from './icon.component';

const CATEGORY_ART: Record<string, { icon: string; from: string; to: string }> = {
  'Web Development': { icon: 'laptop', from: '#13315c', to: '#1d4477' },
  Programming: { icon: 'file', from: '#0b2545', to: '#2a5d8f' },
  'Data & AI': { icon: 'trending', from: '#123a4f', to: '#1b998b' },
  'Cloud & DevOps': { icon: 'layers', from: '#1d3a6e', to: '#3f72af' },
  Security: { icon: 'shield', from: '#1a1f3c', to: '#3c3f7a' },
  'Quality Engineering': { icon: 'check', from: '#143d3a', to: '#2b7a6f' },
  Marketing: { icon: 'target', from: '#4a2b0b', to: '#c27a1e' },
};

export function courseArt(category: string): { icon: string; background: string } {
  const art = CATEGORY_ART[category] || { icon: 'book', from: '#0b2545', to: '#13315c' };
  return { icon: art.icon, background: `linear-gradient(135deg, ${art.from}, ${art.to})` };
}

@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [RouterLink, IconComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card card-hover course">
      <a class="thumb" [routerLink]="['/courses', course.slug]" [style.background]="art.background" [attr.aria-label]="course.title">
        @if (course.imageUrl) { <img [src]="course.imageUrl" [alt]="course.title" loading="lazy" /> }
        @else { <app-icon [name]="art.icon" [size]="44" [stroke]="1.5" /> }
        <span class="badge level">{{ course.level }}</span>
        @if (course.discountedFee && course.discountedFee < course.fee) { <span class="badge badge-accent offer">Offer</span> }
      </a>
      <div class="body">
        <span class="eyebrow cat">{{ course.category }}</span>
        <h3><a [routerLink]="['/courses', course.slug]">{{ course.title }}</a></h3>
        <p class="muted desc">{{ course.shortDescription }}</p>
        <div class="meta">
          <span><app-icon name="clock" [size]="15" /> {{ course.duration }}</span>
          <span><app-icon name="monitor" [size]="15" /> {{ course.mode }}</span>
          @if (course.trainerName) { <span><app-icon name="user" [size]="15" /> {{ course.trainerName }}</span> }
        </div>
        <div class="foot">
          <div>
            <span class="price">{{ (course.effectiveFee ?? course.fee) | inr }}</span>
            @if (course.discountedFee && course.discountedFee < course.fee) { <span class="price-old">{{ course.fee | inr }}</span> }
          </div>
          <a class="btn btn-sm btn-outline" [routerLink]="['/courses', course.slug]">View details</a>
        </div>
      </div>
    </article>
  `,
  styles: [`
    .course { padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
    .thumb { position: relative; height: 150px; display: grid; place-items: center; color: rgba(255,255,255,0.92); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 85% 15%, rgba(242,165,65,0.35), transparent 45%); pointer-events: none; }
    .level { position: absolute; left: 14px; top: 14px; background: rgba(255,255,255,0.95); }
    .offer { position: absolute; right: 14px; top: 14px; }
    .body { padding: 20px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .cat { margin: 0; font-size: 0.72rem; }
    h3 { margin: 0; font-size: 1.1rem; } h3 a { color: var(--navy-900); }
    .desc { font-size: 0.92rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 0.82rem; color: var(--ink-2); margin-top: 6px; }
    .meta span { display: inline-flex; gap: 5px; align-items: center; }
    .foot { margin-top: auto; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px solid var(--line); }
  `],
})
export class CourseCardComponent {
  @Input({ required: true }) course!: Course;
  get art() { return courseArt(this.course.category); }
}

@Component({
  selector: 'app-page-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero">
      <div class="container">
        @if (eyebrow) { <span class="eyebrow">{{ eyebrow }}</span> }
        <h1>{{ title }}</h1>
        @if (subtitle) { <p>{{ subtitle }}</p> }
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    .page-hero { background: radial-gradient(circle at 90% 0%, rgba(242,165,65,0.22), transparent 40%), linear-gradient(160deg, var(--navy-950), var(--navy-800)); color: #c9d6e8; padding: 64px 0 56px; }
    h1 { color: var(--white); font-size: clamp(1.9rem, 3.6vw, 2.8rem); max-width: 760px; }
    .eyebrow { color: var(--accent); }
    p { max-width: 640px; font-size: 1.08rem; margin: 0; }
  `],
})
export class PageHeroComponent {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() subtitle = '';
}

@Component({
  selector: 'app-schedule-view',
  standalone: true,
  imports: [IconComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-2">
      <section class="card">
        <h3>Weekly timetable</h3>
        @for (day of days; track day) {
          <div class="day">
            <strong>{{ day }}</strong>
            <div class="slots">
              @for (b of batchesOn(day); track b.id) {
                <span class="slot"><app-icon name="clock" [size]="14" /> {{ b.startTime }}-{{ b.endTime }} &middot; {{ b.courseTitle }} <em>({{ b.name }})</em></span>
              } @empty { <span class="muted small">No classes</span> }
            </div>
          </div>
        }
      </section>
      <section class="card">
        <h3>Upcoming sessions</h3>
        @for (s of sessions.slice(0, 12); track s.date + s.batchId) {
          <div class="session">
            <div class="date"><span>{{ s.day }}</span><strong>{{ s.date.slice(8, 10) }}</strong><span>{{ monthName(s.date) }}</span></div>
            <div>
              <div class="cell-title">{{ s.courseTitle }}</div>
              <div class="muted small">{{ s.startTime }}-{{ s.endTime }} &middot; {{ s.mode }}{{ s.location ? ' · ' + s.location : '' }}</div>
              <div class="muted small">{{ s.batchName }}{{ s.trainerName ? ' · ' + s.trainerName : '' }}</div>
            </div>
          </div>
        } @empty { <p class="muted">No sessions in the next four weeks.</p> }
      </section>
    </div>
    @if (batches.length) {
      <section class="card mt-3">
        <h3>Batches</h3>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Batch</th><th>Course</th><th>Dates</th><th>Timing</th><th>Mode</th><th>Status</th></tr></thead>
          <tbody>
            @for (b of batches; track b.id) {
              <tr><td class="cell-title">{{ b.name }}</td><td>{{ b.courseTitle }}</td><td>{{ b.startDate }} to {{ b.endDate }}</td><td>{{ b.days.join(', ') }} &middot; {{ b.startTime }}-{{ b.endTime }}</td><td>{{ b.mode }}</td><td><app-status-badge [status]="b.status" /></td></tr>
            }
          </tbody>
        </table></div>
      </section>
    }
  `,
  styles: [`
    .day { display: grid; grid-template-columns: 56px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .day:last-child { border-bottom: none; }
    .slots { display: flex; flex-direction: column; gap: 6px; }
    .slot { display: inline-flex; gap: 6px; align-items: center; font-size: 0.9rem; }
    .slot em { color: var(--ink-3); font-style: normal; }
    .session { display: flex; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .session:last-child { border-bottom: none; }
    .date { width: 56px; flex-shrink: 0; text-align: center; background: var(--navy-50); border-radius: 12px; padding: 6px 0; display: flex; flex-direction: column; font-size: 0.72rem; color: var(--ink-3); line-height: 1.3; }
    .date strong { font-size: 1.2rem; color: var(--navy-900); font-family: var(--font-display); }
  `],
})
export class ScheduleViewComponent {
  @Input() batches: Batch[] = [];
  @Input() sessions: ClassSession[] = [];
  days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  batchesOn(day: string): Batch[] {
    return this.batches.filter((b) => ['upcoming', 'ongoing'].includes(b.status) && b.days.includes(day)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  monthName(date: string): string {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(date.slice(5, 7)) - 1];
  }
}
