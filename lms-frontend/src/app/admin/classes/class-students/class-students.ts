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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header
        [title]="'Manage Students'"
        [subtitle]="classItem()?.name ? 'Class: ' + classItem()?.name : 'Add students to this class'"
      ></app-page-header>

      <section class="mb-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <label class="grid flex-1 gap-2 text-sm font-bold text-slate-700">
            Available Students
            <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" [(ngModel)]="selectedStudentId">
              <option value="">Select student</option>
              @for (student of availableStudents(); track student.id) {
                <option [value]="student.id">
                  {{ student.first_name }} {{ student.last_name }} - {{ student.email }}
                </option>
              }
            </select>
          </label>
          <button class="h-11 rounded-2xl bg-[#116466] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554] disabled:opacity-60" [disabled]="!selectedStudentId || isSaving()" (click)="addStudent()">
            {{ isSaving() ? 'Adding...' : 'Add Student' }}
          </button>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-extrabold text-slate-900">Current Students</h2>
            <p class="mt-1 text-sm text-slate-500">Students assigned to this class.</p>
          </div>
          <span class="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-700">{{ assignedStudents().length }} assigned</span>
        </div>
        @if (isLoadingAssigned()) {
          <div class="rounded-2xl bg-slate-50 p-4 text-slate-500">Loading assigned students...</div>
        } @else if (!assignedStudents().length) {
          <app-empty-state title="No students assigned" message="Add a student to this class to begin."></app-empty-state>
        } @else {
          <div class="overflow-x-auto rounded-2xl border border-slate-100">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-4">Name</th>
                  <th class="px-5 py-4">Email</th>
                  <th class="px-5 py-4">Phone</th>
                  <th class="px-5 py-4">Status</th>
                  <th class="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (student of assignedStudents(); track student.id) {
                  <tr class="transition hover:bg-slate-50/80">
                    <td class="px-5 py-4 font-bold text-slate-900">{{ student.first_name }} {{ student.last_name }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ student.email }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ student.phone || '--' }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">{{ student.status }}</span></td>
                    <td class="px-5 py-4 text-right">
                      <button
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-rose-200 hover:text-rose-700 disabled:opacity-60"
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
