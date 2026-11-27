import { PersonRecordType } from './people.types';

export function recordTypeLabel(value: PersonRecordType | string | undefined): string {
  return value === 'STAFF' ? 'Staff' : value === 'TECHNICAL' ? 'Technical' : value === 'COMMUNITY' ? 'Community' : 'Unknown';
}
