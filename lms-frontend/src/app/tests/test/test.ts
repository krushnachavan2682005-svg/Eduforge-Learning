import { PermissionDirective } from '../../services/permission-directive';
import { CommonHttpService, CursorPaginationParams } from '../../services/common-http.service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { StorageService } from '../../services/storage-service';
import { HeaderComponent } from '../../shared/header.component';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { Component, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AssignTest } from '../assign-test/assign-test';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonModule } from '@angular/common';
import { Tooltip } from '../../shared/tooltip';
import { Modal } from '../../modal/modal';
import { IndividualConfig, ToastrService } from 'ngx-toastr';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-test',
  imports: [
    Modal,
    Tooltip,
    AssignTest,
    CommonModule,
    HeaderComponent,
    PermissionDirective,
    NgxSkeletonLoaderComponent,
  ],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test {
  user_id = '';

  showModal = false;
  examId: string = '';
  isCollapsed = false;
  selectedTest: any = null;
  totalRecords: number = 0;
  showAddCourseModal = false;
  deleteExam: boolean = false;
  testsLoaded = signal(false);
  TestList = signal<any[]>([]);
  isLoadingCourses = signal(false);
  pageSize = 10;
  cursor: string | null = null;
  paginationMeta: any = null;

  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private http = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public skeletonService = inject(SkeletonTheme);

  headers = [
    {
      title: 'MY CREATED TESTS',
      subtitle: '',
    },
  ];
  toastOptions: Partial<IndividualConfig<any>> | undefined;
  ngOnInit() {
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';

    this.route?.params?.subscribe((params: any) => {
      this.examId = params['id'];
    });
    this.getAllExams();
  }

  getAllExams(isLoadMore = false) {
    if (!isLoadMore) {
      this.cursor = null;
      this.testsLoaded?.set(false);
      this.isLoadingCourses?.set(true);
    }
    const params: CursorPaginationParams = {
      limit: this.pageSize,
      user_id: this.user_id,
    };
    if (this.cursor) {
      params.cursor = this.cursor;
    }

    this.http
      .getExamsList(params)
      .subscribe((response) => {
        const tests =
          response?.data?.items?.map((test: any) => ({
            ...test,
            isCollapsed: true,
          })) ||
          response?.data?.map((test: any) => ({
            ...test,
            isCollapsed: true,
          })) ||
          [];

        this.paginationMeta = response?.pagination ?? response?.data?.pagination ?? null;
        const total = this.paginationMeta?.total ?? response?.data?.totalItems ?? response?.totalItems ?? response?.data?.total ?? response?.total ?? tests.length;

        if (isLoadMore) {
          this.TestList.update(list => [...list, ...tests]);
        } else {
          this.TestList?.set(tests);
        }
        
        this.headers[0].subtitle = `YOU HAVE | ${total} TESTS TO CHECK`;
        this.testsLoaded?.set(true);
        this.isLoadingCourses?.set(false);

        // Fetch detailed test object to access missing properties like 'type' and 'questions'
        tests.forEach((t: any) => {
          this.http.getCourse(`/exam/${t.id}`).subscribe({
            next: (res: any) => {
              const data = res?.data || res;
              if (data) {
                this.TestList.update(list =>
                  list.map(item =>
                    item.id === t.id ? { ...item, type: data.type, questions: data.questions } : item
                  )
                );
              }
            },
            error: () => { }
          });
        });
      });
  }

  loadMore() {
    if (this.paginationMeta?.next_cursor) {
      this.cursor = this.paginationMeta.next_cursor;
      this.getAllExams(true);
    }
  }

  deleteTest(examId: string) {
    this.http
      .delete(`/exam/${examId}`, {})
      .subscribe(() => {
        this.toastr?.success('Test successfully deleted');
        this.getAllExams();
        this.closeModal();
      });
  }

  toggleCard(selectedTest: any) {
    this.TestList.update((list) =>
      list.map((test: any) => ({
        ...test,
        isCollapsed: test === selectedTest ? !test.isCollapsed : true,
      })),
    );
  }

  onDeleteClick(test: any) {
    this.selectedTest = test;
    this.deleteExam = true;
  }

  closeAddCourseModal() {
    this.showAddCourseModal = false;
  }
  closeModal() {
    this.showModal = false;
    this.deleteExam = false;
  }

  editTest(examId: string) {
    this.router?.navigate([this.workspaceNav.getTestCreateRoute()], {
      queryParams: { id: examId },
    });
  }
  goToAddNewTest() {
    this.router?.navigate([this.workspaceNav.getTestCreateRoute()]);
  }

  goToAssignTest() {
    this.router?.navigate([this.workspaceNav.getTestAssignRoute()]);
  }

  goToReviews() {
    this.router?.navigate([this.workspaceNav.getReviewListRoute()]);
  }

  isExamExpired(test: any): boolean {
    if (!test?.exam_date) return false;
    const examDate = new Date(test?.exam_date);
    const today = new Date();
    const examDateOnly = new Date(
      examDate?.getFullYear(),
      examDate?.getMonth(),
      examDate?.getDate(),
    );
    const todayOnly = new Date(
      today?.getFullYear(),
      today?.getMonth(),
      today?.getDate(),
    );
    return examDateOnly?.getTime() < todayOnly?.getTime();
  }

  isExamFuture(test: any): boolean {
    if (!test?.exam_date) return false;
    const examDate = new Date(test?.exam_date);
    const today = new Date();
    const examDateOnly = new Date(
      examDate?.getFullYear(),
      examDate?.getMonth(),
      examDate?.getDate(),
    );
    const todayOnly = new Date(
      today?.getFullYear(),
      today?.getMonth(),
      today?.getDate(),
    );
    return examDateOnly?.getTime() > todayOnly?.getTime();
  }

  getExamTime(test: any): string {
    if (!test?.exam_start_time) return 'N/A';

    const date = new Date(
      typeof test.exam_start_time === 'string' &&
        /^\d{2}:\d{2}$/.test(test.exam_start_time)
        ? `1970-01-01T${test.exam_start_time}`
        : test.exam_start_time,
    );

    if (isNaN(date.getTime())) return test.exam_start_time;

    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';

    return `${h % 12 || 12}:${m} ${period}`;
  }

  isAllMcq(test: any): boolean {
    if (test?.type && (test.type === 'mcq' || test.type === 'MCQ' || test.type.toLowerCase() === 'mcq')) {
      return true;
    }
    if (test?.questions && Array.isArray(test.questions) && test.questions.length > 0) {
      return test.questions.every((q: any) => q?.type?.toLowerCase() === 'mcq');
    }
    return false;
  }

  generateShareableLink(test: any) {
    if (!this.isAllMcq(test)) {
      this.toastr.warning(
        'The link can only be generated for tests with MCQ questions only.',
        undefined,
        this.toastOptions,
      );
      return;
    }

    if (test?.is_completed === true) {
      this.toastr.warning(
        'This test has submited. The link cannot be copied',
        undefined,
        this.toastOptions,
      );
      return;
    }

    if (this.isExamExpired(test)) {
      this.toastr.warning(
        'This test has expired. The link cannot be copied',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const url = `${window.location.origin}/tests/public-test-start/${test?.id}`;
    navigator.clipboard.writeText(url).then(
      () => {
        this.toastr.success(
          'Link copied to clipboard',
          undefined,
          this.toastOptions,
        );
      },
      (err) => {
        this.toastr.error('Failed to copy link', undefined, this.toastOptions);
        console.error('Could not copy text: ', err);
      },
    );
  }
}

