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
    <div class="p-4">
      <app-header
        [showBackBtnAndTitleSubtitle]="true"
        titleName="Member Details"
        subTitle="Profile, roles, organization, and status"
      ></app-header>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary rounded theme-border">Loading member...</div>
      } @else if (member()) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section class="lg:col-span-2 theme-bg-secondary theme-border rounded p-4">
            <h2 class="text-xl font-semibold mb-3">
              {{ member()?.user?.first_name }} {{ member()?.user?.last_name }}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p class="text-sm opacity-70">Email</p>
                <p>{{ member()?.user?.email }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">Status</p>
                <p>{{ member()?.status }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">Organization</p>
                <p>{{ member()?.organization?.name || '--' }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">Created</p>
                <p>{{ member()?.created_at | date: 'medium' }}</p>
              </div>
            </div>

            <div class="flex gap-2 mt-5">
              <button
                class="px-3 py-2 rounded theme-bg-gray theme-border"
                (click)="setActive(true)"
                [disabled]="member()?.status === 'active'"
              >
                Activate
              </button>
              <button
                class="px-3 py-2 rounded theme-bg-gray theme-border"
                (click)="deactivate()"
                [disabled]="member()?.status === 'inactive'"
              >
                Deactivate
              </button>
              <button
                class="px-3 py-2 rounded theme-bg-gray theme-border"
                (click)="togglePasswordPanel()"
              >
                Reset Password
              </button>
            </div>

            @if (showPasswordPanel()) {
              <form
                class="mt-5 p-4 rounded theme-bg-gray theme-border"
                [formGroup]="passwordForm"
                (ngSubmit)="resetPassword()"
              >
                <h3 class="font-semibold mb-3">Reset Password</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1">
                    New Password
                    <input
                      class="px-3 py-2 rounded theme-bg-secondary theme-border"
                      type="password"
                      formControlName="password"
                    />
                    @if (passwordForm.get('password')?.touched && passwordForm.get('password')?.invalid) {
                      <span class="text-sm text-red-500">Use at least 8 characters with one letter and one number.</span>
                    }
                  </label>
                  <label class="flex flex-col gap-1">
                    Confirm Password
                    <input
                      class="px-3 py-2 rounded theme-bg-secondary theme-border"
                      type="password"
                      formControlName="confirm_password"
                    />
                    @if (passwordForm.touched && passwordForm.errors?.['passwordMismatch']) {
                      <span class="text-sm text-red-500">Passwords do not match.</span>
                    }
                  </label>
                </div>
                <div class="flex justify-end gap-2 mt-4">
                  <button type="button" class="px-3 py-2 rounded theme-bg-secondary theme-border" (click)="togglePasswordPanel()">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-3 py-2 rounded theme-bg-secondary theme-border font-semibold"
                    [disabled]="passwordForm.invalid || isResettingPassword()"
                  >
                    {{ isResettingPassword() ? 'Updating...' : 'Update Password' }}
                  </button>
                </div>
              </form>
            }
          </section>

          <section class="theme-bg-secondary theme-border rounded p-4">
            <h3 class="font-semibold mb-3">Roles</h3>
            @for (role of member()?.roles || []; track role.id) {
              <div class="flex justify-between items-center gap-2 py-2 border-b theme-border">
                <span>{{ role.name }}</span>
                <button class="px-2 py-1 rounded theme-bg-gray theme-border text-sm" (click)="removeRole(role.id)">
                  Remove
                </button>
              </div>
            }

            <div class="mt-4">
              <select class="w-full px-3 py-2 rounded theme-bg-gray theme-border" [(ngModel)]="selectedRole">
                <option value="">Select role</option>
                @for (role of roles(); track role.id) {
                  <option [value]="role.code">{{ role.name }}</option>
                }
              </select>
              <button class="w-full mt-2 px-3 py-2 rounded theme-bg-gray theme-border font-semibold" (click)="assignRole()" [disabled]="!selectedRole">
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
