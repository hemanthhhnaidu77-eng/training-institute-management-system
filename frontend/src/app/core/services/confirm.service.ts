import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions { title: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean; }
interface ConfirmState extends ConfirmOptions { resolve: (value: boolean) => void; }

/** Promise-based confirmation dialog rendered by <app-confirm-dialog> in the root component. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.state.set({ confirmText: 'Confirm', cancelText: 'Cancel', ...options, resolve }));
  }

  close(result: boolean): void {
    const current = this.state();
    if (current) current.resolve(result);
    this.state.set(null);
  }
}
