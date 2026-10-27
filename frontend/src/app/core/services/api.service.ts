import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged } from '../models/models';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Thin wrapper around HttpClient that unwraps the API envelope { success, data, meta }. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly base = environment.apiUrl;

  private params(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return params;
  }

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(this.base + path, { params: this.params(query) }).pipe(map((r) => r.data));
  }

  getPaged<T>(path: string, query?: QueryParams): Observable<Paged<T>> {
    return this.http
      .get<ApiResponse<T[]>>(this.base + path, { params: this.params(query) })
      .pipe(map((r) => ({ items: r.data, meta: (r.meta as Paged<T>['meta']) || { total: r.data.length } })));
  }

  getWithMeta<T>(path: string, query?: QueryParams): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(this.base + path, { params: this.params(query) });
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.base + path, body).pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.base + path, body).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<ApiResponse<T>>(this.base + path, body).pipe(map((r) => r.data));
  }

  delete<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http.delete<ApiResponse<T>>(this.base + path, { params: this.params(query) }).pipe(map((r) => r.data));
  }

  download(path: string, query?: QueryParams): Observable<Blob> {
    return this.http.get(this.base + path, { params: this.params(query), responseType: 'blob' });
  }
}
