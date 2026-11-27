import { Component, input } from '@angular/core';
import type { PrivacyAdministrationPageComponent } from './privacy-administration-page.component';

@Component({
  selector: 'app-privacy-role-defaults',
  templateUrl: './privacy-role-defaults.component.html',
  styleUrls: ['./privacy-administration-shared.css', './privacy-role-defaults.component.css'],
})
export class PrivacyRoleDefaultsComponent {
  readonly page = input.required<PrivacyAdministrationPageComponent>();
}
