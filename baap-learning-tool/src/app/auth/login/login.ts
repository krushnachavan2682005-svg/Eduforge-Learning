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
import { finalize, switchMap, tap } from 'rxjs';

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
    let token = this.str?.getItem(STORAGEENUMS?.AUTH_TOKEN);
    const noRedirect =
      this.route?.snapshot?.queryParamMap?.get('noRedirect') === '1';
    if (token && !this.isBackNavigation && !noRedirect) {
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
      this.isLoading = false;
      console.warn('[Auth] local LMS auth currently supports email/password login only');
      this.toastr.error('Phone OTP login is not available in local LMS auth yet', '');
    } else {
      const payload = {
        email: formData.email,
        password: formData.password,
      };

      this.authService
        .login(payload)
        .pipe(
          tap((response) => {
            this.authService.persistSession(response?.data);
            console.log('[Auth] login success', response?.data?.user);
          }),
          switchMap(() => this.authService.hydratePermissions()),
          finalize(() => (this.isLoading = false)),
        )
        .subscribe({
          next: () => {
            this.toastr.success('Logged in successfully', '', {
              // closeButton: false,
              timeOut: 2000,
              progressBar: true,
            });
            this.router?.navigate(['/dashboard'])?.then(() => {});
          },
          error: (error) => {
            this.isLoading = false;
            console.warn('[Auth] login failed', error);
            this.toastr.error('Invalid email or password', '', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
          },
        });
    }
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
      console.log('[Auth] local email login selected');
    } else if (this.inputType === 'phone') {
      console.warn('[Auth] phone OTP is not supported by local LMS auth yet');
    }
  }
  onPasswordInput(): void {
    this.loginForm.get('password')?.markAsTouched();
  }
}
