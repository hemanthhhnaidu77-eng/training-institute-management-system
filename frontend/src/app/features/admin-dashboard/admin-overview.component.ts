import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminDashboard, ApiErrorInfo } from '../../core/models/models';
import { DashboardService } from '../../core/services/domain.services';
import { AlertComponent, LoaderComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent, LoaderComponent, AlertComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Admin overview</h1><p>Live figures calculated from the institute's records.</p></div>
      <button type="button" class="btn btn-ghost btn-sm" (click)="load()"><app-icon name="refresh" [size]="16" /> Refresh</button></div>
    @if (loading()) { <app-loader label="Crunching numbers..." /> }
    @else if (error()) { <app-alert type="error" title="Dashboard unavailable" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (data()) {
      <div class="grid grid-4 mb-3">
        @for (s of cards; track s.key) {
          <a class="card stat-card card-hover" [routerLink]="s.link"><div class="icon-tile" [class.accent]="s.accent"><app-icon [name]="s.icon" /></div>
            <div><div class="value">{{ data()!.stats[s.key] ?? 0 }}</div><div class="label">{{ s.label }}</div></div></a>
        }
      </div>
      @if (data()!.stats['pendingEnrollments'] || data()!.stats['appointmentRequests'] || data()!.stats['pendingReviews'] || data()!.stats['openInquiries']) {
        <div class="card attention mb-3">
          <strong>Needs attention:</strong>
          @if (data()!.stats['pendingEnrollments']) { <a routerLink="/admin/enrollments" class="badge badge-warning">{{ data()!.stats['pendingEnrollments'] }} enrollment request(s)</a> }
          @if (data()!.stats['appointmentRequests']) { <a routerLink="/admin/appointments" class="badge badge-warning">{{ data()!.stats['appointmentRequests'] }} cancel/reschedule request(s)</a> }
          @if (data()!.stats['openInquiries']) { <a routerLink="/admin/inquiries" class="badge badge-info">{{ data()!.stats['openInquiries'] }} open inquiry(ies)</a> }
          @if (data()!.stats['pendingReviews']) { <a routerLink="/admin/reviews" class="badge badge-accent">{{ data()!.stats['pendingReviews'] }} review(s) to moderate</a> }
        </div>
      }
      <div class="grid grid-2">
        <section class="card">
          <h3>Last 6 months</h3>
          <div class="chart" role="img" [attr.aria-label]="'Monthly registrations, enrollments and appointments'">
            @for (m of data()!.trend; track m.month) {
              <div class="col">
                <div class="bars">
                  <span class="b reg" [style.height.%]="pct(m.registrations)" [title]="m.registrations + ' registrations'"></span>
                  <span class="b enr" [style.height.%]="pct(m.enrollments)" [title]="m.enrollments + ' enrollments'"></span>
                  <span class="b apt" [style.height.%]="pct(m.appointments)" [title]="m.appointments + ' appointments'"></span>
                </div>
                <span class="m">{{ monthLabel(m.month) }}</span>
              </div>
            }
          </div>
          <div class="legend small"><span><i class="reg"></i> Registrations</span><span><i class="enr"></i> Enrollments</span><span><i class="apt"></i> Appointments</span></div>
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Upcoming appointments</h3><a routerLink="/admin/appointments" class="small">All</a></div>
          @for (a of data()!.upcomingAppointments; track a.id) {
            <div class="row flex between"><div><div class="cell-title">{{ a.fullName }}</div><div class="muted small">{{ a.date }} {{ a.time }} &middot; {{ a.trainerName || 'Counsellor' }}</div></div><app-status-badge [status]="a.status" /></div>
          } @empty { <p class="muted">No upcoming appointments.</p> }
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Recent registrations</h3><a routerLink="/admin/students" class="small">Students</a></div>
          @for (u of data()!.recentRegistrations; track u.id) {
            <div class="row flex between"><div><div class="cell-title">{{ u.fullName }}</div><div class="muted small">{{ u.email }}</div></div><span class="small muted">{{ u.createdAt | date: 'mediumDate' }}</span></div>
          } @empty { <p class="muted">No students registered yet.</p> }
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Upcoming sessions (7 days)</h3><a routerLink="/admin/batches" class="small">Batches</a></div>
          @for (s of data()!.upcomingSessions; track s.date + s.batchId) {
            <div class="row"><div class="cell-title">{{ s.courseTitle }}</div><div class="muted small">{{ s.day }} {{ s.date }} &middot; {{ s.startTime }}-{{ s.endTime }} &middot; {{ s.trainerName }}</div></div>
          } @empty { <p class="muted">No class sessions in the next 7 days.</p> }
        </section>
      </div>
      <section class="card mt-3">
        <h3>Recent activity</h3>
        @for (a of data()!.recentActivity; track a.id) {
          <div class="row flex between"><span><strong>{{ a.actorName }}</strong> <span class="muted">({{ a.actorRole }})</span> &middot; {{ a.summary }}</span><span class="small muted">{{ a.createdAt | date: 'short' }}</span></div>
        } @empty { <p class="muted mb-0">No activity recorded yet.</p> }
      </section>
    }
  `,
  styles: [`
    a.stat-card { color: inherit; }
    .attention { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; border-left: 4px solid var(--accent); }
    .row { padding: 10px 0; border-bottom: 1px solid var(--line); gap: 12px; } .row:last-child { border-bottom: none; }
    .chart { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; height: 200px; align-items: end; padding-top: 8px; }
    .col { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
    .bars { flex: 1; width: 100%; display: flex; gap: 3px; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--line); }
    .b { width: 22%; min-height: 2px; border-radius: 4px 4px 0 0; transition: height .4s ease; }
    .reg { background: var(--navy-800); } .enr { background: var(--accent); } .apt { background: var(--teal); }
    .m { font-size: 0.75rem; color: var(--ink-3); }
    .legend { display: flex; gap: 16px; margin-top: 12px; color: var(--ink-2); } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; }
  `],
})
export class AdminOverviewComponent implements OnInit {
  private dashboard = inject(DashboardService);
  readonly cards = [
    { key: 'totalStudents', label: 'Registered students', icon: 'users', link: '/admin/students', accent: false },
    { key: 'totalTrainers', label: 'Active trainers', icon: 'user', link: '/admin/trainers', accent: true },
    { key: 'activeCourses', label: 'Active courses', icon: 'book', link: '/admin/courses', accent: false },
    { key: 'activeBatches', label: 'Active batches', icon: 'calendar', link: '/admin/batches', accent: true },
    { key: 'totalAppointments', label: 'Total appointments', icon: 'clock', link: '/admin/appointments', accent: false },
    { key: 'pendingAppointments', label: 'Pending appointments', icon: 'alert', link: '/admin/appointments', accent: true },
    { key: 'confirmedAppointments', label: 'Confirmed appointments', icon: 'check', link: '/admin/appointments', accent: false },
    { key: 'totalInquiries', label: 'Total inquiries', icon: 'inbox', link: '/admin/inquiries', accent: true },
  ];
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  data = signal<AdminDashboard | null>(null);
  private max = computed(() => Math.max(1, ...(this.data()?.trend || []).flatMap((m) => [m.registrations, m.enrollments, m.appointments])));

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.dashboard.admin().subscribe({ next: (d) => { this.data.set(d); this.loading.set(false); }, error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); } });
  }
  pct(v: number): number { return Math.round((v / this.max()) * 100); }
  monthLabel(m: string): string { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m.slice(5, 7)) - 1]; }
}
