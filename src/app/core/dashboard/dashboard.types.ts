export interface DashboardCount { label: string; count: number; }
export interface MonthlyCount { month: string; count: number; }
export interface DashboardProjection {
  overview: { total_people: number; active_members: number; contacts: number; former_members: number; };
  growth: { people_by_month: MonthlyCount[]; members_by_month: MonthlyCount[]; };
  community_profile: {
    top_locations: DashboardCount[];
    top_industries: (DashboardCount & { id: number })[];
    age_ranges: (DashboardCount & { value: string })[];
  };
  attention: { imports_needing_review: number; archived_people: number; };
}
