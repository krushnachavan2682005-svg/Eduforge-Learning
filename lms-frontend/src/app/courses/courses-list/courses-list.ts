import { CommonHttpService, CursorPaginationParams } from './../../services/common-http.service';
import { ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AddCourses } from '../add-courses/add-courses';
import { signal } from '@angular/core';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { Tooltip } from '../../shared/tooltip';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { AssginCourse } from '../assgin-course/assgin-course';
import { SidebarService } from '../../services/sidebar.service';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

import { PaginationComponent, PaginationMetadata } from '../../pagination/pagination';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [
    CommonModule,
    AddCourses,
    Tooltip,
    NgxSkeletonLoaderModule,
    AssginCourse,    PaginationComponent,
  ],
  providers: [StorageService],
  templateUrl: './courses-list.html',
  styleUrl: './courses-list.scss',
})
export class CoursesList {
  pageSize = 10;
  cursor: string | undefined = undefined;
  paginationMeta: PaginationMetadata | null = null;
  isDropdownOpen = false;
  openAssignMenubar = false;
  isLoading: boolean = false;
  showAddCourseModal = false;
  courses = signal<any[]>([]);
  pageSizeOptions = [10, 20, 30, 40, 50];

  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public skeletonService = inject(SkeletonTheme);
  private toastr = inject(ToastrService);
  public sidebarService = inject(SidebarService);
  @ViewChild(AddCourses) addCoursesComponent?: AddCourses;
  @ViewChild(PaginationComponent) paginationRef?: PaginationComponent;

  ngOnInit() {
    this.PageLimit();
    this.getCourses();
  }

  PageLimit() {
    const qp = this.route?.snapshot?.queryParamMap;
    const qpLimit = Number(qp?.get('limit'));
    const qpCursor = qp?.get('cursor');
    
    if (!Number.isNaN(qpLimit) && qpLimit > 0) {
      this.pageSize = qpLimit;
    }
    if (qpCursor) {
      this.cursor = qpCursor;
    }
  }

  headers = [
    {
      title: 'Courses',
      subtitle: 'Create, organize, and assign learning content',
    },
  ];

  closeAddCourseModal() {
    this.openAssignMenubar = false;
    this.showAddCourseModal = false;
  }



  goToViewCourse(course: any) {
    if (course?.id) {
      this.router?.navigate([this.workspaceNav.getCourseDetailRoute(course?.id)], {
        queryParams: { limit: this.pageSize, cursor: this.cursor || null },
      });
    }
  }

  editCourse(course: any, event: Event) {
    event?.stopPropagation();

    if (course?.id) {
      // Prefer in-place sidebar edit without routing away
      if (this.addCoursesComponent?.startEdit) {
        this.addCoursesComponent?.startEdit(course?.id);
      } else {
        // Fallback to routing if child component reference is not available
        this.router?.navigate([this.workspaceNav.getCourseCreateRoute()], {
          queryParams: { edit: course.id },
        });
      }
    }
  }
  onCourseAdded() {
    this.getCourses();
  }

  deleteCourse(course: any) {
    this.commonHttp
      .delete(`/courses/${course?.id}`, {})
      .subscribe({
        next: () => {
          this.toastr?.success('Course deleted successfully');
          this.getCourses();
        },
        error: () => this.toastr.error('Failed to delete Course'),
      });
  }

  getCourses() {
    this.isLoading = true;
    const params: CursorPaginationParams = {
      limit: this.pageSize,
    };
    if (this.cursor) {
      params.cursor = this.cursor;
    }

    this.commonHttp
      .getCoursesList(params)
      .subscribe((response: any) => {
        // Use 'items' for the array, fallback to 'courses' if needed
        const coursesArray =
          response?.items ?? response?.data?.items ?? response?.data?.courses;
        this.courses?.set(coursesArray ?? []);
        this.isLoading = false;

        this.paginationMeta = response?.pagination ?? response?.data?.pagination ?? null;

        this.cdr?.detectChanges();
      });
  }

  coursesList() {
    return this.courses();
  }

  onCursorChange(cursor: string | undefined) {
    this.cursor = cursor;
    this.getCourses();
    this.router?.navigate([], {
      relativeTo: this.route,
      queryParams: { limit: this.pageSize, cursor: this.cursor || null },
      queryParamsHandling: 'merge',
    });
  }

  onPageSizeChange(newSize: number) {
    this.pageSize = newSize;
    if (this.paginationRef) {
      this.paginationRef.resetCursor();
    } else {
      this.cursor = undefined;
      this.getCourses();
      this.router?.navigate([], {
        relativeTo: this.route,
        queryParams: { limit: this.pageSize, cursor: null },
        queryParamsHandling: 'merge',
      });
    }
  }
}


