import { CommonModule } from '@angular/common';
import { STORAGEENUMS } from '../../shared/enum';
import { Component, inject, signal, computed } from '@angular/core';
import { StorageService } from '../../services/storage-service';
import { HeaderComponent } from '../../shared/header.component';
import { CommonHttpService } from '../../services/common-http.service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { PaginationComponent } from '../../pagination/pagination';

@Component({
  selector: 'app-test-result',
  imports: [CommonModule,HeaderComponent,NgxSkeletonLoaderComponent,PaginationComponent,],
  templateUrl: './test-result.html',
  styleUrl: './test-result.scss',
})
export class TestResult {
  user_Id = '';
  student = signal('');
  studentResult = signal<any[]>([]);
  isLoadingResults = signal(true);

  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  totalRecords = 0;
  pageSizeOptions = [10, 20, 30, 40, 50];
  isServerSidePagination = signal(false);

  paginatedResult = computed(() => {
    const data = this.studentResult();
    if (this.isServerSidePagination()) {
      return data;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return data.slice(startIndex, endIndex);
  });

  private str = inject(StorageService);
  private http = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);
  
  ngOnInit() {
    this.user_Id = this.str.getItem(STORAGEENUMS.USER_ID) || '';
    this.getStudentData();
  }

  getStudentData() {
    this.isLoadingResults.set(true);
    this.http
      .getCourse(
        `/get-student-results/${this.user_Id}?page=${this.currentPage}&limit=${this.pageSize}`,
      )
      .subscribe((res: any) => {
        this.isLoadingResults.set(false);
        this.studentResult?.set(res?.data || []);
        this.student?.set(res?.studentName?.name);

        const pagination = res?.pagination ?? res?.data?.pagination;
        if (pagination) {
          this.isServerSidePagination.set(true);
          this.totalPages =
            pagination.total_pages || pagination.totalPages || 1;
          this.totalRecords = pagination.total_records || pagination.total || 0;
        } else {
          this.isServerSidePagination.set(false);
          this.totalRecords = (res?.data || []).length;
          this.totalPages = Math.ceil(this.totalRecords / this.pageSize) || 1;
        }
      });
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.getStudentData();
    }
  }

  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.getStudentData();
  }
}
