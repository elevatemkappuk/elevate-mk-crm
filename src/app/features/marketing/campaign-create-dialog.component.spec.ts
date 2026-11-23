import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudienceSelection } from '../../core/marketing/audience.types';
import { CampaignCreateDialogComponent } from './campaign-create-dialog.component';

describe('CampaignCreateDialogComponent', () => {
  let fixture: ComponentFixture<CampaignCreateDialogComponent>;
  const selection: AudienceSelection = { q: 'mentor', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CampaignCreateDialogComponent] });
    fixture = TestBed.createComponent(CampaignCreateDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('selection', selection);
    fixture.detectChanges();
  });

  it('requires a campaign name and emits the trimmed name once valid', () => {
    let submitted = '';
    fixture.componentInstance.submitted.subscribe((name) => submitted = name);
    fixture.componentInstance.submit();
    expect(submitted).toBe('');
    fixture.componentInstance.form.controls.name.setValue('  Mentor Campaign  ');
    fixture.componentInstance.submit();
    expect(submitted).toBe('Mentor Campaign');
  });

  it('prevents duplicate submission while the create request is busy', () => {
    let submissions = 0;
    fixture.componentInstance.submitted.subscribe(() => submissions++);
    fixture.componentInstance.form.controls.name.setValue('Mentor Campaign');
    fixture.componentRef.setInput('busy', true);
    fixture.componentInstance.submit();
    expect(submissions).toBe(0);
  });
});
