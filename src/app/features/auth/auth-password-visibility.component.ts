import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'button[appPasswordVisibility]',
  template: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      @if (visible()) { <path d="m3 3 18 18" /> }
    </svg>
  `,
  host: {
    type: 'button',
    '[attr.aria-controls]': 'passwordInput().id',
    '[attr.aria-label]': '(visible() ? "Hide " : "Show ") + passwordLabel()',
    '[attr.title]': '(visible() ? "Hide " : "Show ") + passwordLabel()',
    '(click)': 'toggle()',
  },
})
export class AuthPasswordVisibilityComponent {
  readonly passwordInput = input.required<HTMLInputElement>({ alias: 'appPasswordVisibility' });
  readonly passwordLabel = input('password');
  readonly visible = signal(false);

  toggle(): void {
    this.visible.update((visible) => !visible);
    // Keep the native input, its value, and its reactive-form binding intact.
    this.passwordInput().type = this.visible() ? 'text' : 'password';
  }
}
