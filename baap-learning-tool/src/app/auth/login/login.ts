import { CommonHttpService } from './../../services/common-http.service';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, NavigationStart, ActivatedRoute } from '@angular/router';
import { Auth } from '../auth';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { EMPTY, catchError, concatMap, map, tap } from 'rxjs';
import { PermissionStore } from '../../services/permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  clients: any;
  loginError = '';
  isLoading = false;
  showPassword = false;
  showNextField = false;
  showError: boolean = false;
  inputType: 'none' | 'email' | 'phone' = 'none';
  private router = inject(Router);
  private isBackNavigation = false;
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private http = inject(CommonHttpService);
  private permissionStore = inject(PermissionStore);

  constructor(private cd: ChangeDetectorRef) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isBackNavigation =
          (event as any)?.navigationTrigger === 'popstate';
      }
    });
  }

  removeReadonly(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target && target.hasAttribute('readonly')) {
      target.removeAttribute('readonly');
    }
  }

  ngOnInit(): void {
    let isUser = this.str?.getItem(STORAGEENUMS?.USER_ID);
    const noRedirect =
      this.route?.snapshot?.queryParamMap?.get('noRedirect') === '1';
    if (isUser && !this.isBackNavigation && !noRedirect) {
      this.router?.navigate(['/dashboard']);
    } else {
      this.createForm();
      setTimeout(() => this.cd.detectChanges());
    }
  }

  createForm(): void {
    this.loginForm = this.fb.group({
      email: [null, [Validators.required, this.emailOrPhoneValidator]],
      password: [null, [Validators.required, Validators?.minLength(6)]],
      rememberMe: [false],
    });
  }
  onEmailPaste(): void {
    this.loginForm.get('password')?.reset();
    this.showNextField = false;
  }

  emailOrPhoneValidator(control: AbstractControl): ValidationErrors | null {
    const value: string = control.value;
    if (!value) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}(\+\d{1,2})?$/;

    if (emailRegex?.test(value)) {
      return null;
    }

    if (phoneRegex?.test(value)) {
      return null;
    }
    if (/[a-zA-Z]/.test(value) || value?.includes('@')) {
      return { invalidEmail: true };
    }

    if (/^\d+$/.test(value)) {
      return { invalidPhone: true };
    }
    return { invalidEmail: true };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  loginWithApi(): void {
    this.isLoading = true;
    const formData = this.loginForm.getRawValue();
    if (this.inputType === 'phone') {
      const payload = {
        phone: formData.email,
        otp: formData.password,
      };

      this.authService
        .verifyOtp(payload)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: (response) => {
            this.str.setItem(STORAGEENUMS.IS_AUTHENTICATED, 'true');
            this.str.setItem(STORAGEENUMS.USER_PHONE, payload?.phone);
            this.str.setItem(STORAGEENUMS.USER_ID, response?.user?.id);
            if (response?.access_token) {
              this.str.setItem(STORAGEENUMS.AUTH_TOKEN, response?.access_token);
            }
            this.fetchClients();
            this.toastr.success('Logged in successfully', 'Success', {
              // closeButton: false,
              timeOut: 3000,
              progressBar: true,
            });
          },
          error: () => {
            this.isLoading = false;
            this.toastr.error('Invalid phone number or OTP', 'Login Failed', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
          },
        });
    } else {
      const payload = {
        email: formData.email,
        password: formData.password,
      };

      this.authService
        .login(payload)
        .pipe(finalize(() => (this.isLoading = false)))
        .subscribe({
          next: (response) => {
            this.str.setItem(STORAGEENUMS.IS_AUTHENTICATED, 'true');
            this.str.setItem(STORAGEENUMS.USER_ID, response?.user?.id);
            if (response?.access_token) {
              this.str.setItem(STORAGEENUMS.AUTH_TOKEN, response?.access_token);
            }
            this.fetchClients();
            this.toastr.success('Logged in successfully', '', {
              // closeButton: false,
              timeOut: 2000,
              progressBar: true,
            });
          },
          error: () => {
            this.isLoading = false;
            this.toastr.error('Invalid email or password', '', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
          },
        });
    }
  }

  private fetchClients(): void {
    this.http.getClient().subscribe({
      next: (response) => {
        this.clients = response?.clients;

        const canSwitch =
          Array.isArray(this.clients) && this.clients.length > 1;
        this.str.setItem(STORAGEENUMS.CAN_SWITCH_ORG, canSwitch);

        if (this.clients?.length === 1) {
          this.str?.setItem(
            STORAGEENUMS?.CLIENT,
            JSON?.stringify(this.clients?.[0]),
          );
          this.str.setItem(STORAGEENUMS?.CLIENT_ID, this.clients?.[0]?.id);
          const clientId = this.clients?.[0]?.id;
          const userId = this.str?.getItem(STORAGEENUMS.USER_ID);
          this.fetchAndStorePermissionsSafely(clientId, userId);
          this.router?.navigate(['/dashboard'])?.then(() => {});
        } else if (canSwitch) {
          this.router.navigate([], {
            queryParams: { noRedirect: '1' },
            replaceUrl: true,
            relativeTo: this.route,
          });
          this.router.navigate(['/organizations'], {
            state: { fromLogin: true },
          });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {},
    });
  }

  private fetchAndStorePermissionsSafely(
    clientId?: string,
    userId?: string | null,
  ) {
    if (!clientId || !userId) {
      return;
    }

    this.http
      .getUser(`/auth/api/users/client/${clientId}/user/${userId}`)
      .pipe(
        map((userRes: any) => {
          const user = userRes?.user;
          let roleId: string | undefined;

          if (
            Array.isArray(user?.user_mappings) &&
            user.user_mappings.length > 0
          ) {
            roleId =
              user.user_mappings[0]?.role_id || user.user_mappings[0]?.role?.id;
          }
          return roleId;
        }),
        concatMap((roleId: string | undefined) => {
          if (!roleId) {
            return EMPTY;
          }
          return this.http.getPermissions(
            `/auth/api/permissions/client/${clientId}/role/${roleId}`,
          );
        }),
        tap((permRes: any) => {
          const raw = permRes?.permissions ?? permRes?.data ?? permRes ?? [];
          const list = Array?.isArray(raw)
            ? raw
            : Array?.isArray(raw?.permissions)
              ? raw?.permissions
              : [];

          const normalized: string[] = (list as any[]).flatMap((item: any) => {
            const moduleName: string = item?.module?.name || '';
            const code: string = item?.permission?.code || '';
            const permName: string = item?.permission?.name || '';
            const actions: string[] = Array?.isArray(item?.actions)
              ? item.actions
              : [];

            const pairs = actions?.map((a) => `${moduleName}:${a}`);
            const extras = [code, permName].filter(Boolean);

            return [...pairs, ...extras];
          });

          const unique = Array.from(new Set(normalized)).filter(Boolean);

          this.str?.setItem(STORAGEENUMS.PERMISSIONS, JSON.stringify(unique));
          this.permissionStore?.setPermissions(unique);
        }),
        catchError(() => EMPTY),
      )
      .subscribe();
  }

  onInputAndHandleChange(event: Event): void {
    const inputElement = event?.target as HTMLInputElement;
    let value = inputElement?.value;

    if (value) {
      value = value?.toLowerCase()?.replace(/\s/g, '');
      this.loginForm?.get('email')?.setValue(value, { emitEvent: false });
      inputElement.value = value;
    }

    const emailControl = this.loginForm.get('email');
    const passwordControl = this.loginForm.get('password');
    const emailRegex = /^[^\s@]+@[^\s@]+\.(com|in)$/;
    const phoneRegex = /^\+?\d{10,15}$/;
    const trimmedValue = value || '';
    if (!trimmedValue) {
      this.inputType = 'none';
      this.showNextField = false;
      passwordControl?.reset();
      return;
    }

    if (/[a-zA-Z]/.test(trimmedValue)) {
      this.inputType = 'email';
    } else if (/^\+?\d*$/.test(trimmedValue)) {
      this.inputType = 'phone';
    } else {
      this.inputType = 'none';
    }

    const isValidEmail = emailRegex?.test(trimmedValue);
    const isValidPhone = phoneRegex?.test(trimmedValue);

    this.showNextField = isValidEmail || isValidPhone;
    passwordControl?.reset();

    if (
      this.inputType === 'email' &&
      trimmedValue?.includes('@') &&
      !isValidEmail
    ) {
      emailControl?.setErrors({ invalidEmail: true });
    } else if (emailControl?.errors) {
      const currentErrors = emailControl?.errors;
      const requiredError = currentErrors['required'];

      if (!requiredError && (isValidEmail || isValidPhone)) {
        emailControl?.setErrors(null);
      }
    }
  }
  onForwardClick(): void {
    this.showError = true;
    if (this.loginForm.get('email')?.valid) {
      if (this.inputType === 'email' || this.inputType === 'phone') {
        this.showNextField = true;
      }
    }
    const value = this.loginForm.get('email')?.value;
    if (!value) return;
    if (this.inputType === 'email') {
      this.authService.checkPassword({ username: value }).subscribe({
        error: (err) => console.error(err),
      });
    } else if (this.inputType === 'phone') {
      const rawPhone = value;
      const phoneOnly = rawPhone.split('+')[0];

      this.authService.requestOtp({ phone: phoneOnly }).subscribe({
        next: () => {
          this.str.setItem(STORAGEENUMS.USER_PHONE, rawPhone);
        },
        error: (err) => console.error(err),
      });
    }
  }
  onPasswordInput(): void {
    this.loginForm.get('password')?.markAsTouched();
  }
}
