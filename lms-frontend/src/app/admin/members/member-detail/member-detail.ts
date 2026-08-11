import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../../services/common-http.service';
import { HeaderComponent } from '../../../shared/header.component';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HeaderComponent],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <div class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <app-header
          [showBackBtnAndTitleSubtitle]="true"
          titleName="Member Details"
          subTitle="Profile, roles, organization, and status"
        ></app-header>
      </div>

      @if (isLoading()) {
        <div class="mt-5 rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading member...</div>
      } @else if (member()) {
        <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2 md:p-6">
            <div class="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-lg font-extrabold text-teal-700">
                  {{ member()?.user?.first_name?.[0] }}{{ member()?.user?.last_name?.[0] }}
                </div>
                <h2 class="text-2xl font-extrabold text-slate-900">
                  {{ member()?.user?.first_name }} {{ member()?.user?.last_name }}
                </h2>
                <p class="mt-1 text-sm text-slate-500">{{ member()?.user?.email }}</p>
              </div>
              <span class="inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold capitalize" [ngClass]="member()?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'">
                {{ member()?.status }}
              </span>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Organization</p>
                <p class="mt-1 font-bold text-slate-900">{{ member()?.organization?.name || '--' }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Created</p>
                <p class="mt-1 font-bold text-slate-900">{{ member()?.created_at | date: 'medium' }}</p>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap gap-2">
              <button
                class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-50"
                (click)="setActive(true)"
                [disabled]="member()?.status === 'active'"
              >
                Activate
              </button>
              <button
                class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                (click)="deactivate()"
                [disabled]="member()?.status === 'inactive'"
              >
                Deactivate
              </button>
              <button
                class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#0f3554]"
                (click)="togglePasswordPanel()"
              >
                Reset Password
              </button>
            </div>

            @if (showPasswordPanel()) {
              <form
                class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                [formGroup]="passwordForm"
                (ngSubmit)="resetPassword()"
              >
                <h3 class="mb-3 text-lg font-extrabold text-slate-900">Reset Password</h3>
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label class="grid gap-2 text-sm font-bold text-slate-700">
                    New Password
                    <input
                      class="h-11 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      type="password"
                      formControlName="password"
                    />
                    @if (passwordForm.get('password')?.touched && passwordForm.get('password')?.invalid) {
                      <span class="text-xs font-semibold text-rose-600">Use at least 8 characters with one letter and one number.</span>
                    }
                  </label>
                  <label class="grid gap-2 text-sm font-bold text-slate-700">
                    Confirm Password
                    <input
                      class="h-11 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      type="password"
                      formControlName="confirm_password"
                    />
                    @if (passwordForm.touched && passwordForm.errors?.['passwordMismatch']) {
                      <span class="text-xs font-semibold text-rose-600">Passwords do not match.</span>
                    }
                  </label>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                  <button type="button" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold" (click)="togglePasswordPanel()">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                    [disabled]="passwordForm.invalid || isResettingPassword()"
                  >
                    {{ isResettingPassword() ? 'Updating...' : 'Update Password' }}
                  </button>
                </div>
              </form>
            }
          </section>

          <section class="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 class="mb-4 text-lg font-extrabold text-slate-900">Roles</h3>
            <div class="space-y-2">
              @for (role of member()?.roles || []; track role.id) {
                <div class="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <span class="font-bold text-slate-800">{{ role.name }}</span>
                  <button class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700" (click)="removeRole(role.id)">
                    Remove
                  </button>
                </div>
              }
            </div>

            <div class="mt-5 rounded-2xl bg-slate-50 p-3">
              <select class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" [(ngModel)]="selectedRole">
                <option value="">Select role</option>
                @for (role of roles(); track role.id) {
                  <option [value]="role.code">{{ role.name }}</option>
                }
              </select>
              <button class="mt-3 w-full rounded-2xl bg-[#116466] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-60" (click)="assignRole()" [disabled]="!selectedRole">
                Assign Role
              </button>
            </div>
          </section>
        </div>
      }
    </div>
  `,
})
export class MemberDetail {
  selectedRole = '';
  member = signal<any | null>(null);
  roles = signal<any[]>([]);
  isLoading = signal(false);
  showPasswordPanel = signal(false);
  isResettingPassword = signal(false);

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  passwordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
    confirm_password: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });

  ngOnInit() {
    this.loadRoles();
    this.loadMember();
  }

  loadMember() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.isLoading.set(true);
    this.commonHttp.getMember(id).subscribe({
      next: (res: any) => {
        this.member.set(res?.data || null);
        this.isLoading.set(false);
      },
      error: () => {
        this.member.set(null);
        this.isLoading.set(false);
      },
    });
  }

  loadRoles() {
    this.commonHttp.getRoles().subscribe({
      next: (res: any) => this.roles.set(res?.data || []),
      error: () => this.roles.set([]),
    });
  }

  assignRole() {
    const id = this.member()?.id;
    if (!id || !this.selectedRole) return;
    this.commonHttp.assignMemberRole(id, this.selectedRole).subscribe({
      next: () => {
        this.toastr.success('Role assigned successfully');
        this.selectedRole = '';
        this.loadMember();
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to assign role'),
    });
  }

  removeRole(roleId: string) {
    const id = this.member()?.id;
    if (!id || !roleId) return;
    this.commonHttp.removeMemberRole(id, roleId).subscribe({
      next: () => {
        this.toastr.success('Role removed successfully');
        this.loadMember();
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to remove role'),
    });
  }

  setActive(isActive: boolean) {
    const id = this.member()?.id;
    if (!id) return;
    this.commonHttp.updateMember(id, { is_active: isActive }).subscribe({
      next: () => {
        this.toastr.success('Member activated successfully');
        this.loadMember();
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to update member'),
    });
  }

  deactivate() {
    const id = this.member()?.id;
    if (!id) return;
    this.commonHttp.deactivateMember(id).subscribe({
      next: () => {
        this.toastr.success('Member deactivated successfully');
        this.loadMember();
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to deactivate member'),
    });
  }

  togglePasswordPanel() {
    this.showPasswordPanel.update((value) => !value);
    this.passwordForm.reset();
  }

  resetPassword() {
    const id = this.member()?.id;
    if (!id) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isResettingPassword.set(true);
    this.commonHttp.resetMemberPassword(id, this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.isResettingPassword.set(false);
        this.showPasswordPanel.set(false);
        this.passwordForm.reset();
        this.toastr.success('Password updated successfully');
      },
      error: (err) => {
        this.isResettingPassword.set(false);
        this.toastr.error(err?.error?.message || 'Failed to update password');
      },
    });
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
