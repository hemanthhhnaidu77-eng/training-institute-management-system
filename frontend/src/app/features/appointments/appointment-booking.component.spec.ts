import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { AppointmentBookingComponent } from './appointment-booking.component';

describe('AppointmentBookingComponent', () => {
  let fixture: ComponentFixture<AppointmentBookingComponent>;
  let component: AppointmentBookingComponent;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppointmentBookingComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AppointmentBookingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  function flushLists(): void {
    http.expectOne((r) => r.url === `${api}/courses`).flush({ success: true, data: [], meta: { total: 0, categories: [] } });
    http.expectOne(`${api}/services`).flush({ success: true, data: [] });
    http.expectOne(`${api}/trainers`).flush({ success: true, data: [] });
  }

  it('validates required fields, email and mobile before booking', () => {
    flushLists();
    component.form.patchValue({ fullName: '', email: 'bad', mobile: '123' });
    component.submit();
    expect(component.form.controls.fullName.hasError('required')).toBeTrue();
    expect(component.form.controls.email.hasError('email')).toBeTrue();
    expect(component.form.controls.mobile.hasError('mobile')).toBeTrue();
    expect(component.form.controls.time.hasError('required')).toBeTrue();
    http.expectNone(`${api}/appointments`);
  });

  it('rejects dates in the past', () => {
    flushLists();
    component.form.controls.date.setValue('2000-01-01');
    expect(component.form.controls.date.hasError('pastDate')).toBeTrue();
  });

  it('shows an error state when the backend is unreachable', () => {
    http.expectOne((r) => r.url === `${api}/courses`).error(new ProgressEvent('error'), { status: 0 });
    http.match(() => true).forEach((r) => { if (!r.cancelled) r.flush({ success: true, data: [] }); });
    fixture.detectChanges();
    expect(component.listError()?.code).toBe('NETWORK_ERROR');
    expect(fixture.nativeElement.textContent).toContain('Booking is temporarily unavailable');
  });
});
