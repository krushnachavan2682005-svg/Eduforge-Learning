import { Component, inject, OnInit } from '@angular/core';
import { HeaderComponent } from '../../shared/header.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { UserLocalService } from '../../services/user-local-service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { GeocodingService } from '../../services/geocoding.service';
import { Calendar } from '../../shared/calendar/calendar';
import {
  tap,
  switchMap,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs/operators';
import { Subject } from 'rxjs';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-create-resume',
  imports: [
    HeaderComponent,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    CommonModule,
    Calendar,
  ],
  templateUrl: './create-resume.html',
  styleUrl: './create-resume.scss',
})
export class CreateResume implements OnInit {
  todayYear = new Date().getFullYear();
  years: number[] = [];
  headerTitle = '';
  isGeocoding = false;
  resumeForm!: FormGroup;
  geocodeNotFound = false;
  isEditMode: boolean = false;
  isLoading: boolean = false;
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private userService = inject(UserLocalService);
  private addressSubject = new Subject<string>();
  private commonService = inject(CommonHttpService);
  private geocodingService = inject(GeocodingService);
  private workspaceNav = inject(WorkspaceNavigationService);
  skillLevels = [
    { level: 'Beginner' },
    { level: 'Intermediate' },
    { level: 'Good' },
    { level: 'Advance' },
    { level: 'Proficient' },
    { level: 'Expert' },
  ];

