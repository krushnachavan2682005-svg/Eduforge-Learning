import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-class-students',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader, EmptyState],
  template: `
    <div class="p-4">
      <app-page-header
        [title]="'Manage Students'"
        [subtitle]="classItem()?.name ? 'Class: ' + classItem()?.name : 'Add students to this class'"
      ></app-page-header>

      <section class="theme-bg-secondary theme-border rounded p-4 mb-4">
        <div class="flex flex-col md:flex-row gap-3 md:items-end">
          <label class="flex flex-col gap-1 flex-1">
            Available Students
            <select class="px-3 py-2 rounded theme-bg-gray theme-border" [(ngModel)]="selectedStudentId">
              <option value="">Select student</option>
              @for (student of availableStudents(); track student.id) {
                <option [value]="student.id">
                  {{ student.first_name }} {{ student.last_name }} - {{ student.email }}
                </option>
              }
            </select>
          </label>
          <button class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold" [disabled]="!selectedStudentId || isSaving()" (click)="addStudent()">
            {{ isSaving() ? 'Adding...' : 'Add Student' }}
          </button>
        </div>
      </section>

      <section class="theme-bg-secondary theme-border rounded p-4">
        <h2 class="font-semibold mb-2">Current Students</h2>
        @if (isLoadingAssigned()) {
          <div class="p-4">Loading assigned students...</div>
        } @else if (!assignedStudents().length) {
          <app-empty-state title="No students assigned" message="Add a student to this class to begin."></app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr>
                  <th class="p-3">Name</th>
                  <th class="p-3">Email</th>
                  <th class="p-3">Phone</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (student of assignedStudents(); track student.id) {
                  <tr class="border-t theme-border">
                    <td class="p-3">{{ student.first_name }} {{ student.last_name }}</td>
                    <td class="p-3">{{ student.email }}</td>
                    <td class="p-3">{{ student.phone || '--' }}</td>
                    <td class="p-3">{{ student.status }}</td>
                    <td class="p-3 text-right">
                      <button
                        class="px-3 py-1 rounded theme-bg-gray theme-border"
                        [disabled]="removingStudentId() === student.id"
                        (click)="removeStudent(student.id)"
                      >
                        {{ removingStudentId() === student.id ? 'Removing...' : 'Remove' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class ClassStudents {
  selectedStudentId = '';
  classItem = signal<any | null>(null);
  students = signal<any[]>([]);
  assignedStudents = signal<any[]>([]);
  isLoadingAssigned = signal(false);
  isSaving = signal(false);
  removingStudentId = signal('');
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.loadClass();
    this.loadStudents();
    this.loadAssignedStudents();
  }

  loadClass() {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId) return;
    this.commonHttp.getClassById(classId).subscribe({
      next: (res: any) => this.classItem.set(res?.data || null),
      error: () => this.classItem.set(null),
    });
  }

  loadStudents() {
    this.commonHttp.getStudents().subscribe({
      next: (res: any) => this.students.set(res?.data || []),
      error: () => this.students.set([]),
    });
  }

  loadAssignedStudents() {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId) return;
    this.isLoadingAssigned.set(true);
    this.commonHttp.getClassStudents(classId).subscribe({
      next: (res: any) => {
        this.assignedStudents.set(res?.data || []);
        this.isLoadingAssigned.set(false);
      },
      error: () => {
        this.assignedStudents.set([]);
        this.isLoadingAssigned.set(false);
      },
    });
  }

  availableStudents() {
    const assignedIds = new Set(this.assignedStudents().map((student) => student.id));
    return this.students().filter((student) => !assignedIds.has(student.id));
  }

  addStudent() {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId || !this.selectedStudentId) return;
    this.isSaving.set(true);
    this.commonHttp.addStudentToClass(classId, this.selectedStudentId).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.selectedStudentId = '';
        this.loadAssignedStudents();
        this.loadClass();
        this.toastr.success('Student added to class');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.message || 'Failed to add student');
      },
    });
  }

  removeStudent(studentId: string) {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId || !studentId) return;
    this.removingStudentId.set(studentId);
    this.commonHttp.removeStudentFromClass(classId, studentId).subscribe({
      next: () => {
        this.removingStudentId.set('');
        this.loadAssignedStudents();
        this.loadClass();
        this.toastr.success('Student removed from class');
      },
      error: (err) => {
        this.removingStudentId.set('');
        this.toastr.error(err?.error?.message || 'Failed to remove student');
      },
    });
  }
}
