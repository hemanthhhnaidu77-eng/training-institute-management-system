import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('does not call the API when the form is invalid', () => {
    component.form.setValue({ email: 'not-an-email', password: '', remember: false });
    component.submit();
    http.expectNone(`${environment.apiUrl}/auth/login`);
    expect(component.form.controls.email.hasError('email')).toBeTrue();
    expect(component.form.controls.password.hasError('required')).toBeTrue();
  });

  it('shows the server message on invalid credentials', () => {
    component.form.setValue({ email: 'a@b.co', password: 'Wrong123', remember: false });
    component.submit();
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, { status: 401, statusText: 'Unauthorized' });
    expect(component.error()).toBe('Invalid email or password');
    expect(component.loading()).toBeFalse();
  });

  it('toggles password visibility', () => {
    expect(component.show()).toBeFalse();
    component.show.set(true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#password');
    expect(input.type).toBe('text');
  });
});
