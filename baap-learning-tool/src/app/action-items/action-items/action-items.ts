import { Modal } from '../../modal/modal';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Tooltip } from '../../shared/tooltip';
import { STORAGEENUMS } from '../../shared/enum';
import { AddLevel } from '../add-level/add-level';
import { HttpEventType } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { SidebarService } from '../../services/sidebar.service';
import { StorageService } from '../../services/storage-service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { AddActionItems } from '../add-action-items/add-action-items';
import { CommonHttpService } from '../../services/common-http.service';
import { PermissionDirective } from '../../services/permission-directive';
import { Component, inject, signal, ChangeDetectorRef } from '@angular/core';
import { AssignActionItems } from '../assign-action-items/assign-action-items';
import { SafeUrlPipe } from '../../my-learning/student-view/student-view';
import { PaginationComponent } from '../../pagination/pagination';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-action-items',
  standalone: true,
  imports: [
    Modal,
    Tooltip,
    AddLevel,
    FormsModule,
    SafeUrlPipe,
    CommonModule,
    AddActionItems,    AssignActionItems,
    PermissionDirective,
    NgxSkeletonLoaderComponent,
    PaginationComponent,
  ],
  templateUrl: './action-items.html',
  styleUrl: './action-items.scss',
})
export class ActionItems {
  client_ID = '';
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  apiService: any;
  attachments: any;
  isCollapsed = false;
  showPdfModal = false;
  isDropdownOpen = false;
  selectedCard: any = null;
  deleteExam: boolean = false;
  pdfUrl: string | null = null;
  fileInput!: HTMLInputElement;
  userId: string | null = null;
  editData = signal<any>(null);
  actionLoaded = signal(false);
  descriptionLimit: number = 380;
  ActionItems = signal<any[]>([]);
  isLoadingAction = signal(false);
  openAssignMenubar = signal(false);
  showAddCourseModal: boolean = false;
  selectedCardForAttachments: any = null;
  selectedFileName: string | null = null;
  uploadingCards: Record<string, boolean> = {};
  uploadProgressCards: Record<string, number> = {};
  expandedDescriptions: Record<number, boolean> = {};

  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  pageSizeOptions = [10, 20, 30, 40, 50];
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  public skeletonService = inject(SkeletonTheme);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public sidebarService = inject(SidebarService);

  ngOnInit() {
    this.client_ID = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID);
    this.PageLimit();
    this.getAllActionItem(this.currentPage);
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
  openPdf(url: string) {
    this.pdfUrl = url;
    this.showPdfModal = true;
    this.ActionItems.update((list) =>
      list?.map((i) => ({
        ...i,
        selectedPdfUrl: i === url || null,
      })),
    );
  }
  closePdfModal() {
    this.showPdfModal = false;
    this.pdfUrl = null;
  }
  isUploading(card: any): boolean {
    return this.uploadingCards[this.getCardId(card)] || false;
  }
  getUploadProgress(card: any): number {
    return this.uploadProgressCards[this.getCardId(card)] || 0;
  }

  getFileName(url: string): string {
    if (!url) return '';
    const parts = decodeURIComponent(url)?.split('?')[0]?.split('/');
    return `${parts?.at(-2)}.${parts?.at(-1)?.split('.')?.pop()}`;
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

  getAllActionItem(page: number = this.currentPage) {
    if (!this.client_ID) return;

    this.isLoadingAction.set(true);
    this.actionLoaded.set(false);
    this.commonHttp
      .getCourse(
        `/client/${this.client_ID}/action-items?page=${page}&limit=${this.pageSize}`,
      )
      .subscribe({
        next: (res: any) => {
          const items = res?.data?.items ?? [];
          this.actionLoaded.set(true);
          this.isLoadingAction.set(false);
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              item.isCollapsed = true;
            });
          }
          this.ActionItems?.set(Array?.isArray(items) ? items : []);
          const pagination = res?.pagination ?? res?.data?.pagination;
          if (pagination?.totalPages) {
            this.totalPages = pagination?.totalPages;
          } else if (pagination?.total && pagination?.limit) {
            this.totalPages = Math?.ceil(pagination?.total / pagination?.limit);
          } else {
            this.totalPages = 1;
          }
          items.forEach((action: any) => {
            if (action?.pdf_attachment) {
              this.getPresignedUrl(action);
            }
          });
        },
        error: (err) => {
          this.ActionItems.set([]);
          this.actionLoaded.set(true);
          this.isLoadingAction.set(false);
          console.error('Error loading action items:', err);
        },
      });
  }

  getPresignedUrl(action: any) {
    this.commonHttp
      .postCourse('/presigned-url', { key: action?.pdf_attachment })
      .subscribe({
        next: (res: any) => {
          const updatedCourses = this.ActionItems()?.map((item: any) =>
            item?.id === action?.id ? { ...item, signedUrl: res?.data } : item,
          );

          this.ActionItems?.set(updatedCourses);
        },
        error: () => {
          this.toastr.error('Failed to load attachment');
        },
      });
  }

  goToPage(page: number) {
    if (page >= 1) {
      this.currentPage = page;
      this.getAllActionItem(page);
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
    this.getAllActionItem(1);
    this.router?.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.currentPage, limit: this.pageSize },
      queryParamsHandling: 'merge',
    });
  }
  toggleCard(card: any) {
    const isCurrentlyCollapsed = card.isCollapsed;
    this.ActionItems().forEach((item) => {
      if (item !== card) {
        item.isCollapsed = true;
      }
    });
    card.isCollapsed = !isCurrentlyCollapsed;
    this.ActionItems.set([...this.ActionItems()]);
  }
  closeAddCourseModal() {
    this.selectedCard = null;
    this.showAddCourseModal = false;
    this.openAssignMenubar?.set(false);
    this.editData?.set(null);
    this.getAllActionItem();
  }
  goToAddNewTest() {
    this.router?.navigate([this.workspaceNav.getActionItemCreateRoute()]);
  }
  getProgressPercentage(score: string | undefined): number {
    if (!score) return 0;
    const parts = score?.split('/')?.map((p) => Number(String(p)?.trim()));
    const obtained = parts[0];
    const total = parts[1] || 100;
    if (!isFinite(obtained) || !isFinite(total) || total <= 0) return 0;
    return Math?.max(0, Math?.min(100, Math?.round((obtained / total) * 100)));
  }
  headers = [
    {
      title: 'ACTION ITEM',
      subtitle: 'REVIEW AND COMPLETE YOUR ACTION ITEMS HERE',
    },
  ];
  onDeleteClick(card: any) {
    this.selectedCard = card;
    this.deleteExam = true;
  }
  onEditClick(card: any) {
    this.getActionItem(card?.id);
    this.openAssignMenubar?.set(true);
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
  deleteActionItem() {
    this.commonHttp
      .delete(
        `/client/${this.client_ID}/action-items/${this.selectedCard?.id}`,
        {},
      )
      .subscribe(() => {
        this.toastr?.success('Action item successfully deleted');
        this.getAllActionItem();
        this.closeAddCourseModal();
        this.closeModal();
      });
  }

  closeModal() {
    this.deleteExam = false;
    this.selectedCard = null;
  }
}

