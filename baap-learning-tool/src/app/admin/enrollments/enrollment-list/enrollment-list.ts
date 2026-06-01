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
    <div class="p-4">
      <app-page-header title="Enrollments" subtitle="Track student course enrollments">
        <a class="px-3 py-2 rounded theme-bg-secondary theme-border font-semibold" routerLink="/admin/enrollments/create">
          Create Enrollment
        </a>
      </app-page-header>

      <section class="theme-bg-secondary theme-border rounded p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            class="px-3 py-2 rounded theme-bg-gray theme-border md:col-span-2"
            placeholder="Search student"
            [(ngModel)]="search"
            (keyup.enter)="loadEnrollments()"
          />
          <select class="px-3 py-2 rounded theme-bg-gray theme-border" [(ngModel)]="status">
            <option value="">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold" (click)="loadEnrollments()">
            Apply
          </button>
        </div>
      </section>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary theme-border rounded">Loading enrollments...</div>
      } @else if (!enrollments().length) {
        <app-empty-state title="No enrollments found" message="Create an enrollment to assign a course to a student."></app-empty-state>
      } @else {
        <div class="overflow-x-auto theme-border rounded">
          <table class="w-full text-left">
            <thead class="theme-bg-secondary">
              <tr>
                <th class="p-3">Student</th>
                <th class="p-3">Course</th>
                <th class="p-3">Status</th>
                <th class="p-3">Enrolled</th>
                <th class="p-3">Completed</th>
                <th class="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (item of enrollments(); track item.id) {
                <tr class="border-t theme-border">
                  <td class="p-3">{{ studentName(item) }}</td>
                  <td class="p-3">{{ item.course?.title || item.course_id }}</td>
                  <td class="p-3">{{ item.status }}</td>
                  <td class="p-3">{{ item.enrolled_at | date: 'mediumDate' }}</td>
                  <td class="p-3">{{ item.completed_at ? (item.completed_at | date: 'mediumDate') : '--' }}</td>
                  <td class="p-3 text-right">
                    <button class="px-3 py-1 rounded theme-bg-secondary theme-border" (click)="view(item.id)">
                      View
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-3 text-sm opacity-70">
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
