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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <div class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <app-header
          [showBackBtnAndTitleSubtitle]="true"
          titleName="Create Member"
          subTitle="Create a teacher or student in the current organization"
        ></app-header>
      </div>

      <form class="mt-5 max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6" [formGroup]="form" (ngSubmit)="submit()">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            First Name
            <input class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="first_name" />
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            Last Name
            <input class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="last_name" />
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            Email
            <input class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="email" />
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            Phone
            <input class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="phone" />
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            Role
            <select class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" formControlName="role">
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700">
            Password
            <input
              class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              type="password"
              formControlName="password"
            />
            @if (form.get('password')?.touched && form.get('password')?.invalid) {
              <span class="text-xs font-semibold text-rose-600">Use at least 8 characters with one letter and one number.</span>
            }
          </label>
          <label class="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
            Confirm Password
            <input
              class="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              type="password"
              formControlName="confirm_password"
            />
            @if (form.touched && form.errors?.['passwordMismatch']) {
              <span class="text-xs font-semibold text-rose-600">Passwords do not match.</span>
            }
          </label>
        </div>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-700 transition hover:bg-slate-50" (click)="cancel()">
            Cancel
          </button>
          <button type="submit" class="rounded-2xl bg-[#116466] px-5 py-2.5 font-extrabold text-white shadow-sm transition hover:bg-[#0f3554] disabled:cursor-not-allowed disabled:opacity-60" [disabled]="form.invalid || isSaving()">
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
