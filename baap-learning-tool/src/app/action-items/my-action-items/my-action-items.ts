import { forkJoin } from 'rxjs';
import { Modal } from '../../modal/modal';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { Tooltip } from '../../shared/tooltip';
import { CommonModule } from '@angular/common';
import { STORAGEENUMS } from '../../shared/enum';
import { AddLevel } from '../add-level/add-level';
import { HttpEventType } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { SidebarService } from '../../services/sidebar.service';
import { StorageService } from '../../services/storage-service';
import { HeaderComponent } from '../../shared/header.component';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { AddActionItems } from '../add-action-items/add-action-items';
import { CommonHttpService } from '../../services/common-http.service';
import { PermissionDirective } from '../../services/permission-directive';
import { SafeUrlPipe } from '../../my-learning/student-view/student-view';
import { Component, inject, signal, ChangeDetectorRef } from '@angular/core';
import { AssignActionItems } from '../assign-action-items/assign-action-items';
import { PaginationComponent } from '../../pagination/pagination';

@Component({
  selector: 'app-my-action-items',
  standalone: true,
  imports: [
    CommonModule,
    Modal,
    Tooltip,
    AddLevel,
    FormsModule,
    SafeUrlPipe,
    AddActionItems,
    HeaderComponent,
    AssignActionItems,
    PermissionDirective,
    NgxSkeletonLoaderComponent,
    PaginationComponent,
  ],
  templateUrl: './my-action-items.html',
  styleUrl: './my-action-items.scss',
})
export class MyActionItems {
  client_ID = '';
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  isCollapsed = false;
  showPdfModal = false;
  isDropdownOpen = false;
  selectedCard: any = null;
  deleteExam: boolean = false;
  pdfUrl: string | null = null;
  editData = signal<any>(null);
  actionLoaded = signal(false);
  ActionItems = signal<any[]>([]);
  isLoadingAction = signal(false);
  openAssignMenubar = signal(false);
  activeActionCardId: string | null = null;
  showAddCourseModal: boolean = false;
  selectedFileName: string | null = null;
  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  pageSizeOptions = [10, 20, 30, 40, 50];
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  public skeletonService = inject(SkeletonTheme);
  private commonHttp = inject(CommonHttpService);
  public sidebarService = inject(SidebarService);
  fileInput!: HTMLInputElement;
  userId: string | null = null;
  descriptionLimit: number = 380;
  isAttachmentsModalOpen = false;
  selectedCardForAttachments: any = null;
  uploadingCards: Record<string, boolean> = {};
  uploadProgressCards: Record<string, number> = {};
  expandedDescriptions: Record<number, boolean> = {};
  attachments: any;
  apiService: any;

  headers = [
    {
      title: 'MY ACTION ITEMS',
      subtitle: 'VIEW AND MANAGE YOUR SUBMITTED AND PENDING ACTION ITEMS HERE',
    },
  ];

