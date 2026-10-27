import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AuthResult, Role, User } from '../models/models';
import { ToastService } from './toast.service';

const TOKEN_KEY = 'tim.token';
const USER_KEY = 'tim.user';
const EXP_KEY = 'tim.expiresAt';

/**
 * Holds the session. The JWT is stored in sessionStorage (or localStorage when
 * "remember me" is ticked). The server is the source of truth: every protected
 * API call is verified there, and the token is revoked on logout.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  private api = environment.apiUrl;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);

  constructor() {
    this.restore();
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  private get storage(): Storage {
    return localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  }

  private restore(): void {
    const token = this.token;
    const expiresAt = this.storage.getItem(EXP_KEY);
    if (!token || !expiresAt || Date.parse(expiresAt) <= Date.now()) {
      this.clearSession();
      return;
    }
    try {
      this._user.set(JSON.parse(this.storage.getItem(USER_KEY) || 'null'));
    } catch {
      this.clearSession();
      return;
    }
    this.scheduleExpiry(expiresAt);
    // Re-validate with the server (handles revoked tokens / deactivated accounts).
    // Deferred: the HTTP interceptors inject AuthService, so calling HttpClient
    // synchronously inside this constructor would create a circular DI lookup.
    setTimeout(() => {
      this.http.get<ApiResponse<User>>(`${this.api}/auth/me`).subscribe({
        next: (r) => this.updateUser(r.data),
        error: () => undefined,
      });
    });
  }

  private setSession(result: AuthResult, remember: boolean): void {
    this.clearStorage();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, result.token);
    store.setItem(EXP_KEY, result.expiresAt);
    store.setItem(USER_KEY, JSON.stringify(result.user));
    this._user.set(result.user);
    this.scheduleExpiry(result.expiresAt);
  }

  private scheduleExpiry(expiresAt: string): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const ms = Math.min(Date.parse(expiresAt) - Date.now(), 2_147_000_000);
    this.expiryTimer = setTimeout(() => this.handleUnauthorized('Your session has expired. Please log in again.'), Math.max(ms, 0));
  }

  private clearStorage(): void {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
      store.removeItem(EXP_KEY);
    }
  }

  clearSession(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.clearStorage();
    this._user.set(null);
  }

  /** Called by the error interceptor on 401 responses for an authenticated session. */
  handleUnauthorized(message: string): void {
    if (!this.isLoggedIn()) return;
    this.clearSession();
    this.toast.info(message);
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  updateUser(user: User): void {
    this._user.set(user);
    if (this.token) this.storage.setItem(USER_KEY, JSON.stringify(user));
  }

  /** Replaces the token after a password change / refresh, keeping the storage type. */
  replaceSession(result: AuthResult): void {
    this.setSession(result, this.storage === localStorage);
  }

  dashboardUrl(role: Role | null = this.role()): string {
    return role === 'admin' ? '/admin' : role === 'trainer' ? '/trainer' : role === 'student' ? '/student' : '/login';
  }

  login(email: string, password: string, remember: boolean): Observable<User> {
    return this.http.post<ApiResponse<AuthResult>>(`${this.api}/auth/login`, { email, password, remember }).pipe(
      tap((r) => this.setSession(r.data, remember)),
      map((r) => r.data.user)
    );
  }

  register(payload: { fullName: string; email: string; mobile: string; password: string; preferredCourseId?: string | null; acceptTerms: boolean }): Observable<User> {
    return this.http.post<ApiResponse<AuthResult>>(`${this.api}/auth/register`, payload).pipe(
      tap((r) => this.setSession(r.data, false)),
      map((r) => r.data.user)
    );
  }

  logout(): void {
    const done = () => {
      this.clearSession();
      this.router.navigate(['/login'], { queryParams: { loggedOut: 1 } });
    };
    if (!this.token) return done();
    this.http.post(`${this.api}/auth/logout`, {}).pipe(finalize(done)).subscribe({ error: () => undefined });
  }

  refresh(): Observable<AuthResult> {
    return this.http.post<ApiResponse<AuthResult>>(`${this.api}/auth/refresh`, {}).pipe(
      map((r) => r.data),
      tap((r) => this.replaceSession(r))
    );
  }

  forgotPassword(email: string): Observable<string> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.api}/auth/forgot-password`, { email }).pipe(map((r) => r.data.message));
  }

  resetPassword(token: string, password: string): Observable<string> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.api}/auth/reset-password`, { token, password }).pipe(map((r) => r.data.message));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<AuthResult> {
    return this.http.post<ApiResponse<AuthResult>>(`${this.api}/auth/change-password`, { currentPassword, newPassword }).pipe(
      map((r) => r.data),
      tap((r) => this.replaceSession(r))
    );
  }
}
