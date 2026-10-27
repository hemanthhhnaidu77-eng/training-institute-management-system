import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader" role="status" [class.inline]="inline">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ label }}</span>
    </div>
  `,
  styles: [`
    .loader { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 48px 16px; color: var(--ink-3); font-weight: 500; }
    .loader.inline { padding: 8px 0; justify-content: flex-start; }
    .spinner { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--navy-100); border-top-color: var(--navy-800); animation: spin 0.8s linear infinite; }
  `],
})
export class LoaderComponent {
  @Input() label = 'Loading...';
  @Input() inline = false;
}

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert" [class]="'alert alert-' + type" [attr.role]="type === 'error' ? 'alert' : 'status'">
      <app-icon [name]="type === 'success' ? 'check' : type === 'error' || type === 'warning' ? 'alert' : 'info'" [size]="18" />
      <div class="body">
        @if (title) { <strong>{{ title }}</strong> }
        <div><ng-content /></div>
      </div>
      @if (retry.observed) {
        <button type="button" class="btn btn-sm btn-outline" (click)="retry.emit()">Retry</button>
      }
    </div>
  `,
  styles: ['.body { flex: 1; } strong { display: block; margin-bottom: 2px; }'],
})
export class AlertComponent {
  @Input() type: 'success' | 'error' | 'warning' | 'info' = 'info';
  @Input() title = '';
  @Output() retry = new EventEmitter<void>();
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="icon-tile accent"><app-icon [name]="icon" [size]="24" /></div>
      <h3>{{ title }}</h3>
      @if (message) { <p class="muted">{{ message }}</p> }
      @if (actionLabel && actionLink) { <a class="btn btn-primary btn-sm" [routerLink]="actionLink">{{ actionLabel }}</a> }
      <ng-content />
    </div>
  `,
  styles: [`
    .empty { text-align: center; padding: 40px 20px; border: 1.5px dashed var(--line); border-radius: var(--radius); background: var(--white); display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty h3 { margin: 8px 0 0; } .empty p { max-width: 420px; margin: 0 0 8px; }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() actionLink: string | null = null;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-warning', new: 'badge-warning', in_progress: 'badge-info', confirmed: 'badge-success', approved: 'badge-success',
  active: 'badge-success', upcoming: 'badge-info', ongoing: 'badge-accent', rescheduled: 'badge-info', completed: 'badge-muted',
  resolved: 'badge-success', closed: 'badge-muted', cancelled: 'badge-danger', rejected: 'badge-danger', archived: 'badge-muted',
  draft: 'badge-muted', inactive: 'badge-danger', subscribed: 'badge-success',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge ' + cls">{{ label }}</span>`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status = '';
  get cls(): string { return STATUS_CLASS[this.status] || ''; }
  get label(): string { return (this.status || '').replace(/_/g, ' '); }
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages > 1) {
      <nav class="pager" aria-label="Pagination">
        <button type="button" class="btn btn-sm btn-ghost" [disabled]="page <= 1" (click)="go(page - 1)" aria-label="Previous page"><app-icon name="chevron-left" [size]="16" /> Prev</button>
        <span class="muted small">Page {{ page }} of {{ totalPages }} &middot; {{ total }} records</span>
        <button type="button" class="btn btn-sm btn-ghost" [disabled]="page >= totalPages" (click)="go(page + 1)" aria-label="Next page">Next <app-icon name="chevron-right" [size]="16" /></button>
      </nav>
    } @else if (total > 0) {
      <p class="muted small pager-single">{{ total }} record{{ total === 1 ? '' : 's' }}</p>
    }
  `,
  styles: ['.pager { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 16px; } .pager-single { margin-top: 12px; }'],
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() total = 0;
  @Output() pageChange = new EventEmitter<number>();
  go(p: number): void { if (p >= 1 && p <= this.totalPages) this.pageChange.emit(p); }
}

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title" [class.wide]="wide" (keydown.escape)="close.emit()" tabindex="-1">
      <header>
        <h3>{{ title }}</h3>
        <button type="button" class="btn btn-icon btn-ghost" (click)="close.emit()" aria-label="Close dialog"><app-icon name="x" /></button>
      </header>
      <div class="content"><ng-content /></div>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; padding: 16px; }
    .backdrop { position: absolute; inset: 0; background: rgba(6, 21, 40, 0.55); backdrop-filter: blur(2px); }
    .modal { position: relative; width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); animation: fade-up 0.2s ease; }
    .modal.wide { width: min(880px, 100%); }
    header { position: sticky; top: 0; background: var(--white); display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid var(--line); z-index: 1; }
    header h3 { margin: 0; }
    .content { padding: 24px; }
  `],
})
export class ModalComponent {
  @Input() title = '';
  @Input() wide = false;
  @Output() close = new EventEmitter<void>();
}
