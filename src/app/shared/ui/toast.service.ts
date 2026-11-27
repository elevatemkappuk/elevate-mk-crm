import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<readonly Toast[]>([]);
  private nextId = 1;

  show(tone: ToastTone, title: string, description?: string, durationMs = 5000): void {
    const toast = { id: this.nextId++, tone, title, description } satisfies Toast;
    this.toasts.update(items => [...items, toast]);
    globalThis.setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(title: string, description?: string): void { this.show('success', title, description); }
  info(title: string, description?: string): void { this.show('info', title, description); }
  warning(title: string, description?: string): void { this.show('warning', title, description); }
  error(title: string, description?: string): void { this.show('error', title, description, 8000); }

  dismiss(id: number): void {
    this.toasts.update(items => items.filter(item => item.id !== id));
  }
}
