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
    <div class="p-4">
      <app-page-header title="Students" subtitle="Local student profiles in this organization">
        <a class="px-3 py-2 rounded theme-bg-secondary theme-border font-semibold" routerLink="/admin/members/create">
          Create Student Member
        </a>
      </app-page-header>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary theme-border rounded">Loading students...</div>
      } @else if (!students().length) {
        <app-empty-state title="No students found" message="Create a student member to create the matching student profile."></app-empty-state>
      } @else {
        <div class="overflow-x-auto theme-border rounded">
          <table class="w-full text-left">
            <thead class="theme-bg-secondary">
              <tr>
                <th class="p-3">Name</th>
                <th class="p-3">Email</th>
                <th class="p-3">Phone</th>
                <th class="p-3">Status</th>
                <th class="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              @for (student of students(); track student.id) {
                <tr class="border-t theme-border">
                  <td class="p-3 font-medium">{{ student.first_name }} {{ student.last_name }}</td>
                  <td class="p-3">{{ student.email }}</td>
                  <td class="p-3">{{ student.phone || '--' }}</td>
                  <td class="p-3">{{ student.status }}</td>
                  <td class="p-3">{{ student.created_at | date: 'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
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
