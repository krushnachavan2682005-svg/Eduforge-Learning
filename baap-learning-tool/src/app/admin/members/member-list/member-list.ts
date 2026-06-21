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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <div class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <app-header
          [showBackBtnAndTitleSubtitle]="true"
          titleName="Members"
          subTitle="Manage teachers and students in your organization"
        >
          <button
            header-actions
            class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554]"
            routerLink="/admin/members/create"
          >
            Create Member
          </button>
        </app-header>
      </div>

      <section class="mt-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_180px]">
          <input
            class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            placeholder="Search members"
            [(ngModel)]="search"
            (ngModelChange)="loadMembers(1)"
          />
          <select
            class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
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
            class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            [(ngModel)]="active"
            (ngModelChange)="loadMembers(1)"
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </section>

      @if (isLoading()) {
        <div class="mt-5 rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading members...</div>
      } @else if (!members().length) {
        <div class="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p class="text-lg font-extrabold text-slate-900">No members found</p>
          <p class="mt-2 text-sm text-slate-500">Try changing filters or create a new teacher or student.</p>
        </div>
      } @else {
        <div class="mt-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[860px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-4">Name</th>
                  <th class="px-5 py-4">Email</th>
                  <th class="px-5 py-4">Roles</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4">Created</th>
                  <th class="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (member of members(); track member.id) {
                  <tr class="transition hover:bg-slate-50/80">
                    <td class="px-5 py-4 font-bold text-slate-900">
                      {{ member.user?.first_name }} {{ member.user?.last_name }}
                    </td>
                    <td class="px-5 py-4 text-slate-600">{{ member.user?.email }}</td>
                    <td class="px-5 py-4">
                      @for (role of member.roles; track role.id) {
                        <span class="mb-1 mr-1 inline-flex rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                          {{ role.name }}
                        </span>
                      }
                    </td>
                    <td class="px-5 py-4">
                      <span
                        class="inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold capitalize"
                        [ngClass]="member.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
                      >
                        {{ member.status }}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-slate-600">{{ member.created_at | date: 'mediumDate' }}</td>
                    <td class="px-5 py-4 text-right">
                      <button
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
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
        </div>

        <div class="mt-4 flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Page {{ pagination()?.page || 1 }} of {{ pagination()?.totalPages || 1 }}</span>
          <div class="flex gap-2">
            <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold disabled:opacity-50" [disabled]="page <= 1" (click)="loadMembers(page - 1)">
              Previous
            </button>
            <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold disabled:opacity-50" [disabled]="page >= (pagination()?.totalPages || 1)" (click)="loadMembers(page + 1)">
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
