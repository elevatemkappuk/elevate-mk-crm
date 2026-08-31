import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-page-shell',
  template: `<section class="auth-layout"><div class="auth-card"><p class="eyebrow">Elevate MK Staff CRM</p><ng-content /></div></section>`,
  styles: `.auth-layout{min-height:100vh;display:grid;place-items:center;padding:2rem}.auth-card{width:min(100%,28rem);padding:2rem;border-radius:1.25rem;border:1px solid rgba(23,42,58,.14);background:rgba(255,255,255,.88);box-shadow:0 24px 60px rgba(19,33,46,.12);backdrop-filter:blur(18px)}.eyebrow{margin:0 0 .75rem;text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;color:#476074}`,
})
export class AuthPageShellComponent {}
