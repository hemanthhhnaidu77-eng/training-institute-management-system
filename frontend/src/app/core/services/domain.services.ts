/**
 * Feature services. Each is a small, injectable facade over the REST API so
 * components never build URLs themselves.
 */
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import {
  ActivityEntry, AdminDashboard, AppNotification, Appointment, Availability, Batch, Course, Enrollment, EventItem, Faq,
  Inquiry, Paged, Report, Review, ScheduleData, ServiceItem, SessionRecord, Settings, StudentDashboard, StudentDetail,
  Testimonial, Trainer, TrainerDashboard, TrainerStudent, User,
} from '../models/models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private api = inject(ApiService);
  list(query: QueryParams = {}): Observable<{ items: Course[]; categories: string[]; total: number }> {
    return this.api.getWithMeta<Course[]>('/courses', query).pipe(
      map((r) => ({ items: r.data, categories: ((r.meta?.['categories'] as string[]) || []), total: r.meta?.total ?? r.data.length }))
    );
  }
  get(idOrSlug: string): Observable<Course> { return this.api.get<Course>(`/courses/${encodeURIComponent(idOrSlug)}`); }
}

@Injectable({ providedIn: 'root' })
export class TrainerService {
  private api = inject(ApiService);
  list(query: QueryParams = {}): Observable<Trainer[]> { return this.api.get<Trainer[]>('/trainers', query); }
  get(id: string): Observable<Trainer> { return this.api.get<Trainer>(`/trainers/${id}`); }
  me(): Observable<Trainer> { return this.api.get<Trainer>('/trainers/me'); }
  updateMe(body: Partial<Trainer>): Observable<Trainer> { return this.api.patch<Trainer>('/trainers/me', body); }
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogService {
  private api = inject(ApiService);
  list(): Observable<ServiceItem[]> { return this.api.get<ServiceItem[]>('/services'); }
}

@Injectable({ providedIn: 'root' })
export class BatchService {
  private api = inject(ApiService);
  list(query: QueryParams = {}): Observable<Batch[]> { return this.api.get<Batch[]>('/batches', query); }
  get(id: string): Observable<Batch> { return this.api.get<Batch>(`/batches/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private api = inject(ApiService);
  availability(date: string, trainerId?: string | null): Observable<Availability> { return this.api.get<Availability>('/appointments/availability', { date, trainerId }); }
  book(body: Record<string, unknown>): Observable<Appointment> { return this.api.post<Appointment>('/appointments', body); }
  mine(): Observable<Appointment[]> { return this.api.get<Appointment[]>('/appointments/my'); }
  cancel(id: string, reason: string): Observable<Appointment> { return this.api.patch<Appointment>(`/appointments/${id}/cancel`, { reason }); }
  reschedule(id: string, date: string, time: string, reason: string): Observable<Appointment> { return this.api.patch<Appointment>(`/appointments/${id}/reschedule`, { date, time, reason }); }
  adminList(query: QueryParams): Observable<Paged<Appointment>> { return this.api.getPaged<Appointment>('/admin/appointments', query); }
  adminAction(id: string, body: { action: string; date?: string; time?: string; note?: string }): Observable<Appointment> { return this.api.patch<Appointment>(`/admin/appointments/${id}/status`, body); }
  trainerList(): Observable<Appointment[]> { return this.api.get<Appointment[]>('/trainer/appointments'); }
  trainerAction(id: string, action: 'confirm' | 'complete', note?: string): Observable<Appointment> { return this.api.patch<Appointment>(`/trainer/appointments/${id}/status`, { action, note }); }
}

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private api = inject(ApiService);
  request(courseId: string, batchId?: string | null, note?: string): Observable<Enrollment> { return this.api.post<Enrollment>('/enrollments', { courseId, batchId, note }); }
  mine(): Observable<Enrollment[]> { return this.api.get<Enrollment[]>('/enrollments/my'); }
  withdraw(id: string): Observable<Enrollment> { return this.api.patch<Enrollment>(`/enrollments/${id}/cancel`); }
  adminList(query: QueryParams): Observable<Paged<Enrollment>> { return this.api.getPaged<Enrollment>('/admin/enrollments', query); }
  adminStatus(id: string, body: { status: string; batchId?: string | null; adminNote?: string }): Observable<Enrollment> { return this.api.patch<Enrollment>(`/admin/enrollments/${id}/status`, body); }
}

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private api = inject(ApiService);
  submit(body: Record<string, unknown>): Observable<{ ticketNo: string }> { return this.api.post<{ ticketNo: string }>('/inquiries', body); }
  mine(): Observable<Inquiry[]> { return this.api.get<Inquiry[]>('/inquiries/my'); }
  adminList(query: QueryParams): Observable<Paged<Inquiry>> { return this.api.getPaged<Inquiry>('/admin/inquiries', query); }
  adminGet(id: string): Observable<Inquiry> { return this.api.get<Inquiry>(`/admin/inquiries/${id}`); }
  setStatus(id: string, status: string, note?: string): Observable<Inquiry> { return this.api.patch<Inquiry>(`/admin/inquiries/${id}/status`, { status, note }); }
  addNote(id: string, note: string): Observable<Inquiry> { return this.api.post<Inquiry>(`/admin/inquiries/${id}/notes`, { note }); }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  mine(): Observable<{ items: AppNotification[]; unread: number }> {
    return this.api.getWithMeta<AppNotification[]>('/notifications/my').pipe(map((r) => ({ items: r.data, unread: Number(r.meta?.['unread'] ?? 0) })));
  }
  markRead(id: string): Observable<AppNotification> { return this.api.patch<AppNotification>(`/notifications/${id}/read`); }
  markAllRead(): Observable<{ updated: number }> { return this.api.patch<{ updated: number }>('/notifications/read-all'); }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private api = inject(ApiService);
  get(): Observable<User> { return this.api.get<User>('/profile'); }
  update(body: Partial<User>): Observable<User> { return this.api.patch<User>('/profile', body); }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  student(): Observable<StudentDashboard> { return this.api.get<StudentDashboard>('/dashboard/student'); }
  studentSchedule(): Observable<ScheduleData> { return this.api.get<ScheduleData>('/dashboard/student/schedule'); }
  admin(): Observable<AdminDashboard> { return this.api.get<AdminDashboard>('/dashboard/admin'); }
  trainer(): Observable<TrainerDashboard> { return this.api.get<TrainerDashboard>('/dashboard/trainer'); }
}

@Injectable({ providedIn: 'root' })
export class TrainerPortalService {
  private api = inject(ApiService);
  courses(): Observable<Course[]> { return this.api.get<Course[]>('/trainer/courses'); }
  batches(): Observable<Batch[]> { return this.api.get<Batch[]>('/trainer/batches'); }
  students(): Observable<TrainerStudent[]> { return this.api.get<TrainerStudent[]>('/trainer/students'); }
  schedule(): Observable<ScheduleData> { return this.api.get<ScheduleData>('/trainer/schedule'); }
  sessions(): Observable<SessionRecord[]> { return this.api.get<SessionRecord[]>('/trainer/sessions'); }
  recordSession(body: Record<string, unknown>): Observable<SessionRecord> { return this.api.post<SessionRecord>('/trainer/sessions', body); }
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private api = inject(ApiService);
  faqs(): Observable<Faq[]> { return this.api.get<Faq[]>('/faqs'); }
  testimonials(): Observable<Testimonial[]> { return this.api.get<Testimonial[]>('/testimonials'); }
  events(): Observable<EventItem[]> { return this.api.get<EventItem[]>('/events'); }
  reviews(courseId?: string): Observable<Review[]> { return this.api.get<Review[]>('/reviews', { courseId }); }
  myReviews(): Observable<Review[]> { return this.api.get<Review[]>('/reviews/my'); }
  submitReview(body: { courseId: string; rating: number; comment: string }): Observable<Review> { return this.api.post<Review>('/reviews', body); }
  subscribe(email: string): Observable<{ message: string }> { return this.api.post<{ message: string }>('/newsletter', { email }); }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(ApiService);
  private cache$?: Observable<Settings>;
  get(force = false): Observable<Settings> {
    if (!this.cache$ || force) this.cache$ = this.api.get<Settings>('/settings').pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.cache$;
  }
  update(body: Partial<Settings>): Observable<Settings> {
    return this.api.put<Settings>('/settings', body).pipe(map((s) => {
      this.cache$ = undefined;
      return s;
    }));
  }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private api = inject(ApiService);
  students(query: QueryParams): Observable<Paged<User>> { return this.api.getPaged<User>('/students', query); }
  student(id: string): Observable<StudentDetail> { return this.api.get<StudentDetail>(`/students/${id}`); }
  updateStudent(id: string, body: Partial<User>): Observable<User> { return this.api.patch<User>(`/students/${id}`, body); }
  staff(): Observable<User[]> { return this.api.get<User[]>('/admin/users'); }
  createStaff(body: Record<string, unknown>): Observable<User> { return this.api.post<User>('/admin/users', body); }
  reviews(status?: string): Observable<Review[]> { return this.api.get<Review[]>('/admin/reviews', { status }); }
  moderateReview(id: string, status: string, publishAsTestimonial: boolean): Observable<Review> { return this.api.patch<Review>(`/admin/reviews/${id}/status`, { status, publishAsTestimonial }); }
  deleteReview(id: string): Observable<unknown> { return this.api.delete(`/admin/reviews/${id}`); }
  report(type: string, from?: string, to?: string): Observable<Report> { return this.api.get<Report>(`/admin/reports/${type}`, { from, to }); }
  reportCsv(type: string, from?: string, to?: string): Observable<Blob> { return this.api.download(`/admin/reports/${type}`, { from, to, format: 'csv' }); }
  activity(limit = 50): Observable<ActivityEntry[]> { return this.api.get<ActivityEntry[]>('/admin/activity', { limit }); }
  newsletter(): Observable<{ id: string; email: string; createdAt: string }[]> { return this.api.get('/admin/newsletter'); }
  /** Generic CRUD used by the admin content manager. */
  list<T>(endpoint: string, query: QueryParams = {}): Observable<T[]> { return this.api.get<T[]>(endpoint, query); }
  create<T>(endpoint: string, body: unknown): Observable<T> { return this.api.post<T>(endpoint, body); }
  update<T>(endpoint: string, id: string, body: unknown): Observable<T> { return this.api.put<T>(`${endpoint}/${id}`, body); }
  remove(endpoint: string, id: string, query: QueryParams = {}): Observable<unknown> { return this.api.delete(`${endpoint}/${id}`, query); }
}
