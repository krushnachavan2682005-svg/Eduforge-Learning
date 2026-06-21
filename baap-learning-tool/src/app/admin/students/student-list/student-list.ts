import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeader, EmptyState],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Students" subtitle="Local student profiles in this organization">
        <a class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554]" routerLink="/admin/members/create">
          Create Student Member
        </a>
      </app-page-header>

      @if (isLoading()) {
        <div class="rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading students...</div>
      } @else if (!students().length) {
        <app-empty-state title="No students found" message="Create a student member to create the matching student profile."></app-empty-state>
      } @else {
        <div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-4">Name</th>
                  <th class="px-5 py-4">Email</th>
                  <th class="px-5 py-4">Phone</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4">Created</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (student of students(); track student.id) {
                  <tr class="transition hover:bg-slate-50/80">
                    <td class="px-5 py-4 font-bold text-slate-900">{{ student.first_name }} {{ student.last_name }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ student.email }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ student.phone || '--' }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold capitalize text-emerald-700">{{ student.status }}</span></td>
                    <td class="px-5 py-4 text-slate-600">{{ student.created_at | date: 'mediumDate' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class StudentList {
  students = signal<any[]>([]);
  isLoading = signal(false);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.isLoading.set(true);
    this.commonHttp.getStudents().subscribe({
      next: (res: any) => {
        this.students.set(res?.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.students.set([]);
        this.isLoading.set(false);
      },
    });
  }
}
