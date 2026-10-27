import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiErrorInfo, StudentDashboard } from '../../core/models/models';
import { DashboardService } from '../../core/services/domain.services';
import { AlertComponent, EmptyStateComponent, LoaderComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-student-overview',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Dashboard</h1><p>Your courses, classes and appointments at a glance.</p></div>
      <div class="flex flex-wrap"><a routerLink="/courses" class="btn btn-outline btn-sm">Browse courses</a><a routerLink="/appointments" class="btn btn-accent btn-sm">Book appointment</a></div></div>
    @if (loading()) { <app-loader label="Loading your dashboard..." /> }
    @else if (error()) { <app-alert type="error" title="Dashboard unavailable" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (data()) {
      <div class="grid grid-4 mb-3">
        <a class="card stat-card card-hover" routerLink="/student/courses"><div class="icon-tile"><app-icon name="book" /></div><div><div class="value">{{ data()!.stats.enrolledCourses }}</div><div class="label">Enrolled courses</div></div></a>
        <a class="card stat-card card-hover" routerLink="/student/appointments"><div class="icon-tile accent"><app-icon name="clock" /></div><div><div class="value">{{ data()!.stats.upcomingAppointments }}</div><div class="label">Upcoming appointments</div></div></a>
        <a class="card stat-card card-hover" routerLink="/student/schedule"><div class="icon-tile"><app-icon name="calendar" /></div><div><div class="value">{{ data()!.stats.upcomingClasses }}</div><div class="label">Classes (next 14 days)</div></div></a>
        <a class="card stat-card card-hover" routerLink="/student/courses"><div class="icon-tile accent"><app-icon name="award" /></div><div><div class="value">{{ data()!.stats.completedCourses }}</div><div class="label">Completed courses</div></div></a>
      </div>
      <div class="flex flex-wrap mb-3 chips">
        <span class="badge badge-warning">{{ data()!.stats.pendingEnrollments }} pending enrollment request(s)</span>
        <span class="badge badge-info">{{ data()!.stats.pendingInquiries }} open inquiry(ies)</span>
        <span class="badge">{{ data()!.stats.unreadNotifications }} unread notification(s)</span>
      </div>
      <div class="grid grid-2">
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Upcoming classes</h3><a routerLink="/student/schedule" class="small">Full schedule</a></div>
          @for (s of data()!.nextClasses; track s.date + s.batchId) {
            <div class="row"><div class="cell-title">{{ s.courseTitle }}</div><div class="muted small">{{ s.day }} {{ s.date }} &middot; {{ s.startTime }}-{{ s.endTime }} &middot; {{ s.mode }}</div></div>
          } @empty { <app-empty-state icon="calendar" title="No classes scheduled" message="Classes appear once an enrollment is approved and assigned to a batch." actionLabel="Explore courses" actionLink="/courses" /> }
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Upcoming appointments</h3><a routerLink="/student/appointments" class="small">Manage</a></div>
          @for (a of data()!.nextAppointments; track a.id) {
            <div class="row flex between"><div><div class="cell-title">{{ a.date }} at {{ a.time }}</div><div class="muted small">{{ a.appointmentNo }} &middot; {{ a.mode }}{{ a.trainerName ? ' · ' + a.trainerName : '' }}</div></div><app-status-badge [status]="a.status" /></div>
          } @empty { <app-empty-state icon="clock" title="No upcoming appointments" message="Talk to a counsellor or trainer whenever you need guidance." actionLabel="Book a consultation" actionLink="/appointments" /> }
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Enrollment status</h3><a routerLink="/student/courses" class="small">My courses</a></div>
          @for (e of data()!.enrollments; track e.id) {
            <div class="row flex between"><div><div class="cell-title">{{ e.courseTitle }}</div><div class="muted small">{{ e.batch ? e.batch.name : 'Batch to be assigned' }}</div></div><app-status-badge [status]="e.status" /></div>
          } @empty { <app-empty-state icon="book" title="No enrollments yet" message="Pick a course and send an enrollment request." actionLabel="Browse courses" actionLink="/courses" /> }
        </section>
        <section class="card">
          <div class="flex between mb-2"><h3 class="mb-0">Latest notifications</h3><a routerLink="/student/notifications" class="small">View all</a></div>
          @for (n of data()!.notifications; track n.id) {
            <div class="row"><div class="cell-title">{{ n.title }} @if (!n.isRead) { <span class="badge badge-accent">new</span> }</div><div class="muted small">{{ n.message }} &middot; {{ n.createdAt | date: 'short' }}</div></div>
          } @empty { <p class="muted mb-0">No notifications yet.</p> }
        </section>
      </div>
    }
  `,
  styles: ['.row { padding: 10px 0; border-bottom: 1px solid var(--line); } .row:last-child { border-bottom: none; } a.stat-card { color: inherit; } .chips { gap: 8px; }'],
})
export class StudentOverviewComponent implements OnInit {
  private dashboard = inject(DashboardService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  data = signal<StudentDashboard | null>(null);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboard.student().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
