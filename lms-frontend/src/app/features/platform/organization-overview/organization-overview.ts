import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommonHttpService } from '../../../services/common-http.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-organization-overview',
  standalone: true,
  imports: [CommonModule, PageHeader, StatCard, Skeleton, EmptyState],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header 
        [title]="organizationName() || 'Organization Overview'" 
        subtitle="High-level metrics for the current organization">
      </app-page-header>

      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <app-skeleton [height]="120"></app-skeleton>
          <app-skeleton [height]="120"></app-skeleton>
          <app-skeleton [height]="120"></app-skeleton>
        </div>
      } @else if (error()) {
        <div class="mt-4 flex flex-col items-center">
          <app-empty-state 
            title="Unable to load organization information." 
            message="There was an error fetching the organization overview. Please try again later.">
          </app-empty-state>
          <button class="mt-4 rounded-xl bg-teal-600 px-4 py-2 font-bold text-white transition hover:bg-teal-700" (click)="loadOverview()">
            Retry
          </button>
        </div>
      } @else if (overviewData()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <app-stat-card label="Students" [value]="studentCount()" icon="school"></app-stat-card>
          <app-stat-card label="Teachers" [value]="teacherCount()" icon="person_outline"></app-stat-card>
          <app-stat-card label="Admins" [value]="adminCount()" icon="admin_panel_settings"></app-stat-card>
        </div>
      } @else {
        <div class="mt-4">
          <app-empty-state 
            title="No Organization Data" 
            message="No organization overview data is currently available.">
          </app-empty-state>
        </div>
      }
    </div>
  `
})
export class OrganizationOverview implements OnInit {
  private http = inject(CommonHttpService);

  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  
  overviewData = signal<any>(null);
  organizationName = signal<string>('');
  
  studentCount = signal<number>(0);
  teacherCount = signal<number>(0);
  adminCount = signal<number>(0);

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading.set(true);
    this.error.set(false);
    
    this.http.getCurrentOrganization().subscribe({
      next: (res: any) => {
        const orgId = res?.data?.id;
        if (orgId) {
          this.fetchOverviewData(orgId);
        } else {
          this.loading.set(false);
          this.error.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private fetchOverviewData(orgId: string): void {
    this.http.getOrganizationOverview(orgId).subscribe({
      next: (res: any) => {
        const data = res?.data;
        if (data) {
          this.overviewData.set(data);
          this.organizationName.set(data?.name || 'Organization Overview');
          this.studentCount.set(Number(data?.student_count) || 0);
          this.teacherCount.set(Number(data?.teacher_count) || 0);
          this.adminCount.set(Number(data?.admin_count) || 0);
        } else {
          this.error.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
