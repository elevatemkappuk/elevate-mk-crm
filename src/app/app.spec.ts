import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { AuthService } from './core/auth/auth.service';

class MockAuthService {
  readonly authInitialized = signal(false).asReadonly();
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthService, useClass: MockAuthService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the session restoration state while auth initializes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Restoring session');
  });
});
