import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; type: 'success' | 'error' | 'info' | 'warning'; message: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  show(type: Toast['type'], message: string, timeout = 4500): void {
    const id = ++this.counter;
    this.toasts.update((list) => [...list, { id, type, message }].slice(-4));
    setTimeout(() => this.dismiss(id), timeout);
  }
  success(message: string): void { this.show('success', message); }
  error(message: string): void { this.show('error', message, 6500); }
  info(message: string): void { this.show('info', message); }
  dismiss(id: number): void { this.toasts.update((list) => list.filter((t) => t.id !== id)); }
}
