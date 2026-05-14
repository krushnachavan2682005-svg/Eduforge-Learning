import { Component, computed, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/header.component';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage-service';
import { CommonHttpService } from '../../services/common-http.service';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { STORAGEENUMS } from '../../shared/enum';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { CommonModule } from '@angular/common';
import { Tooltip } from '../../shared/tooltip';
import { FormsModule } from '@angular/forms';
import { PaginationComponent } from '../../pagination/pagination';

@Component({
  selector: 'app-review-list',
  imports: [
    CommonModule,
    NgxSkeletonLoaderComponent,
    HeaderComponent,
    Tooltip,
    FormsModule,
    PaginationComponent,
  ],
  templateUrl: './review-list.html',
  styleUrl: './review-list.scss',
})
export class ReviewList {
  user_id = '';
  clientId = '';
  examId: string = '';
  isCollapsed = false;
  testsLoaded = signal(false);
  TestList = signal<any[]>([]);
  searchKey = signal<string>('');
  isLoadingExams = signal(false);
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  pageSizeOptions = [10, 20, 30, 40, 50];

  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private http = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);
  headers = [
    {
      title: 'TEST REVIEWS',
      subtitle: 'ASSESSMENT SUMMARY & KEY OBSERVATIONS',
    },
  ];

  ngOnInit() {
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.route?.params?.subscribe((params: any) => {
      this.examId = params['id'];
    });
    this.getAllExams();
  }

  getAllExams() {
    this.testsLoaded?.set(false);
    this.isLoadingExams?.set(true);
    this.http
      .getCourse(`/client/${this.clientId}/reviewer-dashboard/${this.user_id}`,)
      .subscribe({
        next: (response) => {
          if (response?.success) {
            const data = response?.data?.items || response?.data || [];
            data.forEach((element: any) => {
              element.isCollapsed = true;
            });
            this.TestList?.set(data);
            this.headers[0].subtitle = `YOU HAVE | ${data.length} TESTS TO REVIEW`;
          } else {
            this.toastr?.error('Failed to load reviewer exams');
          }
          this.testsLoaded?.set(true);
          this.isLoadingExams?.set(false);
        },
        error: (err) => {
          this.toastr?.error('No submitted tests found for review.');
          this.isLoadingExams?.set(false);
          this.testsLoaded?.set(true);
        },
      });
  }

  filteredResults = computed(() => {
    const search = this.searchKey().toLowerCase().trim();

    if (!search) {
      return this.TestList();
    }

    return this.TestList().filter((item) => {
      const studentName = (item?.student_name || '').toLowerCase();
      const title = (item?.title || '').toLowerCase();

      const reviewStatus = (item?.review_status || '').toLowerCase();

      const resultStatus =
        item?.review_status?.toLowerCase() === 'completed'
          ? item?.passed === true
            ? 'pass'
            : 'fail'
          : 'pending review';

      return (
        studentName.includes(search) ||
        title.includes(search) ||
        reviewStatus.includes(search) ||
        resultStatus.includes(search)
      );
    });
  });

  get paginatedResults() {
    const results = this.filteredResults();
    this.totalPages = Math.ceil(results.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const startIndex = Math.max(0, (this.currentPage - 1) * this.pageSize);
    return results.slice(startIndex, startIndex + this.pageSize);
  }

  reviewExam(test: any) {
    this.router?.navigate(['/tests/reviewer'], {
      queryParams: {
        examId: test?.exam_id,
        userId: test?.user_id,
        session_id: test?.session_id,
      },
    });
  }
  toggleCard(test: any) {
    test.isCollapsed = !test?.isCollapsed;
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    this.currentPage = 1;
  }
}
