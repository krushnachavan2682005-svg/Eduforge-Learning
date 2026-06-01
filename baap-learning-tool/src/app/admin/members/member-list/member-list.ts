import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { HeaderComponent } from '../../../shared/header.component';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  template: `
    <div class="p-4">
      <app-header
        [showBackBtnAndTitleSubtitle]="true"
        titleName="Members"
        subTitle="Manage teachers and students in your organization"
      >
        <button
          header-actions
          class="px-3 py-2 rounded theme-bg-secondary theme-bg-gray font-semibold"
          routerLink="/admin/members/create"
        >
          Create Member
        </button>
      </app-header>

      <div class="flex flex-wrap gap-3 mb-4">
        <input
          class="px-3 py-2 rounded theme-bg-secondary theme-border min-w-64"
          placeholder="Search members"
          [(ngModel)]="search"
          (ngModelChange)="loadMembers(1)"
        />
        <select
          class="px-3 py-2 rounded theme-bg-secondary theme-border"
          [(ngModel)]="role"
          (ngModelChange)="loadMembers(1)"
        >
          <option value="">All roles</option>
          <option value="organization_admin">Organization Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="reviewer">Reviewer</option>
        </select>
        <select
          class="px-3 py-2 rounded theme-bg-secondary theme-border"
          [(ngModel)]="active"
          (ngModelChange)="loadMembers(1)"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary rounded theme-border">Loading members...</div>
      } @else if (!members().length) {
        <div class="p-6 theme-bg-secondary rounded theme-border">
          No members found.
        </div>
      } @else {
        <div class="overflow-x-auto rounded theme-border">
          <table class="w-full text-left">
            <thead class="theme-bg-secondary">
              <tr>
                <th class="p-3">Name</th>
                <th class="p-3">Email</th>
                <th class="p-3">Roles</th>
                <th class="p-3">Status</th>
                <th class="p-3">Created</th>
                <th class="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (member of members(); track member.id) {
                <tr class="theme-border border-t">
                  <td class="p-3 font-medium">
                    {{ member.user?.first_name }} {{ member.user?.last_name }}
                  </td>
                  <td class="p-3">{{ member.user?.email }}</td>
                  <td class="p-3">
                    @for (role of member.roles; track role.id) {
                      <span class="inline-block mr-1 mb-1 px-2 py-1 text-xs rounded theme-bg-secondary theme-border">
                        {{ role.name }}
                      </span>
                    }
                  </td>
                  <td class="p-3">
                    <span
                      class="px-2 py-1 text-xs rounded"
                      [ngClass]="member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                    >
                      {{ member.status }}
                    </span>
                  </td>
                  <td class="p-3">{{ member.created_at | date: 'mediumDate' }}</td>
                  <td class="p-3 text-right">
                    <button
                      class="px-3 py-1 rounded theme-bg-secondary theme-border"
                      (click)="viewMember(member.id)"
                    >
                      View
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-center mt-4">
          <span class="text-sm">Page {{ pagination()?.page || 1 }} of {{ pagination()?.totalPages || 1 }}</span>
          <div class="flex gap-2">
            <button class="px-3 py-2 rounded theme-bg-secondary theme-border" [disabled]="page <= 1" (click)="loadMembers(page - 1)">
              Previous
            </button>
            <button class="px-3 py-2 rounded theme-bg-secondary theme-border" [disabled]="page >= (pagination()?.totalPages || 1)" (click)="loadMembers(page + 1)">
              Next
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class MemberList {
  search = '';
  role = '';
  active = '';
  page = 1;
  limit = 10;
  members = signal<any[]>([]);
  pagination = signal<any>(null);
  isLoading = signal(false);

  private router = inject(Router);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.loadMembers();
  }

  loadMembers(page = this.page) {
    this.page = page;
    this.isLoading.set(true);
    this.commonHttp
      .getMembers({
        search: this.search,
        role: this.role,
        active: this.active,
        page: this.page,
        limit: this.limit,
      })
      .subscribe({
        next: (res: any) => {
          this.members.set(res?.data?.items || []);
          this.pagination.set(res?.data?.pagination || null);
          this.isLoading.set(false);
        },
        error: () => {
          this.members.set([]);
          this.pagination.set(null);
          this.isLoading.set(false);
        },
      });
  }

  viewMember(id: string) {
    this.router.navigate(['/admin/members', id]);
  }
}
