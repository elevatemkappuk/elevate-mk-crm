import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import type { PrivacyAdministrationPageComponent } from './privacy-administration-page.component';

@Component({
  selector: 'app-privacy-governance-views',
  imports: [CommonModule],
  templateUrl: './privacy-governance-views.component.html',
  styleUrls: ['./privacy-administration-shared.css', './privacy-governance-views.component.css'],
})
export class PrivacyGovernanceViewsComponent {
  readonly page = input.required<PrivacyAdministrationPageComponent>();
}
