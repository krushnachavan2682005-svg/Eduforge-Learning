import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommonHttpService } from '../../../services/common-http.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-enrollment-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeader],
  template: `
    <div class="p-4">
      <app-page-header title="Create Enrollment" subtitle="Assign a course to a student"></app-page-header>

      <form class="max-w-2xl theme-bg-secondary theme-border rounded p-4" [formGroup]="form" (ngSubmit)="submit()">
        <label class="flex flex-col gap-1 mb-4">
          Student
          <select class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="student_id">
            <option value="">Select student</option>
            @for (student of students(); track student.id) {
              <option [value]="student.id">{{ student.first_name }} {{ student.last_name }} - {{ student.email }}</option>
            }
          </select>
        </label>

        <label class="flex flex-col gap-1 mb-4">
          Course
          <select class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="course_id">
            <option value="">Select course</option>
            @for (course of courses(); track course.id) {
              <option [value]="course.id">{{ course.title || course.name }}</option>
            }
          </select>
        </label>

        <label class="flex flex-col gap-1">
          Status
          <select class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="status">
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="px-4 py-2 rounded theme-bg-gray theme-border" (click)="cancel()">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold" [disabled]="form.invalid || isSaving()">
            {{ isSaving() ? 'Creating...' : 'Create Enrollment' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class EnrollmentCreate {
  students = signal<any[]>([]);
  courses = signal<any[]>([]);
  isSaving = signal(false);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  form = this.fb.group({
    student_id: ['', Validators.required],
    course_id: ['', Validators.required],
    status: ['assigned'],
  });

  ngOnInit() {
    forkJoin({
      students: this.commonHttp.getStudents().pipe(catchError(() => of({ data: [] }))),
      courses: this.commonHttp.getCoursesForEnrollment().pipe(catchError(() => of({ items: [] }))),
    }).subscribe(({ students, courses }: any) => {
      this.students.set(students?.data || []);
      this.courses.set(courses?.items || courses?.data || []);
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.commonHttp.createEnrollment(this.form.getRawValue()).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.toastr.success('Enrollment created successfully');
        this.router.navigate(['/admin/enrollments', res?.data?.id || '']);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.message || 'Failed to create enrollment');
      },
    });
  }

  cancel() {
    this.router.navigate(['/admin/enrollments']);
  }
}