  ngOnInit() {
    this.client_ID = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID);
    this.PageLimit();
    this.getActionItems(this.currentPage);
  }

  isExpanded(card: any) {
    return this.expandedDescriptions[card.id] === true;
  }

  toggleDescription(card: any) {
    this.expandedDescriptions[card.id] = !this.expandedDescriptions[card.id];
  }

  getShortDescription(text: string) {
    if (!text) return '--';
    if (text.length <= this.descriptionLimit) return text;
    return text.substring(0, this.descriptionLimit) + '  ......';
  }
  triggerFileInput(input: HTMLInputElement) {
    input.click();
  }
  onFileSelected(event: Event, card: any) {
    const files = (event?.target as HTMLInputElement)?.files;
    if (!files || files?.length === 0) return;
    this.selectedFileName =
      files?.length === 1 ? files[0]?.name : `${files?.length} Images selected`;
    Array?.from(files)?.forEach((file) => {
      this?.uploadImage(file, card);
    });
    (event?.target as HTMLInputElement).value = '';
  }
  private getCardId(card: any): string {
    return card?.id || card?.task_name;
  }
  private resetUploadState(cardId: string) {
    this.uploadingCards[cardId] = false;
    this.uploadProgressCards[cardId] = 0;
    this.selectedFileName = null;
  }
  uploadImage(file: File, card: any) {
    const cardId = this.getCardId(card);
    const formData = new FormData();
    formData.append('file', file);

    this.uploadingCards[cardId] = true;
    this.uploadProgressCards[cardId] = 0;

    this.commonHttp.uploadCourseImage(`/upload`, formData).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgressCards[cardId] = Math.round(
            (event.loaded / event.total) * 100,
          );
          return;
        }

        if (event.type === HttpEventType.Response) {
          this.resetUploadState(cardId);
          this.toastr.success('File uploaded successfully');

          const data = event?.body?.data;

          card.attachments ??= [];
          card.attachments.push({
            name: file.name,
            key: data?.key,
            type: file?.type,
          });

          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.resetUploadState(cardId);
        this.toastr.error('File upload failed');
        this.cdr.detectChanges();
      },
    });
  }

  openAttachmentsModal(card: any) {
    this.selectedCardForAttachments = card;
    this.isAttachmentsModalOpen = true;
  }
  closeAttachmentsModal() {
    this.isAttachmentsModalOpen = false;
    this.selectedCardForAttachments = null;
  }
  removeAttachment(index: number) {
    const attachments = this.selectedCardForAttachments?.attachments;
    if (!attachments) return;
    const attachment = attachments[index];
    attachment?.rawUrl && URL.revokeObjectURL(attachment.rawUrl);
    attachments.splice(index, 1);
    this.cdr.detectChanges();
  }
  isUploading(card: any): boolean {
    return this.uploadingCards[this.getCardId(card)] || false;
  }
  getUploadProgress(card: any): number {
    return this.uploadProgressCards[this.getCardId(card)] || 0;
  }
  downloadAttachment(attachment: any) {
    const link = document.createElement('a');
    link.href = attachment?.url || attachment?.rawUrl || attachment;
    link.download = attachment?.name || this.getFileName(link.href);
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  editAttachment(file: any, index: number, card: any) {
    const updatedName = prompt('Edit file name', file.name);

    if (updatedName && updatedName.trim()) {
      if (card && card.attachments) {
        card.attachments[index] = {
          ...file,
          name: updatedName.trim(),
        };
      }
    }
  }

  deleteAttachment(file: any, index: number, card: any) {
    if (confirm('Delete this file?')) {
      if (this.apiService) {
        this.apiService.deleteAttachment(file.id).subscribe(() => {
          if (card && card.attachments) {
            card.attachments.splice(index, 1);
          }
        });
      } else {
        console.warn('apiService is not defined for deleting attachment');
        if (card && card.attachments) {
          card.attachments.splice(index, 1);
        }
      }
    }
  }
  getFileName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    if (parts.length >= 3) {
      return parts[1];
    }
    return parts.pop() || '';
  }

  getFileFormat(url: string): string {
    if (!url) return '';
    const name = this.getFileName(url);
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : 'FILE';
  }
  PageLimit() {
    const qp = this.route?.snapshot?.queryParamMap;
    const qpPage = Number(qp?.get('page'));
    const qpLimit = Number(qp?.get('limit'));
    if (!Number.isNaN(qpPage) && qpPage > 0) {
      this.currentPage = qpPage;
    }
    if (!Number.isNaN(qpLimit) && qpLimit > 0) {
      this.pageSize = qpLimit;
    }
  }

  getActionItems(page: number = this.currentPage) {
    this.actionLoaded?.set(false);
    this.isLoadingAction?.set(true);
    this.commonHttp
      .getCourse(
        `/client/${this.client_ID}/get-assigned-action-items-byuser/${this.userId}?page=${page}&limit=${this.pageSize}`,
      )
      .subscribe({
        next: (res: any) => {
          const data = res?.data;
          const items = Array.isArray(data) ? data : (data?.items ?? []);

          this.ActionItems?.set(
            items.map((item: any) => {
              if (typeof item?.attachments === 'string') {
                try {
                  item.attachments = JSON?.parse(item?.attachments);
                } catch {
                  item.attachments = [];
                }
              }
              item.attachments = item?.attachments || [];
              item.isCollapsed = true;
              return item;
            }),
          );
          items.forEach((action: any, index: number) => {
            if (action?.pdf_attachment) {
              this.getPresignedUrls([action?.pdf_attachment], (urls) => {
                const updated = [...this.ActionItems()];
                updated[index] = {
                  ...updated[index],
                  tutorPdf: {
                    key: action?.pdf_attachment,
                    url: urls[0] || null,
                  },
                };
                this.ActionItems?.set(updated);
              });
            }
            if (
              Array.isArray(action?.attachment) &&
              action?.attachment?.length > 0
            ) {
              this.getPresignedUrls(action.attachment, (urls) => {
                const updated = [...this.ActionItems()];
                updated[index] = {
                  ...updated[index],
                  signedUrls: urls,
                };
                this.ActionItems?.set(updated);
              });
            }
          });

          const pagination = res?.pagination ?? res?.data?.pagination;
          if (pagination?.totalPages) {
            this.totalPages = pagination?.totalPages;
          } else if (pagination?.total && pagination?.limit) {
            this.totalPages = Math?.ceil(pagination?.total / pagination?.limit);
          } else {
            const itemCount = items.length || 0;
            if (itemCount > this.pageSize) {
              this.totalPages = Math.ceil(itemCount / this.pageSize);
            } else {
              this.totalPages = 1;
            }
          }
          this.isLoadingAction?.set(false);
          this.actionLoaded?.set(true);
        },
        error: (err) => {
          console.error('Error fetching action items:', err);
          this.isLoadingAction?.set(false);
        },
      });
  }
  getPresignedUrls(keys: string[], callback: (urls: string[]) => void) {
    if (!keys || keys.length === 0) {
      callback([]);
      return;
    }

    const requests = keys.map((key) =>
      this.commonHttp.postCourse('/presigned-url', { key }),
    );

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        const urls = responses.map((r) => r?.data).filter(Boolean);
        callback(urls);
      },
      error: () => {
        this.toastr.error('Failed to load attachments');
        callback([]);
      },
    });
  }

  openPdf(item: any, att: any) {
    if (!att?.url) {
      return;
    }

    this.pdfUrl = att?.url;
    this.showPdfModal = true;
    this.cdr.detectChanges();
  }

  openPdfStudent(url: string) {
    this.pdfUrl = url;
    this.showPdfModal = true;
    this.ActionItems.update((list) =>
      list?.map((i) => ({
        ...i,
        selectedPdfUrl: i === url || null,
      })),
    );
  }
  getAttachmentFolderName(path: string): string {
    if (!path) return '--';

    const parts = path?.split('/');
    return parts.length >= 3 ? parts[1] : '--';
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }
  goToPage(page: number) {
    if (page >= 1) {
      this.currentPage = page;
      this.getActionItems(page);
      this.router?.navigate([], {
        relativeTo: this.route,
        queryParams: { page: this.currentPage, limit: this.pageSize },
        queryParamsHandling: 'merge',
      });
    }
  }
  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.getActionItems(1);
    this.isDropdownOpen = false;
    this.router?.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.currentPage, limit: this.pageSize },
      queryParamsHandling: 'merge',
    });
  }
  togglePublish(card: any) {
    card.is_published = !card.is_published;
  }

  toggleCard(test: any) {
    if (this.activeActionCardId === test?.id) {
      this.activeActionCardId = null;
    } else {
      this.activeActionCardId = test?.id;
    }
  }
  closeAddCourseModal() {
    this.selectedCard = null;
    this.showAddCourseModal = false;
    this.openAssignMenubar?.set(false);
    this.editData?.set(null);
    this.getActionItems();
  }
  goToAddNewTest() {
    this.router?.navigate(['action-items/add-action-items']);
  }
  getProgressPercentage(score: string | undefined): number {
    if (!score) return 0;
    const parts = score?.split('/')?.map((p) => Number(String(p)?.trim()));
    const obtained = parts[0];
    const total = parts[1] || 100;
    if (!isFinite(obtained) || !isFinite(total) || total <= 0) return 0;
    return Math?.max(0, Math?.min(100, Math?.round((obtained / total) * 100)));
  }
  getItemsById(id: string) {
    this.commonHttp.getCourse(id).subscribe((res: any) => {
      this.editData?.set(res?.data);
    });
  }
  getActionItem(id: string) {
    this.commonHttp
      .getCourse(`/client/${this.client_ID}/action-items/${id}`)
      .subscribe({
        next: (res: any) => {
          this.editData?.set(res?.data);
        },
        error: (err) => {
          console.error('Error fetching action items:', err);
        },
      });
  }

  submitActionItem(card: any, action: 'SUBMITTED') {
    this.isLoadingAction?.set(true);
    const existingAttachments: string[] = Array?.isArray(card?.attachment)
      ? card?.attachment
      : [];

    const newAttachments: string[] = Array?.isArray(card?.attachments)
      ? card.attachments?.map((att: any) => att?.key)?.filter(Boolean)
      : [];

    const mergedAttachments = Array?.from(
      new Set([...existingAttachments, ...newAttachments]),
    );
    const payload = {
      assigned_action_item_id: card?.id,
      status: action,
      notes: card?.notes || '',
      attachment: mergedAttachments,
    };

    this.commonHttp
      .putCourse(
        `/client/${this.client_ID}/update-assigned-action-status/${this.userId}`,
        payload,
      )
      .subscribe({
        next: () => {
          this.getActionItems();
          this.toastr?.success('Action Item submitted successfully');
          this.isLoadingAction?.set(false);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || err?.message);
          this.isLoadingAction?.set(false);
        },
      });
  }

  deleteAssignment(fileKey: string, card: any) {
    const assigned_action_item_id = card?.id;
    this.commonHttp
      .delete(
        `/client/${this.client_ID}/delete-attachments/${assigned_action_item_id}`,
        {
          delete_keys: [fileKey],
        },
      )
      .subscribe({
        next: () => {
          card.attachment = card?.attachment?.filter(
            (att: string) => att !== fileKey,
          );

          this.toastr.success('Attachment deleted successfully');
          this.cdr?.detectChanges();
        },
        error: (err) => {
          console.error('Delete failed', err);
          this.toastr.error('Delete failed');
        },
      });
  }

  onPublish(event: any, card: any) {
    const isChecked = event?.target?.checked;
    card.publish = isChecked;

    const payload = {
      assigned_id: card?.id,
      assignment_id: card?.action_item_id,
      user_id: this?.userId,
      publish: isChecked,
    };

    this.commonHttp
      .postCourse(`/client/${this.client_ID}/assignment/publish`, payload)
      .subscribe({
        next: () => {
          this.toastr?.success(
            isChecked
              ? 'Action Item published successfully'
              : 'Action Item unpublished successfully',
          );
          this.getActionItems(this.currentPage);
        },
        error: () => {
          this.toastr?.error('Failed to update publish status');
          card.publish = !isChecked;
          this.cdr?.detectChanges();
        },
      });
  }

  isSubmitDisabled(card: any): boolean {
    const hasNotes = card?.notes && card?.notes?.trim()?.length > 0;

    const hasExistingAttachments =
      Array.isArray(card?.attachment) && card?.attachment?.length > 0;

    const hasNewAttachments =
      Array.isArray(card?.attachments) && card?.attachments?.length > 0;

    const hasAttachments = hasExistingAttachments || hasNewAttachments;

    return !(hasNotes || hasAttachments);
  }
  closeModal() {
    this.deleteExam = false;
    this.selectedCard = null;
  }
  closePdfModal() {
    this.showPdfModal = false;
    this.pdfUrl = null;
  }
}
