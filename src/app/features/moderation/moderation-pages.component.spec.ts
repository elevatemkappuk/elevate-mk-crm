import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CommunityModerationService } from '../../core/community-moderation/community-moderation.service';
import { ModerationReport } from '../../core/community-moderation/community-moderation.types';
import { ModerationQueuePageComponent } from './moderation-queue-page.component';
import { ModerationReportPageComponent } from './moderation-report-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

const report: ModerationReport = {
  report_id: 'report-1', reason: 'OTHER', details: 'Needs review', status: 'OPEN', created_at: '2026-10-07T10:00:00Z', resolved_at: null,
  reporter: { directory_id: null, first_name: 'Report', last_name: 'Person', location: 'MK', job_title: 'Designer' },
  target: { type: 'POST', public_id: 'post-1', status: 'ACTIVE', headline: 'A useful headline', body: 'A useful body', author: { directory_id: null, first_name: 'Target', last_name: 'Person', location: 'MK', job_title: 'Founder' }, parent_post: null },
};

describe('moderation pages', () => {
  it('renders the open queue with human-readable reason and target labels', async () => {
    const service = { list: vi.fn(() => of({ count: 1, next: null, previous: null, results: [report] })) };
    await TestBed.configureTestingModule({ imports: [ModerationQueuePageComponent], providers: [provideRouter([]), { provide: CommunityModerationService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(ModerationQueuePageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Other');
    expect(fixture.nativeElement.textContent).toContain('POST');
    expect(fixture.nativeElement.textContent).toContain('Target Person');
    expect(service.list).toHaveBeenCalledWith(1);
  });

  it('renders report detail and sends a bounded remove action', async () => {
    const service = { get: vi.fn(() => of(report)), action: vi.fn(() => of({ ...report, status: 'RESOLVED', target: { ...report.target, status: 'MODERATOR_REMOVED' } })) };
    await TestBed.configureTestingModule({ imports: [ModerationReportPageComponent], providers: [provideRouter([{ path: 'moderation', component: DummyRouteComponent }]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'report-1' } } } }, { provide: CommunityModerationService, useValue: service }] }).compileComponents();
    const fixture: ComponentFixture<ModerationReportPageComponent> = TestBed.createComponent(ModerationReportPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Needs review');
    (fixture.componentInstance as ModerationReportPageComponent).requestAction('remove');
    fixture.componentInstance.confirmAction();
    expect(service.action).toHaveBeenCalledWith('report-1', 'remove', '');
  });

  it('keeps a safe error state when the queue fails', async () => {
    const service = { list: vi.fn(() => throwError(() => new Error('failed'))) };
    await TestBed.configureTestingModule({ imports: [ModerationQueuePageComponent], providers: [provideRouter([]), { provide: CommunityModerationService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(ModerationQueuePageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reports could not be loaded right now. Try again.');
  });
});
