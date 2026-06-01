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
    <div class="p-4">
      <app-page-header title="Create Class" subtitle="Add a class in the current organization"></app-page-header>

      <form class="max-w-2xl theme-bg-secondary theme-border rounded p-4" [formGroup]="form" (ngSubmit)="submit()">
        <label class="flex flex-col gap-1 mb-4">
          Class Name
          <input class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="name" />
        </label>
        <label class="flex flex-col gap-1">
          Description
          <textarea class="px-3 py-2 rounded theme-bg-gray theme-border min-h-28" formControlName="description"></textarea>
        </label>
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="px-4 py-2 rounded theme-bg-gray theme-border" (click)="cancel()">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold" [disabled]="form.invalid || isSaving()">
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
