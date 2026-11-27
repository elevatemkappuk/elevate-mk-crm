import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PrivacyAdministrationPageComponent } from './privacy-administration-page.component';

@Component({
  selector: 'app-privacy-staff-permissions',
  imports: [CommonModule, FormsModule],
  templateUrl: './privacy-staff-permissions.component.html',
  styleUrls: ['./privacy-administration-shared.css', './privacy-staff-permissions.component.css'],
})
export class PrivacyStaffPermissionsComponent {
  readonly page = input.required<PrivacyAdministrationPageComponent>();
}
