import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiErrorInfo, ScheduleData } from '../../core/models/models';
import { DashboardService } from '../../core/services/domain.services';
import { ScheduleViewComponent } from '../../shared/components/content.components';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';

@Component({
  selector: 'app-student-schedule',
  standalone: true,
  imports: [ScheduleViewComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>My schedule</h1><p>Class timings for your approved batches.</p></div></div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (data()) {
      @if (data()!.batches.length) { <app-schedule-view [batches]="data()!.batches" [sessions]="data()!.sessions" /> }
      @else { <app-empty-state icon="calendar" title="No classes yet" message="Your timetable appears once an enrollment is approved and assigned to a batch." actionLabel="View my courses" actionLink="/student/courses" /> }
    }
  `,
})
export class StudentScheduleComponent implements OnInit {
  private dashboard = inject(DashboardService);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  data = signal<ScheduleData | null>(null);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboard.studentSchedule().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
