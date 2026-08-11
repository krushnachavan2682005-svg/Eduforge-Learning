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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Create Enrollment" subtitle="Assign a course to a student"></app-page-header>

      <form class="max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6" [formGroup]="form" (ngSubmit)="submit()">
        <label class="mb-4 grid gap-2 text-sm font-bold text-slate-700">
          Student
          <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="student_id">
            <option value="">Select student</option>
            @for (student of students(); track student.id) {
              <option [value]="student.id">{{ student.first_name }} {{ student.last_name }} - {{ student.email }}</option>
            }
          </select>
        </label>

        <label class="mb-4 grid gap-2 text-sm font-bold text-slate-700">
          Course
          <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="course_id">
            <option value="">Select course</option>
            @for (course of courses(); track course.id) {
              <option [value]="course.id">{{ course.title || course.name }}</option>
            }
          </select>
        </label>

        <label class="grid gap-2 text-sm font-bold text-slate-700">
          Status
          <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="status">
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-50" (click)="cancel()">Cancel</button>
          <button type="submit" class="rounded-2xl bg-[#116466] px-5 py-2.5 font-extrabold text-white hover:bg-[#0f3554] disabled:opacity-60" [disabled]="form.invalid || isSaving()">
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
