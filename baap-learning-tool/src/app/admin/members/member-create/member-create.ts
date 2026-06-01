import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../../services/common-http.service';
import { HeaderComponent } from '../../../shared/header.component';

@Component({
  selector: 'app-member-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent],
  template: `
    <div class="p-4">
      <app-header
        [showBackBtnAndTitleSubtitle]="true"
        titleName="Create Member"
        subTitle="Create a teacher or student in the current organization"
      ></app-header>

      <form class="max-w-2xl theme-bg-secondary theme-border rounded p-4" [formGroup]="form" (ngSubmit)="submit()">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1">
            First Name
            <input class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="first_name" />
          </label>
          <label class="flex flex-col gap-1">
            Last Name
            <input class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="last_name" />
          </label>
          <label class="flex flex-col gap-1">
            Email
            <input class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="email" />
          </label>
          <label class="flex flex-col gap-1">
            Phone
            <input class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="phone" />
          </label>
          <label class="flex flex-col gap-1">
            Role
            <select class="px-3 py-2 rounded theme-bg-gray theme-border" formControlName="role">
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            Password
            <input
              class="px-3 py-2 rounded theme-bg-gray theme-border"
              type="password"
              formControlName="password"
            />
            @if (form.get('password')?.touched && form.get('password')?.invalid) {
              <span class="text-sm text-red-500">Use at least 8 characters with one letter and one number.</span>
            }
          </label>
          <label class="flex flex-col gap-1">
            Confirm Password
            <input
              class="px-3 py-2 rounded theme-bg-gray theme-border"
              type="password"
              formControlName="confirm_password"
            />
            @if (form.touched && form.errors?.['passwordMismatch']) {
              <span class="text-sm text-red-500">Passwords do not match.</span>
            }
          </label>
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button type="button" class="px-4 py-2 rounded theme-bg-gray theme-border" (click)="cancel()">
            Cancel
          </button>
          <button type="submit" class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold" [disabled]="form.invalid || isSaving()">
            {{ isSaving() ? 'Creating...' : 'Create Member' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class MemberCreate {
  isSaving = signal(false);

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  form = this.fb.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['teacher', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
    confirm_password: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    const { confirm_password, ...payload } = this.form.getRawValue();
    this.commonHttp.createMember(payload).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.toastr.success('Member created successfully');
        const id = res?.data?.id || res?.data?.user?.id;
        if (id) this.router.navigate(['/admin/members', id]);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.message || 'Failed to create member');
      },
    });
  }

  cancel() {
    this.router.navigate(['/admin/members']);
  }

  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '');
    if (!value) return null;
    return /[A-Za-z]/.test(value) && /[0-9]/.test(value)
      ? null
      : { weakPassword: true };
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirm_password')?.value;
    if (!password || !confirmPassword) return null;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
