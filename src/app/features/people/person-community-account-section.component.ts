import { Component, input } from '@angular/core';

import { CommunityAccount, CommunityAccountStatus } from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { DetailListComponent, DetailListItem } from '../../shared/ui/detail-list.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-person-community-account-section',
  imports: [CrmSectionCardComponent, DetailListComponent, StatusBadgeComponent],
  templateUrl: './person-community-account-section.component.html',
  styleUrl: './person-community-account-section.component.scss',
})
export class PersonCommunityAccountSectionComponent {
  readonly account = input.required<CommunityAccount>();

  statusLabel(status: CommunityAccountStatus): string {
    return {
      ACTIVE: 'Active',
      SETUP_PENDING: 'Setup pending',
      NOT_SET_UP: 'Not set up',
      ACCESS_UNAVAILABLE: 'Access unavailable',
    }[status];
  }

  statusTone(status: CommunityAccountStatus): StatusBadgeTone {
    const tones: Record<CommunityAccountStatus, StatusBadgeTone> = {
      ACTIVE: 'success',
      SETUP_PENDING: 'warning',
      NOT_SET_UP: 'neutral',
      ACCESS_UNAVAILABLE: 'error',
    };
    return tones[status];
  }

  details(account: CommunityAccount): DetailListItem[] {
    const items: DetailListItem[] = [
      { label: 'Community access status', value: this.statusLabel(account.status) },
    ];

    if (account.account_email) {
      items.push({ label: 'Account email', value: account.account_email });
    }
    if (account.setup_email) {
      items.push({ label: 'Setup email', value: account.setup_email });
    }
    if (account.account_email) {
      items.push({ label: 'Account created', value: this.formatDateTime(account.account_created_at) });
      items.push({ label: 'Last sign in', value: this.formatDateTime(account.last_login_at) });
    }
    if (account.status === 'SETUP_PENDING') {
      if (account.invitation_delivery_status === 'SENT' && account.invitation_sent_at) {
        items.push({ label: 'Invitation sent', value: this.formatDateTime(account.invitation_sent_at) });
      } else {
        items.push({ label: 'Invitation delivery', value: this.deliveryLabel(account.invitation_delivery_status) });
      }
      items.push({ label: 'Invitation expires', value: this.formatDateTime(account.invitation_expires_at) });
    }
    return items;
  }

  deliveryLabel(status: CommunityAccount['invitation_delivery_status']): string {
    return {
      SENT: 'Sent',
      NOT_SENT: 'Not sent',
      DELIVERY_UNCERTAIN: 'Delivery uncertain',
      FAILED: 'Failed',
    }[status ?? 'NOT_SENT'];
  }

  formatDateTime(value: string | null): string | null {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  }
}
