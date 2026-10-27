import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';
import { ModalComponent } from './feedback.components';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast t-' + t.type" role="status">
          <app-icon [name]="t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'info'" [size]="18" />
          <span>{{ t.message }}</span>
          <button type="button" (click)="toast.dismiss(t.id)" aria-label="Dismiss"><app-icon name="x" [size]="16" /></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toasts { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; max-width: min(420px, calc(100vw - 32px)); }
    .toast { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px; border-radius: 12px; background: var(--navy-900); color: var(--white); box-shadow: var(--shadow-lg); animation: fade-up 0.25s ease; font-size: 0.93rem; }
    .toast span { flex: 1; }
    .t-success app-icon { color: #6ee7a8; } .t-error { background: #7a1a12; } .t-warning app-icon, .t-info app-icon { color: var(--accent); }
    button { background: none; border: none; color: inherit; opacity: 0.7; cursor: pointer; padding: 0; }
  `],
})
export class ToastContainerComponent {
  toast = inject(ToastService);
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.state(); as s) {
      <app-modal [title]="s.title" (close)="confirm.close(false)">
        <p>{{ s.message }}</p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" (click)="confirm.close(false)">{{ s.cancelText }}</button>
          <button type="button" class="btn" [class.btn-danger]="s.danger" [class.btn-primary]="!s.danger" (click)="confirm.close(true)">{{ s.confirmText }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);
}
