import { Component, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/header.component';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage-service';
import { CommonHttpService } from '../../services/common-http.service';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { STORAGEENUMS } from '../../shared/enum';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { CommonModule } from '@angular/common';
import { Modal } from '../../modal/modal';
import { Tooltip } from '../../shared/tooltip';
import { PaginationComponent } from '../../pagination/pagination';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-my-test',
  imports: [
    CommonModule,
    Modal,
    Tooltip,
    NgxSkeletonLoaderComponent,
    HeaderComponent,
    PaginationComponent,
  ],
  templateUrl: './my-test.html',
  styleUrl: './my-test.scss',
})
export class MyTest {
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
  isLoadingExams = signal(false);
  pageSize = 10;
  totalPages = 1;
  currentPage = 1;
  activeCardId: string | null = null;
  pageSizeOptions = [10, 20, 30, 40, 50];
  private readonly startedKey = 'started_exams';
  private startedExamIds = new Set<string>();

  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private http = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public skeletonService = inject(SkeletonTheme);

  headers = [
    {
      title: 'ASSIGNED TESTS LIST',
      subtitle: '',
    },
  ];
  ngOnInit() {
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.loadStartedExams();
    this.route?.params?.subscribe((params: any) => {
      this.examId = params['id'];
    });
    this.getAssignExams();
  }

  getAssignExams() {
    this.testsLoaded?.set(false);
    this.isLoadingExams?.set(true);
    this.http
      .getCourse(
        `/assigned-exams/${this.user_id}?page=${this.currentPage}&limit=${this.pageSize}`,
      )
      .subscribe((response: any) => {
        if (response?.success) {
          const items =
            response?.data?.items ||
            (Array.isArray(response?.data) ? response?.data : []);
          const data =
            items.map((test: any) => ({
              ...test,
              availability_status: this.getAvailabilityStatus(test),
              isCollapsed: true,
            })) || [];

          const pagination = response?.pagination ?? response?.data?.pagination;
          const total = pagination?.total ?? response?.data?.totalItems ?? response?.totalItems ?? response?.data?.total ?? response?.total ?? data.length;
          if (pagination?.totalPages) {
            this.totalPages = pagination?.totalPages;
          } else if (total) {
            this.totalPages = Math.ceil(total / this.pageSize) || 1;
          } else {
            this.totalPages = 1;
          }

          this.TestList?.set(data);
          this.headers[0].subtitle = `YOU HAVE ASSIGN | ${total} TESTS ASSIGNMENT`;
        } else {
          this.toastr?.error('Failed to load reviewer exams');
        }
        this.testsLoaded?.set(true);
        this.isLoadingExams?.set(false);
      });
  }

  onPublish(event: any, test: any) {
    const isChecked = event?.target?.checked;
    test.publish = isChecked;

    const payload = {
      assignment_id: test?.id,
      assigned_id: test?.test_id,
      user_id: this?.user_id,
      publish: isChecked,
    };

    this.http
      .postCourse(`/assignment/publish`, payload)
      .subscribe({
        next: () => {
          this.toastr?.success(
            isChecked
              ? 'Test published successfully'
              : 'Test unpublished successfully',
          );
          this.getAssignExams();
        },
        error: () => {
          this.toastr?.error('Failed to update publish status');
          test.publish = !isChecked;
        },
      });
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.getAssignExams();
    }
  }

  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.getAssignExams();
  }

  toggleCard(test: any) {
    if (this.activeCardId === test?.id) {
      this.activeCardId = null;
    } else {
      this.activeCardId = test?.id;
    }
  }
  openExamModal(test: any) {
    this.selectedTest = test;
    this.showModal = true;
  }

isStartAllowed(test: any): boolean {
  return this.getAvailabilityStatus(test) === 'available';
}

  closeAddCourseModal() {
    this.showAddCourseModal = false;
  }
  closeModal() {
    this.showModal = false;
    this.deleteExam = false;
  }

  ReviewExam(examId: string) {
    this.router?.navigate([this.workspaceNav.getReviewerRoute(examId)]);
  }
  startExam(examId: string) {
    this.router?.navigate([this.workspaceNav.getTestStartRoute(examId)]);
  }

  isStarted(test: any): boolean {
    return !!test?.id && this.startedExamIds.has(String(test.id));
  }

  private loadStartedExams() {
    try {
      JSON.parse(localStorage.getItem(this.startedKey) || '[]').forEach(
        (id: any) => this.startedExamIds.add(String(id)),
      );
    } catch {}
  }

  private markExamStarted(id: string) {
    if (!id) return;
    this.startedExamIds.add(id);
    try {
      localStorage.setItem(
        this.startedKey,
        JSON.stringify([...this.startedExamIds]),
      );
    } catch {}
  }

  isExamDate(test: any): boolean {
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
    return examDateOnly?.getTime() === todayOnly?.getTime();
  }

  canStartExam(test: any): boolean {
    return this.getAvailabilityStatus(test) === 'available';
  }

  isExamExpired(test: any): boolean {
    return this.getAvailabilityStatus(test) === 'expired';
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

  goToRechack(examId: string) {
    this.router?.navigate([this.workspaceNav.getStudentReviewRoute(examId)]);
  }

  getAvailabilityStatus(test: any): 'submitted' | 'expired' | 'not_started' | 'available' {
    if (test?.is_completed === true || test?.availability_status === 'submitted') return 'submitted';
    if (test?.availability_status === 'expired') return 'expired';
    if (test?.availability_status === 'not_started') return 'not_started';
    if (test?.availability_status === 'available') return 'available';

    const startAt = this.parseStartAt(test);
    const endAt = this.parseEndAt(test, startAt);
    const now = new Date();
    if (startAt && now < startAt) return 'not_started';
    if (endAt && now > endAt) return 'expired';
    return startAt ? 'available' : 'not_started';
  }

  getAvailabilityLabel(test: any): string {
    const status = this.getAvailabilityStatus(test);
    if (status === 'submitted') return 'Submitted';
    if (status === 'expired') return 'Expired';
    if (status === 'not_started') return `Starts ${this.getScheduleDisplay(test)}`;
    return 'Available';
  }

  getScheduleDisplay(test: any): string {
    const startAt = this.parseStartAt(test);
    return startAt ? startAt.toLocaleString() : 'soon';
  }

  private parseStartAt(test: any): Date | null {
    const raw = test?.start_time || test?.exam_start_time;
    if (!raw) return null;
    const direct = new Date(raw);
    if (!isNaN(direct.getTime())) return direct;
    if (test?.exam_date) {
      const date = new Date(test.exam_date).toISOString().split('T')[0];
      const combined = new Date(`${date}T${raw}`);
      if (!isNaN(combined.getTime())) return combined;
    }
    return null;
  }

  private parseEndAt(test: any, startAt: Date | null): Date | null {
    if (test?.end_time) {
      const end = new Date(test.end_time);
      if (!isNaN(end.getTime())) return end;
    }
    const duration = Number(test?.duration_minutes) || 0;
    if (!startAt || duration <= 0) return null;
    return new Date(startAt.getTime() + duration * 60 * 1000);
  }
}
