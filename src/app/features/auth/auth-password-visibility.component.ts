import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'button[appPasswordVisibility]',
  template: `{{ visible() ? 'Hide' : 'Show' }}`,
  host: {
    type: 'button',
    '[attr.aria-controls]': 'passwordInput().id',
    '[attr.aria-label]': '(visible() ? "Hide " : "Show ") + passwordLabel()',
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
