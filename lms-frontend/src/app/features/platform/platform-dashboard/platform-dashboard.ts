import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CommonHttpService } from '../../../services/common-http.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  imports: [CommonModule, PageHeader, StatCard],
  template: `
    <div class="p-4">
      <app-page-header title="Platform Dashboard" subtitle="Platform-level LMS operations"></app-page-header>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <app-stat-card label="Organizations" [value]="organization() ? 1 : 0" icon="business"></app-stat-card>
        <app-stat-card label="Users" [value]="members()" icon="group"></app-stat-card>
        <app-stat-card label="Activity" [value]="activity()" icon="query_stats"></app-stat-card>
      </div>
    </div>
  `,
})
export class PlatformDashboard {
  organization = signal<any>(null);
  members = signal(0);
  activity = signal(0);
  private http = inject(CommonHttpService);

  ngOnInit() {
    this.http.getCurrentOrganization().subscribe((res: any) => this.organization.set(res?.data || null));
    this.http.getMembers({ limit: 1 }).subscribe((res: any) => this.members.set(res?.data?.pagination?.total || 0));
    this.http.getLocalDashboardMe().subscribe((res: any) => this.activity.set(res?.data?.stats?.assigned_courses || 0));
  }
}
