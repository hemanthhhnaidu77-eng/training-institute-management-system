import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { StudentOverviewComponent } from './student-overview.component';

describe('StudentOverviewComponent', () => {
  let fixture: ComponentFixture<StudentOverviewComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentOverviewComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentOverviewComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('renders stats returned by the API', () => {
    http.expectOne(`${environment.apiUrl}/dashboard/student`).flush({ success: true, data: {
      stats: { enrolledCourses: 2, pendingEnrollments: 1, completedCourses: 0, upcomingAppointments: 3, upcomingClasses: 4, pendingInquiries: 0, unreadNotifications: 1 },
      nextAppointments: [], nextClasses: [], enrollments: [], notifications: [] } });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Enrolled courses');
    expect(text).toContain('No upcoming appointments');
  });

  it('shows an error with retry when the API fails (no mock data substituted)', () => {
    http.expectOne(`${environment.apiUrl}/dashboard/student`).flush({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server problem' } }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Dashboard unavailable');
    expect(text).toContain('Retry');
    expect(text).not.toContain('Enrolled courses');
  });
});
