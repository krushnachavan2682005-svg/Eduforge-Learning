import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-enrollment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeader, EmptyState],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Enrollments" subtitle="Track student course enrollments">
        <a class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554]" routerLink="/admin/enrollments/create">
          Create Enrollment
        </a>
      </app-page-header>

      <section class="mb-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 md:col-span-2"
            placeholder="Search student"
            [(ngModel)]="search"
            (keyup.enter)="loadEnrollments()"
          />
          <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" [(ngModel)]="status">
            <option value="">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button class="h-11 rounded-2xl bg-slate-900 px-4 text-sm font-extrabold text-white transition hover:bg-[#116466]" (click)="loadEnrollments()">
            Apply
          </button>
        </div>
      </section>

      @if (isLoading()) {
        <div class="rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading enrollments...</div>
      } @else if (!enrollments().length) {
        <app-empty-state title="No enrollments found" message="Create an enrollment to assign a course to a student."></app-empty-state>
      } @else {
        <div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-4">Student</th>
                  <th class="px-5 py-4">Course</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4">Enrolled</th>
                  <th class="px-5 py-4">Completed</th>
                  <th class="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (item of enrollments(); track item.id) {
                  <tr class="transition hover:bg-slate-50/80">
                    <td class="px-5 py-4 font-bold text-slate-900">{{ studentName(item) }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ item.course?.title || item.course_id }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-extrabold capitalize text-teal-700">{{ item.status }}</span></td>
                    <td class="px-5 py-4 text-slate-600">{{ item.enrolled_at | date: 'mediumDate' }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ item.completed_at ? (item.completed_at | date: 'mediumDate') : '--' }}</td>
                    <td class="px-5 py-4 text-right">
                      <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:text-teal-700" (click)="view(item.id)">
                        View
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="mt-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
          Showing {{ enrollments().length }} of {{ meta()?.total || 0 }} enrollments
        </div>
      }
    </div>
  `,
})
export class EnrollmentList {
  enrollments = signal<any[]>([]);
  meta = signal<any | null>(null);
  isLoading = signal(false);
  search = '';
  status = '';
  private router = inject(Router);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.loadEnrollments();
  }

  loadEnrollments() {
    this.isLoading.set(true);
    this.commonHttp
      .getEnrollments({
        page: 1,
        limit: 50,
        search: this.search,
        status: this.status,
      })
      .subscribe({
        next: (res: any) => {
          this.enrollments.set(res?.data || []);
          this.meta.set(res?.meta || null);
          this.isLoading.set(false);
        },
        error: () => {
          this.enrollments.set([]);
          this.meta.set(null);
          this.isLoading.set(false);
        },
      });
  }

  studentName(item: any) {
    const student = item?.student;
    const fullName = [student?.first_name, student?.last_name]
      .filter(Boolean)
      .join(' ');
    return fullName || student?.email || item?.student_id;
  }

  view(id: string) {
    this.router.navigate(['/admin/enrollments', id]);
  }
}
