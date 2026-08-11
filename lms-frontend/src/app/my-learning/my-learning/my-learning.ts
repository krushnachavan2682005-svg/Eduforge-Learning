import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonHttpService } from '../../services/common-http.service';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Tooltip } from '../../shared/tooltip';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { ToastrService } from 'ngx-toastr';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

export interface Task {
  name: string;
  score: number;
}
export interface Level {
  course: string;
  var: string;
  score: number;
  expanded: boolean;
  tasks: Task[];
  level: string;
  status: string;
}
@Component({
  selector: 'app-my-learning',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    Tooltip,
    NgxSkeletonLoaderComponent,  ],
  providers: [StorageService],
  templateUrl: './my-learning.html',
  styleUrls: ['./my-learning.scss'],
})
export class MyLearning {
  limit = 10;
  user_id: any;
  clientId: any;
  userPage = signal(1);
  isSidebarOpen = false;
  coursePage = signal(1);
  SelectData: any = null;
  assignForm!: FormGroup;
  currentPage = signal(1);
  searchQuery = signal('');
  selectedUsers: any[] = [];
  isLoading = signal(false);
  SelectUserData: any = null;
  selectedCourses: any[] = [];
  courses = signal<any[]>([]);
  hasMoreUsers = signal(true);
  isAssigning = signal(false);
  searchUserQuery = signal('');
  hasMoreCourses = signal(true);
  coursesLoaded = signal(false);
  isLoadingUsers = signal(false);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  isLoadingCourses = signal(false);
  assignCourses = signal<any[]>([]);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public skeletonService = inject(SkeletonTheme);
  usersList = signal<{ id: string; name: string }[]>([]);

  headers = [
    {
      title: 'MY LEARNING',
      subtitle: '',
    },
  ];

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this?.getAssignCourses();
    this.assignForm = this.fb?.group({
      selectedUser: [null, Validators.required],
      selectedCourse: [null, Validators.required],
    });
  }



  navigateTOCources(course: any) {
    if (course?.course_id) {
      this.router?.navigate([this.workspaceNav.getStudentCourseRoute(course?.course_id)]);
    }
  }

  isTruncated(el: HTMLElement): boolean {
    if (!el) return false;
    return el?.scrollWidth > el?.clientWidth;
  }

  getPresignedUrl(course: any, index: number) {
    this.commonHttp
      .postCourse('/presigned-url', { key: course.thumbnail_url })
      .subscribe({
        next: (res: any) => {
          const updatedCourses = [...this.assignCourses()];
          updatedCourses[index] = {
            ...updatedCourses[index],
            signedUrl: res?.data,
          };
          this.assignCourses?.set(updatedCourses);
        },
        error: () => {
          this.toastr.error('Failed to load course thumbnail');
        },
      });
  }

  getAssignCourses() {
    this.isLoadingCourses?.set(true);
    this.coursesLoaded?.set(false);

    this.commonHttp
      .getCourse(
        `/get-assigned-course-byuser/${this.user_id}`,
      )
      .subscribe({
        next: (res: any) => {
          const coursesData = res?.data || [];
          if (coursesData?.length === 0) {
            this.getCourses();
          }

          this.assignCourses?.set(coursesData);
          this.headers[0].subtitle = `YOUR LEARNING DASHBOARD | ${coursesData?.length} COURSES`;
          this.isLoadingCourses?.set(false);
          this.coursesLoaded?.set(true);
          coursesData.forEach((course: any, index: number) => {
            if (course?.thumbnail_url) {
              this.getPresignedUrl(course, index);
            }
          });
        },
        error: (err) => {
          if (err?.status === 0 || err?.statusText === 'Unknown Error') {
            this.isLoadingCourses?.set(true);
            this.coursesLoaded?.set(false);
          } else {
            this.isLoadingCourses?.set(false);
            this.coursesLoaded?.set(true);
          }
        },
      });
  }

  getCourses() {
    if (!this.hasMoreCourses()) return;
    this.isLoading?.set(true);
    this.commonHttp
      .getCourse(
        `/all-courses?limit=1000`,
      )
      .subscribe((res: any) => {
        this.assignCourses?.set(res?.items || []);
        this.isLoading?.set(false);
        this.assignCourses()?.forEach((course: any, index: number) => {
          if (course?.thumbnail_url) {
            this.getPresignedUrl(course, index);
          }
        });
      });
  }

  getCourseTitle(id: number): string {
    const course = this?.courses()?.find((c) => c?.id === id);
    return course ? course?.title : 'Unknown';
  }
}

