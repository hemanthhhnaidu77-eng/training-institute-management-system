import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiErrorInfo, AppNotification } from '../../core/models/models';
import { NotificationService } from '../../core/services/domain.services';
import { AlertComponent, EmptyStateComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, IconComponent, LoaderComponent, AlertComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Notifications</h1><p>{{ unread() }} unread</p></div>
      <button type="button" class="btn btn-outline btn-sm" [disabled]="!unread()" (click)="markAll()">Mark all as read</button></div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="list">
        @for (n of items(); track n.id) {
          <article class="card note" [class.unread]="!n.isRead">
            <div class="icon-tile" [class.accent]="n.type === 'warning'"><app-icon [name]="n.type === 'success' ? 'check' : n.type === 'warning' ? 'alert' : 'bell'" [size]="18" /></div>
            <div class="grow"><div class="cell-title">{{ n.title }}</div><p class="mb-0 muted">{{ n.message }}</p><span class="small muted">{{ n.createdAt | date: 'medium' }}</span></div>
            <div class="actions">
              @if (n.link) { <button type="button" class="btn btn-sm btn-ghost" (click)="open(n)">Open</button> }
              @if (!n.isRead) { <button type="button" class="btn btn-sm btn-outline" (click)="markRead(n)">Mark read</button> }
            </div>
          </article>
        } @empty { <app-empty-state icon="bell" title="You're all caught up" message="Updates about enrollments, appointments and reviews will appear here." /> }
      </div>
    }
  `,
  styles: [`.list { display: grid; gap: 10px; } .note { display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; } .note.unread { border-left: 4px solid var(--accent); } .grow { flex: 1; } .actions { display: flex; gap: 6px; flex-wrap: wrap; }`],
})
export class NotificationsComponent implements OnInit {
  private service = inject(NotificationService);
  private router = inject(Router);
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<AppNotification[]>([]);
  unread = signal(0);

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.mine().subscribe({
      next: (r) => { this.items.set(r.items); this.unread.set(r.unread); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  markRead(n: AppNotification): void {
    this.service.markRead(n.id).subscribe({ next: () => { this.items.update((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); this.unread.update((u) => Math.max(u - 1, 0)); } });
  }
  markAll(): void {
    this.service.markAllRead().subscribe({ next: () => { this.items.update((l) => l.map((x) => ({ ...x, isRead: true }))); this.unread.set(0); } });
  }
  open(n: AppNotification): void {
    if (!n.isRead) this.markRead(n);
    if (n.link && n.link.startsWith('/')) this.router.navigateByUrl(n.link);
  }
}
