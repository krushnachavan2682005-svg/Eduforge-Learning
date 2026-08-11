import { CommonHttpService } from './../../services/common-http.service';
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserLocalService } from '../../services/user-local-service';
import { ToastrService } from 'ngx-toastr';
import { HttpEventType } from '@angular/common/http';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-add-courses',
  imports: [ReactiveFormsModule, FormsModule, NgSelectModule, CommonModule],
  providers: [StorageService],
  templateUrl: './add-courses.html',
  styleUrl: './add-courses.scss',
})
export class AddCourses implements OnInit {
  courses: any;
  clientId = '';
  showModal = false;
  uploading = false;
  uploadProgress = 0;
  subcategoryId = '';
  isEditMode = false;
  tags: string[] = [];
  isSidebarOpen = false;
  isLoading = false;
  courseForm!: FormGroup;
  showAddCourseModal = false;
  editCourseData: any = null;
  userId: string | null = null;
  uploadFile: File | null = null;
  selectedFile: File | string | null = null;
  editCourseId: string | null = null;
  selectedImage: string | null = null;
  selectedImageUrl: string | null = null;
  uploadStatus: 'success' | 'error' | null = null;

  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() courseAdded = new EventEmitter<any>();

  private router = inject(Router);
  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private userService = inject(UserLocalService);
  private CommonHttpService = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);

  constructor() {
    this.courseForm = this?.fb?.group({
      title: [
        '',
        [
          Validators?.required,
          Validators.pattern(/^(?!.*[!&,._@/]{2,})(?!.*[!&,._@/]$)[A-Za-z0-9\s!&,._@/]+$/),
        ],
      ],
      level: [null, Validators?.required],
      description: [''],
      language: [null, Validators?.required],
      key: [''],
      tags: [''],
    });
  }

  ngOnInit() {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID);
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.route?.queryParamMap?.subscribe((queryParams: any) => {
      const editId = queryParams?.get('edit');
      if (editId) {
        this.editCourseId = editId;
        this.enableEditMode();
        this.fetchCourseData(editId);
      }
    });
  }

  startEdit(courseId: string) {
    if (!courseId) return;
    this.editCourseId = courseId;
    this.enableEditMode();
    this.fetchCourseData(courseId);
  }

  enableEditMode() {
    this.showModal = true;
    this.isEditMode = true;
    this.isSidebarOpen = true;
  }

  fetchCourseData(courseId: string) {
    this.CommonHttpService?.getCourse(
      `/course/${courseId}`,
    )?.subscribe({
      next: (response: any) => {
        const course =
          response?.data?.item ??
          response?.data?.course ??
          response?.data ??
          (Array?.isArray(response) ? response[0] : response);

        if (!course || typeof course !== 'object') {
          this.toastr?.error('Course not found from API.');
          return;
        }

        this.editCourseData = course;
        this.populateFormWithData(course);
      },
      error: (error) => {
        this?.toastr?.error(error?.error?.error || 'Something went wrong!');
      },
    });
  }

  populateFormWithData(courseData: any) {
    const mapped = {
      title: courseData?.title ?? courseData?.name ?? '',
      level: courseData?.level ?? courseData?.difficulty ?? null,
      description: courseData?.description ?? courseData?.details ?? '',
      language: courseData?.language ?? '',
      key: courseData?.thumbnail_url ?? courseData?.key ?? courseData?.thumbnail ?? '',
    };

    this.courseForm?.patchValue(mapped);
    if (Array?.isArray(courseData?.tags)) {
      this.tags = [...courseData?.tags];
    } else if (
      typeof courseData?.tags === 'string' &&
      courseData?.tags?.trim()
    ) {
      this.tags = courseData?.tags?.split(',')?.map((t: string) => t?.trim());
    } else {
      this.tags = [];
    }

    if (mapped?.key) {
      this.selectedFile = this.getFileName(mapped.key);
    } else {
      this.selectedFile = null;
    }

    // Ensure UI reflects changes
    this.isSidebarOpen = true;
    this.showModal = true;
    this.cdr?.detectChanges();
  }
  openSidebar() {
    this.tags = [];
    this.showModal = true;
    this.uploading = false;
    this.uploadProgress = 0;
    this.courseForm?.reset();
    this.selectedFile = null;
    this.uploadStatus = null;
    this.isSidebarOpen = true;
  }
  onFileSelected(event: any) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file?.type?.startsWith('image/')) {
      this?.toastr?.error('Please select an image file!');
      return;
    }

    if (file?.size > 10 * 1024 * 1024) {
      this?.toastr?.error('File size should be less than 10MB!');
      return;
    }
    this.uploadFile = file;
    this.selectedFile = file?.name;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.selectedImage = e?.target?.result;
      this.cdr?.detectChanges();
    };
    reader?.readAsDataURL(file);
  }

  submitForm() {
    const titleValue = this.courseForm.get('title')?.value;
    if (titleValue) {
      this.courseForm.get('title')?.setValue(titleValue.trimEnd());
    }

    if (!this.courseForm.valid) {
      this.courseForm.markAllAsTouched();
      return;
    }
    if (this.uploadFile) {
      this.uploadImage(this.uploadFile);
    } else {
      this.submit();
    }
  }

  removeImage() {
    this.selectedImage = null;
    this.selectedFile = null;
    this.uploadStatus = null;
    this.courseForm?.patchValue({ key: '' });
  }
  uploadImage(file: File) {
    const formData = new FormData();
    formData?.append('key', file);

    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadStatus = null;

    this.CommonHttpService?.uploadCourseImage(`/upload`, formData).subscribe({
      next: (event: any) => {
        if (event?.type === HttpEventType?.UploadProgress && event?.total) {
          this.uploadProgress = Math?.round(
            (event?.loaded / event?.total) * 100,
          );
        }
        if (event?.type === HttpEventType?.Response) {
          this.uploading = false;
          this.uploadStatus = 'success';
          // this.toastr?.success('Image uploaded successfully!');
          const thumbnail_url = event?.body?.data?.key;
          this.courseForm.get('key')?.setValue(thumbnail_url);
          this.selectedImageUrl = event?.body?.data?.url;
          this.cdr?.detectChanges();
          this.submit();
        }
      },
      error: () => {
        this.uploading = false;
        this.uploadStatus = 'error';
        this.toastr?.error('Image upload failed.');
      },
    });
  }

  addTag() {
    const tags = this?.courseForm?.get('tags')?.value?.trim();
    if (tags && tags?.length > 0) {
      if (this.tags?.length >= 5) {
        this?.toastr?.error('Maximum 5 tags are allowed!');
        return;
      }
      if (tags?.length > 30) {
        alert('Tag cannot be more than 30 characters!');
        return;
      }
      if (tags && tags?.length > 0) {
        if (!this?.tags?.includes(tags)) {
          this?.tags?.push(tags);
          this?.courseForm?.patchValue({ tags: '' });
        } else {
        }
      }
    }
  }

  levels = [
    { label: 'Beginner', value: 'BEGINNER' },
    { label: 'Intermediate', value: 'INTERMEDIATE' },
    { label: 'Advanced', value: 'ADVANCED' },
  ];

  languages = [
    { label: 'Hindi', value: 'HINDI' },
    { label: 'English', value: 'ENGLISH' },
    { label: 'Marathi', value: 'MARATHI' },
  ];

  removeTag(index: number) {
    const removedTag = this?.tags[index];
    this?.tags?.splice(index, 1);
  }

  submit() {
    if (this.uploading) {
      this.toastr.warning('Please wait, image is uploading...');
      return;
    }
    if (this?.courseForm?.valid) {
      this.isLoading = true;
      const userId = this?.userService?.getUserId();

      const courseData = {
        ...this?.courseForm?.value,
        tags: this?.tags,
        userId: userId,
        thumbnail_url: this.courseForm.get('key')?.value,
      };

      if (this.isEditMode && this.editCourseId) {
        this.updateCourse(courseData);
      } else {
        this.addCourse(courseData);
      }
    } else {
      this?.courseForm?.markAllAsTouched();
    }
  }
  addCourse(courseData: any) {
    this?.CommonHttpService?.postCourse(
      `/course`,
      courseData,
    )?.subscribe({
      next: () => {
        this.isLoading = false;
        this?.toastr?.success('Course added successfully!');
        this?.courseAdded?.emit(courseData);
        this?.close?.emit();
        this?.courseForm?.reset();
        this.tags = [];
        this.isSidebarOpen = false;
        this.showModal = false;
      },
      error: (error) => {
        this.isLoading = false;
        this?.toastr?.error(error?.error?.error || 'Something went wrong!');
      },
    });
  }

  updateCourse(courseData: any) {
    this?.CommonHttpService?.putCourse(
      `/course/${this.editCourseId}`,
      courseData,
    )?.subscribe({
      next: (response) => {
        this.isLoading = false;
        this?.toastr?.success('Course updated successfully!');
        this?.courseAdded?.emit(courseData);
        this?.close?.emit();
        this?.courseForm?.reset();
        this.tags = [];
        this.isSidebarOpen = false;
        this.showModal = false;
        this.isEditMode = false;
        this.editCourseId = null;
        this.editCourseData = null;

        if (this.isStandaloneCreateRoute()) {
          this.router?.navigate([this.workspaceNav.getCourseListRoute()]);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this?.toastr?.error(error?.error?.error || 'Something went wrong!');
      },
    });
  }

  // private cleanPastedText(text: string, fieldName: string): string {
  //   if (fieldName === 'title') {
  //     let cleaned = text?.replace(/[^a-zA-Z0-9\s!&,._@/]/g, '');
  //     cleaned = cleaned?.replace(/\s+/g, ' ')?.trim();
  //     cleaned = cleaned?.replace(/^[^a-zA-Z]*/, '');
  //     return cleaned;
  //   }
  //   return text;
  // }
  onDescriptionChange(event: Event): void {
    const val = (event?.target as HTMLTextAreaElement)?.value;
    const norm = this.normalizeDescription(val);
    if (val !== norm) this.courseForm.get('description')?.setValue(norm);
    this.courseForm.get('description')?.markAsTouched();
  }

  private normalizeDescription(val: string): string {
    if (!val) return val;
    val = val?.replace(/\s+/g, ' ')?.trimStart();
    return /[A-Za-z]/.test(val)
      ? val
      : val?.replace(/[^A-Za-z ]/g, '')?.replace(/\s+/g, ' ');
  }

  onDescriptionKeypress(e: KeyboardEvent): boolean {
    const val = (e?.target as HTMLTextAreaElement)?.value,
      ch = e?.key,
      cur = (e?.target as HTMLTextAreaElement)?.selectionStart || 0;
    if (ch?.length > 1) return true;

    const isLetter = /[A-Za-z]/.test(ch),
      isSpace = ch === ' ',
      isSpecialAllowed = ['@', '/', '_'].includes(ch),
      before = val[cur - 1];
    const hasLetter = /[A-Za-z]/.test(val);

    if (!hasLetter && !isLetter && !isSpace && !isSpecialAllowed)
      return (e?.preventDefault(), false);
    if (isSpace && (!cur || before === ' '))
      return (e?.preventDefault(), false);

    return true;
  }

  removeNonTextCharacters(event: any, controlName: string): void {
    const input = event?.target;
    const cleaned = input?.value?.replace(/[^a-zA-Z\s@/_]/g, '');
    input.value = cleaned;
  }

  closeSidebar() {
    this.courseForm.reset({
      title: '',
      level: null,
      description: '',
      language: null,
      key: null,
      tags: [],
    });

    this.tags = [];
    this.isEditMode = false;
    this.editCourseId = null;
    this.editCourseData = null;

    this.selectedFile = null;
    this.selectedImage = null;
    this.selectedImageUrl = null;
    this.uploadStatus = null;
    this.uploading = false;
    this.uploadProgress = 0;

    this.showModal = false;
    this.isSidebarOpen = false;

    if (this.isStandaloneCreateRoute()) {
      this.router.navigate([this.workspaceNav.getCourseListRoute()]);
    }
  }

  goBackToCourses() {
    this.router?.navigate([this.workspaceNav.getCourseListRoute()]);
  }
  onTitleInput(event: Event): void {
    const input = event?.target as HTMLInputElement;
    if (!input) return;
    let v = (input?.value || '')
      .replace(/[^A-Za-z0-9\s!&,._@/]/g, '')
      .replace(/[!&,._@/]{2,}/g, (match) => match[0])
      .replace(/^\s+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[^A-Za-z]+/, '');

    let seenLetter = false,
      digits = 0;
    v = Array.from(v)
      .filter((ch) => {
        if (/[A-Za-z]/.test(ch)) return (seenLetter = true);
        if (/[0-9]/.test(ch)) return seenLetter && digits++ < 3;
        if (['!', '&', ',', '.', '_', '@', '/'].includes(ch)) return true;
        return ch === ' ';
      })
      .join('');

    if (input?.value !== v) input.value = v;
    this.courseForm?.get('title')?.setValue(v);
  }

  getFileName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    if (parts.length >= 3) {
      return parts[1];
    }
    return parts.pop() || '';
  }

  private isStandaloneCreateRoute() {
    return (
      this.router.url.includes('/courses/add-courses') ||
      this.router.url.includes('/teacher/courses/create')
    );
  }
}

