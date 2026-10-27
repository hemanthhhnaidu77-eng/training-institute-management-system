import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, TrainerDashboard } from '../../core/models/models';
import { DashboardService } from '../../core/services/domain.services';
import { AlertComponent, EmptyStateComponent, LoaderComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-trainer-overview',
  standalone: true,
  imports: [RouterLink, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Trainer dashboard</h1><p>Your courses, batches, students and appointments.</p></div></div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (data()) {
      @if (data()!.profileMissing) { <app-alert type="warning" title="No trainer profile linked">Ask an administrator to link your account to a trainer profile.</app-alert> }
      @else {
        <div class="grid grid-4 mb-3">
          @for (s of cards; track s.key) {
            <a class="card stat-card card-hover" [routerLink]="s.link"><div class="icon-tile" [class.accent]="$index % 2"><app-icon [name]="s.icon" /></div><div><div class="value">{{ data()!.stats[s.key] ?? 0 }}</div><div class="label">{{ s.label }}</div></div></a>
          }
        </div>
        <div class="grid grid-2">
          <section class="card"><div class="flex between mb-2"><h3 class="mb-0">This week's classes</h3><a routerLink="/trainer/schedule" class="small">Full schedule</a></div>
            @for (c of data()!.nextClasses || []; track c.date + c.batchId) { <div class="row"><div class="cell-title">{{ c.courseTitle }}</div><div class="muted small">{{ c.day }} {{ c.date }} &middot; {{ c.startTime }}-{{ c.endTime }} &middot; {{ c.batchName }}</div></div> }
            @empty { <app-empty-state icon="calendar" title="No classes this week" /> }</section>
          <section class="card"><div class="flex between mb-2"><h3 class="mb-0">Upcoming appointments</h3><a routerLink="/trainer/appointments" class="small">Manage</a></div>
            @for (a of data()!.nextAppointments || []; track a.id) { <div class="row flex between"><div><div class="cell-title">{{ a.fullName }}</div><div class="muted small">{{ a.date }} {{ a.time }} &middot; {{ a.mode }}</div></div><app-status-badge [status]="a.status" /></div> }
            @empty { <app-empty-state icon="clock" title="No upcoming appointments" /> }</section>
        </div>
      }
    }
  `,
  styles: ['.row { padding: 10px 0; border-bottom: 1px solid var(--line); } .row:last-child { border-bottom: none; } a.stat-card { color: inherit; }'],
})
export class TrainerOverviewComponent implements OnInit {
  private dashboard = inject(DashboardService);
  readonly cards = [
    { key: 'assignedCourses', label: 'Assigned courses', icon: 'book', link: '/trainer/courses' },
    { key: 'activeBatches', label: 'Active batches', icon: 'layers', link: '/trainer/batches' },
    { key: 'students', label: 'Students', icon: 'users', link: '/trainer/students' },
    { key: 'upcomingAppointments', label: 'Upcoming appointments', icon: 'clock', link: '/trainer/appointments' },
  ];
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  data = signal<TrainerDashboard | null>(null);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboard.trainer().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