  todayDate = new Date().toISOString().split('T')[0];
  private parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      const year = Number(m[3]);
      const d = new Date(year, month, day);
      return isNaN(d?.getTime()) ? null : d;
    }
    const parsed = new Date(s);
    return isNaN(parsed?.getTime()) ? null : parsed;
  }
  private futureDateValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    if (!control.value) return null;

    const selectedDate = this.parseDate(control.value);
    if (!selectedDate) return null;
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    selectedDate?.setHours(0, 0, 0, 0);
    return selectedDate > today ? { futureDate: true } : null;
  }

  private projectDateValidator(
    group: AbstractControl,
  ): ValidationErrors | null {
    const s = this.parseDate(group?.get('start_date')?.value);
    const e = this.parseDate(group?.get('end_date')?.value);

    if (!s || !e) return null;
    const startCtrl = group?.get('start_date');
    if (e < s) {
      startCtrl?.setErrors({ invalidOrder: true });
      return { invalidOrder: true };
    }
    startCtrl?.setErrors(null);
    return null;
  }

  ngOnInit() {
    for (let y = this.todayYear + 10; y >= 1900; y--) {
      this.years.push(y);
    }
    this.resumeForm = this.fb?.group({
      name: ['', Validators?.required],
      label: ['', Validators?.required],
      summary: [
        '',
        [
          Validators.required,
          Validators.minLength(30),
          Validators.maxLength(500),
        ],
      ],
      email: [
        '',
        [
          Validators?.required,
          Validators?.pattern(
            '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$',
          ),
        ],
      ],
      phone: [
        '',
        [
          Validators?.required,
          Validators?.minLength(10),
          Validators?.pattern('^[0-9]*$'),
          Validators?.maxLength(10),
        ],
      ],
      url: [
        '',
        [
          Validators.pattern(
            /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})([\/\w .-]*)*\/?$/,
          ),
        ],
      ],
      location: this.fb?.group({
        address: ['', Validators.required],
        city: ['', Validators.required],
        region: ['', Validators.required],
        country: ['', Validators.required],
      }),
      work: this.fb?.array([]),
      skills: this.fb?.array([]),
      projects: this.fb?.array([]),
      education: this.fb?.array([]),
    });

    this.setupAddressAutocomplete();

    const userId = this.userService?.getUserId() ?? '';
    this.isEditMode = this.router?.url?.includes('/resume/edit');

    if (this.isEditMode && userId) {
      this.headerTitle = 'Edit Your Resume/CV';
      this.loadResume(userId);
    } else {
      this.headerTitle = 'Create Your Resume/CV';
      this.addEducation();
      this.addSkill();
      this.addExperience();
      this.addProject();
    }
  }

  private setupAddressAutocomplete() {
    this.addressSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        tap(() => {
          this.isGeocoding = true;
          this.geocodeNotFound = false;
        }),
        switchMap((address) => this.geocodingService?.geocodeAddress(address)),
        tap(() => (this.isGeocoding = false)),
      )
      .subscribe((result) => {
        if (result) {
          this.populateLocationFields(result);
        } else {
          this.geocodeNotFound = true;
        }
      });
  }

  onAddressInput(address: string) {
    if (this.isEditMode && address?.length > 3) {
      if (!address || address?.trim()?.length === 0) {
        this.geocodeNotFound = false;
      }
      this.addressSubject?.next(address);
    }
  }

  private populateLocationFields(result: any) {
    const locationGroup = this.resumeForm.get('location');
    if (locationGroup) {
      locationGroup?.get('city')?.setValue(result?.city);
      locationGroup?.get('region')?.setValue(result?.region);
      locationGroup?.get('country')?.setValue(result?.country);
    }
  }

  get education() {
    return this.resumeForm?.get('education') as FormArray;
  }

  get skills() {
    return this.resumeForm?.get('skills') as FormArray;
  }

  get work() {
    return this.resumeForm?.get('work') as FormArray;
  }

  get projects() {
    return this.resumeForm?.get('projects') as FormArray;
  }

  onSubmit() {
    if (!this.resumeForm?.valid) return;
    this.isLoading = true;
    const userId = this.userService?.getUserId();
    const resumeData = { ...this.resumeForm.value, user_id: userId };
    const isEditMode = this.router?.url?.includes('/resume/edit');

    const request$ = isEditMode
      ? this.commonService?.putCourse(
          `/resume/user/${userId}`,
          resumeData,
        )
      : this.commonService?.postCourse(
          `/resume`,
          resumeData,
        );

    request$.subscribe({
      next: () => {
        this.isLoading = false;
        this.toastr?.success(
          isEditMode
            ? 'Resume updated successfully'
            : 'Resume created successfully',
        );
        this.router?.navigate([this.workspaceNav.getResumeRoute()]);
      },
      error: () => {
        this.isLoading = false;
        this.toastr?.error(
          isEditMode ? 'Failed to update resume' : 'Failed to create resume',
        );
      },
    });
  }

  loadResume(userId: string) {
    this.commonService
      .getCourse(`/resume/user/${userId}`)
      .subscribe({
        next: (res: any) => {
          const data = res?.data;
          if (!data) return;

          this.resumeForm?.patchValue({
            name: data?.name,
            label: data?.label,
            summary: data?.summary,
            email: data?.email,
            phone: data?.phone,
            url: data?.url,
            score: data?.score,
            location: {
              address: data?.location?.address || '',
              city: data?.location?.city || '',
              region: data?.location?.region || '',
              country: data?.location?.country || '',
            },
          });

          this.clearFormArray(this.work);
          this.clearFormArray(this.skills);
          this.clearFormArray(this.projects);
          this.clearFormArray(this.education);

          (data?.education || [])?.forEach((edu: any) =>
            this.addEducation(edu),
          );

          (data?.skills || [])?.forEach((skill: any) => this.addSkill(skill));

          (data?.work || [])?.forEach((work: any) => this.addExperience(work));

          (data?.projects || [])?.forEach((proj: any) => this.addProject(proj));
        },
        error: () => this.toastr.error('Failed to load resume for edit'),
      });
  }

  private clearFormArray(formArray: FormArray) {
    while (formArray?.length !== 0) {
      formArray?.removeAt(0);
    }
  }

  addEducation(data?: any) {
    const grp = this.fb.group(
      {
        study_type: [data?.study_type || '', Validators.required],
        score: [data?.score || '', Validators.required],
        institution: [data?.institution || '', Validators.required],
        area: [data?.area || '', Validators.required],
        start_date: [
          data?.start_date || null,
          [Validators.required, this.futureDateValidator?.bind(this)],
        ],
        end_date: [
          data?.end_date || null,
          [Validators.required],
        ],
      },
      { validators: this.projectDateValidator?.bind(this) },
    );
    this.education.push(grp);
  }
  removeEducation(index: number) {
    this.education?.removeAt(index);
  }

  addSkill(data?: any) {
    this.skills?.push(
      this.fb?.group({
        name: [data?.name || '', Validators.required],
        level: [data?.level || null, Validators.required],
      }),
    );
  }
  removeSkill(index: number) {
    this.skills?.removeAt(index);
  }

  addExperience(data?: any) {
    const startDateValidators = data
      ? []
      : [this.futureDateValidator?.bind(this)];
    this.work?.push(
      this.fb?.group(
        {
          name: [data?.name || ''],
          position: [data?.position || ''],
          location: [data?.location || ''],
          start_date: [data?.start_date || '', startDateValidators],
          end_date: [data?.end_date || ''],
          summary: [data?.summary || ''],
        },
        { validators: this.projectDateValidator?.bind(this) },
      ),
    );
  }
  removeExperience(index: number) {
    this.work?.removeAt(index);
  }

  addProject(data?: any) {
    const startDateValidators = data
      ? []
      : [this.futureDateValidator?.bind(this)];
    this?.projects?.push(
      this.fb?.group(
        {
          name: [data?.name || ''],
          entity: [data?.entity || ''],
          start_date: [data?.start_date || '', startDateValidators],
          end_date: [data?.end_date || ''],
          summary: [data?.summary || ''],
        },
        { validators: this.projectDateValidator?.bind(this) },
      ),
    );
  }
  removeProject(index: number) {
    this.projects?.removeAt(index);
  }

  cancel() {
    this.router.navigate([this.workspaceNav.getResumeRoute()]);
  }
}
