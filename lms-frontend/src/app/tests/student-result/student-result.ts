import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { HeaderComponent } from '../../shared/header.component';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../../pagination/pagination';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';

@Component({
  selector: 'app-student-result',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    FormsModule,
    PaginationComponent,
    NgxSkeletonLoaderComponent,
  ],
  templateUrl: './student-result.html',
  styleUrl: './student-result.scss',
})
export class StudentResult implements OnInit {
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  totalRecords = 0;
  clientId: string = '';
  pageSizeOptions = [10, 20, 50, 100];
  results = signal<any[]>([]);
  searchKey = signal<string>('');
  isLoading = signal<boolean>(false);
  private str = inject(StorageService);
  private http = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);

  filteredResults = computed(() => {
    let data = this.results();

    const search = this.searchKey().trim();

    if (search) {
      const searchNumber = Number(search);

      data = data.filter((item) => {
        const studentName = (item?.studentName || '').toLowerCase();
        const status = (item?.status || '').toLowerCase();
        const review_status = (item?.review_status || '').toLowerCase();
        const exam_date = new Date(item?.exam_date)
          .toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          .toLowerCase();
        const testName = (
          item?.test_name ||
          item?.exam_name ||
          ''
        ).toLowerCase();

        const isMarksMatch =
          !isNaN(searchNumber) && item?.achieved_marks === searchNumber;

        return (
          studentName?.includes(search?.toLowerCase()) ||
          review_status?.includes(search?.toLowerCase()) ||
          status?.includes(search?.toLowerCase()) ||
          testName?.includes(search?.toLowerCase()) ||
          exam_date?.includes(search?.toLowerCase()) ||
          isMarksMatch
        );
      });
    }

    return data;
  });

  headers = [
    {
      title: 'STUDENT RESULTS',
      subtitle: '',
    },
  ];

  ngOnInit() {
    this.clientId = this.str.getItem(STORAGEENUMS.CLIENT_ID) || '';
    if (this.clientId) {
      this.getAllResults();
    }
  }

  studentCount = computed(() => {
    return `View results of ${this.filteredResults().length} students`;
  });

  getAllResults() {
    this.isLoading.set(true);

    const search = this.searchKey();

    this.http
      .getCourse(
        `/get-all-results?page=${this.currentPage}&limit=${this.pageSize}&search=${search}`,
      )
      .subscribe({
        next: (res: any) => {
          this.results.set(res?.data || []);

          if (res?.pagination) {
            this.currentPage = res.pagination.current_page;
            this.totalPages = res.pagination.total_pages;
            this.pageSize = res.pagination.records_per_page;
            this.totalRecords = Number(res.pagination.total_records);
          }

          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.results.set([]);
        },
      });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;

    this.currentPage = page;
    this.getAllResults();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;

    this.getAllResults();
  }
}
