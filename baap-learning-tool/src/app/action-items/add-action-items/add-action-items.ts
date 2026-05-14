import {
  Input,
  OnInit,
  Output,
  inject,
  signal,
  Component,
  EventEmitter,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { STORAGEENUMS } from '../../shared/enum';
import { HttpEventType } from '@angular/common/http';
import { NgSelectModule } from '@ng-select/ng-select';
import { StorageService } from '../../services/storage-service';
import { CommonHttpService } from '../../services/common-http.service';
import { Tooltip } from '../../shared/tooltip';
@Component({
  selector: 'app-add-action-items',
  imports: [ReactiveFormsModule, NgSelectModule, CommonModule, Tooltip],
  templateUrl: './add-action-items.html',
  styleUrl: './add-action-items.scss',
})
export class AddActionItems implements OnInit {
  limit = 10;
  client_Id = '';
  uploading = false;
  showModal = false;
  isLoading = false;
  uploadProgress = 0;
  isEditMode = false;
  @Input() data: any;
  userPage = signal(1);
  isSidebarOpen = false;
  @Input() show = false;
  reviewIds: any[] = [];
  coursePage = signal(1);
  actionForm: any = FormGroup;
  userId: string | null = null;
  allLevels = signal<any[]>([]);
  selectedReviewers: any[] = [];
  private fb = inject(FormBuilder);
  selectedFile: File | null = null;
  attachmentUrl: string | null = null;
  private str = inject(StorageService);
  selectedFileName: string | null = null;
  private cdr = inject(ChangeDetectorRef);
  private toastrMessage = inject(ToastrService);
  private commonhttp = inject(CommonHttpService);
  uploadStatus: 'success' | 'error' | null = null;
  @Output() closePopUp = new EventEmitter<void>();

  ngOnInit() {
    this.client_Id = this.str?.getItem(STORAGEENUMS.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS.USER_ID);
    this.actionForm = this.fb.group({
      task_name: ['', Validators.required],
      total_score: [
        '',
        [
          Validators.required,
          Validators.maxLength(3),
          Validators.pattern('^[0-9]+$'),
        ],
      ],
      description: ['', Validators.required],
      level: [null, Validators.required],
      reviewer: [null],
      attachment: [''],
    });
    this.Reviewers();
    // this.getLevels();
  }

  Reviewers() {
    this.commonhttp
      .getUser(`/auth/api/users/client/${this.client_Id}/users?status=active`)
      .subscribe({
        next: (res: any) => {
          const users = res?.data ?? [];
          this.reviewIds = users
            ?.filter((u: any) => this.isTutorUser(u))
            ?.map((u: any) => ({
              value: u?.id,
              id: `${u?.first_name} ${u?.last_name}`.trim(),
            }));
        },
        error: () => (this.reviewIds = []),
      });
  }

  private isTutorUser(user: any): boolean {
    return (user?.user_mappings ?? [])?.some(
      (m: any) => m?.role?.name?.toLowerCase() === 'tutor',
    );
  }

  getLevels() {
    this.commonhttp.getCourse(`/client/${this.client_Id}/level`).subscribe({
      next: (res: any) => {
        this.allLevels?.set(res?.data || []);
      },
    });
  }

  submitForm() {
    if (!this.actionForm?.valid) {
      this.actionForm?.markAllAsTouched();
      return;
    }

    if (this.selectedReviewers?.length === 0) {
      this.toastrMessage.error('Please select at least one reviewer', '', {
        closeButton: true,
      });
      return;
    }

    const actionData = this.actionForm?.value;
    const reviewerArray = this.selectedReviewers?.map((r) => ({
      id: r?.value,
      name: r?.id,
    }));

    const payload = {
      task_name: actionData?.task_name,
      total_score: actionData?.total_score,
      description: actionData?.description,
      reviewer: reviewerArray,
      level: actionData?.level,
      pdf_attachment: this.attachmentUrl || null,
    };

    this.isLoading = true;
    const url = this.isEditMode
      ? `/client/${this.client_Id}/action-items/${this.data?.id}`
      : `/client/${this.client_Id}/action-items`;

    const request$ = this.isEditMode
      ? this.commonhttp?.putCourse(url, payload)
      : this.commonhttp?.postCourse(url, payload);

    request$.subscribe({
      next: () => {
        const msg = this.isEditMode
          ? 'Action Item updated successfully'
          : 'Action Item created successfully';
        this.toastrMessage?.success(msg);
        this.isLoading = false;
        this.closeSidebar();
        this.closePopUp?.emit();
      },
      error: (err) => {
        this.toastrMessage.error('Something went wrong');
        this.isLoading = false;
      },
    });
  }

  ngOnChanges() {
    if (this.show) {
      this.isEditMode = !!this.data;
      this.openSidebar();
    }
  }

  addSelectedReviewer(reviewer: any) {
    if (!reviewer) return;
    const exists = this.selectedReviewers?.some(
      (r) => r?.value === reviewer?.value,
    );
    if (!exists) {
      this.selectedReviewers?.push(reviewer);
    }
    this.actionForm.get('reviewer')?.patchValue(null, { emitEvent: false });
  }

  removeReviewer(index: number) {
    this.selectedReviewers?.splice(index, 1);
  }

  triggerFileInput(): void {
    const fileInput = document?.getElementById(
      'attachment',
    ) as HTMLInputElement;
    fileInput?.click();
  }
  onFileSelected(event: Event): void {
    const input = event?.target as HTMLInputElement;
    if (input?.files && input?.files?.length > 0) {
      const file = input?.files[0];
      this.selectedFile = file;
      this.selectedFileName = file?.name;
      this.uploadImage(file);
    }
  }

  uploadImage(file: File) {
    const formData = new FormData();
    formData?.append('key', file);

    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadStatus = null;

    this.commonhttp?.uploadCourseImage(`/upload`, formData).subscribe({
      next: (event: any) => {
        if (event?.type === HttpEventType?.UploadProgress && event?.total) {
          this.uploadProgress = Math?.round(
            (event?.loaded / event?.total) * 100,
          );
        }
        if (event?.type === HttpEventType?.Response) {
          this.uploading = false;
          this.uploadStatus = 'success';
          this.toastrMessage?.success('File uploaded successfully');
          const url = event?.body?.data?.key;
          this.attachmentUrl = url;
          this.selectedFileName = file?.name;
          this.actionForm.get('attachment')?.setValue(url);
          this.cdr?.detectChanges();
        }
      },
      error: () => {
        this.uploading = false;
        this.uploadStatus = 'error';
        this.toastrMessage?.error('File upload failed');
      },
    });
  }

  openSidebar() {
    this.isSidebarOpen = true;
    this.showModal = true;
    if (this.isEditMode && this.data) {
      setTimeout(() => {
        this.actionForm.patchValue({
          task_name: this.data?.task_name,
          total_score: this.data?.total_score,
          description: this.data?.description,
          level: this.data?.level,
        });

        if (this.data?.reviewer && Array.isArray(this.data.reviewer)) {
          this.selectedReviewers = this.data?.reviewer?.map((rev: any) => ({
            value: rev?.id || '',
            id: rev?.name || '',
          }));
        }
        if (this.data?.pdf_attachment) {
          this.attachmentUrl = this.data.pdf_attachment;
          this.selectedFileName = this.getFileName(this.data.pdf_attachment);
        }
      }, 50);
    }
  }

  closeSidebar() {
    this.isSidebarOpen = false;
    this.showModal = false;
    this.actionForm?.reset();
    this.selectedReviewers = [];
    this.selectedFileName = null;
    this.attachmentUrl = null;
    this.uploadStatus = null;
    this.uploading = false;
    this.uploadProgress = 0;
    this.isEditMode = false;
  }

  onTaskNameInput(event: Event): void {
    const input = event?.target as HTMLInputElement;
    if (!input) return;
    let v = (input?.value || '')
      .replace(/[^A-Za-z0-9\s]/g, '')
      .replace(/^\s+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[^A-Za-z]+/, '');

    let seenLetter = false,
      digits = 0;
    v = Array.from(v)
      .filter((ch) => {
        if (/[A-Za-z]/.test(ch)) return (seenLetter = true);
        if (/[0-9]/.test(ch)) return seenLetter && digits++ < 3;
        return ch === ' ';
      })
      .join('');

    if (input?.value !== v) input.value = v;
    this.actionForm?.get('task_name')?.setValue(v);
  }

  getFileName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    if (parts.length >= 3) {
      return parts[1];
    }
    return parts.pop() || '';
  }
}
