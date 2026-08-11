import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../../services/common-http.service';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-class-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeader],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Create Class" subtitle="Add a class in the current organization"></app-page-header>

      <form class="max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6" [formGroup]="form" (ngSubmit)="submit()">
        <label class="mb-4 grid gap-2 text-sm font-bold text-slate-700">
          Class Name
          <input class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="name" />
        </label>
        <label class="grid gap-2 text-sm font-bold text-slate-700">
          Description
          <textarea class="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="description"></textarea>
        </label>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-50" (click)="cancel()">Cancel</button>
          <button type="submit" class="rounded-2xl bg-[#116466] px-5 py-2.5 font-extrabold text-white hover:bg-[#0f3554] disabled:opacity-60" [disabled]="form.invalid || isSaving()">
            {{ isSaving() ? 'Creating...' : 'Create Class' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ClassCreate {
  isSaving = signal(false);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.commonHttp.createClass(this.form.getRawValue()).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.toastr.success('Class created successfully');
        this.router.navigate(['/admin/classes', res?.data?.id || '']);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.message || 'Failed to create class');
      },
    });
  }

  cancel() {
    this.router.navigate(['/admin/classes']);
  }
}
