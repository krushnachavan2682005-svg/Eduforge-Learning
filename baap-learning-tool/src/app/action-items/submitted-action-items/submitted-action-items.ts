import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { STORAGEENUMS } from '../../shared/enum';
import { Component, inject, signal } from '@angular/core';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { SidebarService } from '../../services/sidebar.service';
import { StorageService } from '../../services/storage-service';
import { HeaderComponent } from '../../shared/header.component';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { CommonHttpService } from '../../services/common-http.service';
import { PaginationComponent } from '../../pagination/pagination';
import { Router } from '@angular/router';

@Component({
  selector: 'app-submitted-action-items',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    HeaderComponent,
    NgxSkeletonLoaderComponent,
    PaginationComponent,
  ],
  templateUrl: './submitted-action-items.html',
  styleUrl: './submitted-action-items.scss',
})
export class SubmittedActionItems {
  user_id = '';
  clientId = '';
  isCollapsed = false;
  selectedItem: any = null;
  isLoadingAction = signal(false);
  actionItemsLoaded = signal(false);
  ActionItemList = signal<any[]>([]);
  isLoadingActionItems = signal(false);
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  isDropdownOpen = false;
  pageSizeOptions = [10, 20, 30, 40, 50];
  selectedItemForAttachments: any = null;
  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private http = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);
  public sidebarService = inject(SidebarService);

  headers = [
    {
      title: 'SUBMITTED ACTION ITEMS',
      subtitle: 'REVIEW STUDENT SUBMISSIONS',
    },
  ];

  ngOnInit() {
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.getAllActionItems();
  }

  getAllActionItems() {
    if (!this.clientId) return;
    this.actionItemsLoaded?.set(false);
    this.isLoadingActionItems?.set(true);
    this.http
      .getCourse(
        `/client/${this.clientId}/reviewer-action-items/${this.user_id}?page=${this.currentPage}&limit=${this.pageSize}`,
      )
      .subscribe({
        next: (res: any) => {
          const allItems = res?.data || [];
          let displayItems = allItems;
          
          if (Array.isArray(allItems)) {
            allItems.forEach((item: any) => {
              item.isCollapsed = false;
            });
            this.totalPages = Math.ceil(allItems.length / this.pageSize) || 1;
            
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            displayItems = allItems.slice(startIndex, endIndex);
          } else {
            this.totalPages = res?.data?.pagination?.totalPages || 1;
          }
          
          this.ActionItemList?.set(displayItems);
          const totalLength = Array.isArray(allItems) ? allItems.length : displayItems?.length || 0;
          this.headers[0].subtitle = `YOU HAVE | ${totalLength} ACTION ITEMS TO REVIEW`;
          this.actionItemsLoaded?.set(true);
          this.isLoadingActionItems?.set(false);
          displayItems?.forEach((action: any) => {
            action.student_assignments?.forEach((sa: any) => {
              const attachmentKeys = (sa?.attachment || [])?.filter(
                (k: any) => typeof k === 'string' && k?.trim().length > 0,
              );

              if (attachmentKeys.length > 0) {
                this.getPresignedUrlsForStudent(sa, attachmentKeys);
              }
            });
          });
        },
        error: (err) => {
          console?.error('Error loading action items:', err);
          this.toastr?.error('Error loading action items');
          this.isLoadingActionItems?.set(false);
          this.actionItemsLoaded?.set(true);
        },
      });
  }

  getPresignedUrlsForStudent(studA: any, keys: string[]) {
    const requests = keys.map((key) =>
      this.http.postCourse('/presigned-url', { key }),
    );

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        studA.signedUrls = responses.map((r) => r?.data).filter(Boolean);
      },
      error: () => {
        this.toastr.error('Failed to load action attachments');
      },
    });
  }

  toggleItem(item: any) {
    this.router.navigate(['/action-items/view-student-submissions', item.id], {
      state: { assignment: item },
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.getAllActionItems();
    }
  }

  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.isDropdownOpen = false;
    this.getAllActionItems();
  }
}
