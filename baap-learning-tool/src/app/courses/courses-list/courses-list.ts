import { CommonHttpService } from './../../services/common-http.service';
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
import { HeaderComponent } from "../../shared/header.component";
import { SidebarService } from '../../services/sidebar.service';

import { PaginationComponent } from '../../pagination/pagination';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [
    CommonModule,
    AddCourses,
    Tooltip,
    NgxSkeletonLoaderModule,
    AssginCourse,
    HeaderComponent,
    PaginationComponent,
  ],
  providers: [StorageService],
  templateUrl: './courses-list.html',
  styleUrl: './courses-list.scss',
})
export class CoursesList {
  pageSize = 10;
  clientId = '';
  totalPages = 1;
  currentPage = 1;
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
  public skeletonService = inject(SkeletonTheme);
  private toastr = inject(ToastrService);
  public sidebarService = inject(SidebarService);
  @ViewChild(AddCourses) addCoursesComponent?: AddCourses;

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.PageLimit();
    this.getCourses(this.currentPage);
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

  headers = [
    {
      title: 'COURSES LIST',
      subtitle: 'MANAGE AND EXPLORE ALL YOUR COURSES HERE',
    },
  ];

  closeAddCourseModal() {
    this.openAssignMenubar = false;
    this.showAddCourseModal = false;
  }



  goToViewCourse(course: any) {
    if (course?.id) {
      this.router?.navigate(['/courses/view-course', course?.id], {
        queryParams: { page: this.currentPage, limit: this.pageSize },
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
        this.router?.navigate(['/courses/add-courses'], {
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
      .delete(`/client/${this.clientId}/courses/${course?.id}`, {})
      .subscribe({
        next: () => {
          this.toastr?.success('Course deleted successfully');
          this.getCourses();
        },
        error: () => this.toastr.error('Failed to delete Course'),
      });
  }

  getCourses(page: number = this.currentPage) {
    this.isLoading = true;
    this.commonHttp
      .getCourse(
        `/client/${this.clientId}/all-courses?page=${page}&limit=${this.pageSize}`,
      )
      .subscribe((response: any) => {
        // Use 'items' for the array, fallback to 'courses' if needed
        const coursesArray =
          response?.items ?? response?.data?.items ?? response?.data?.courses;
        this.courses?.set(coursesArray ?? []);
        this.isLoading = false;

        // Use totalPages from pagination if available
        const pagination = response?.pagination ?? response?.data?.pagination;
        if (pagination && pagination?.totalPages) {
          this.totalPages = pagination?.totalPages;
        } else if (pagination && pagination?.total && pagination?.limit) {
          this.totalPages = Math?.ceil(pagination?.total / pagination?.limit);
        } else {
          this.totalPages = 1;
        }

        this.cdr?.detectChanges();
      });
  }

  coursesList() {
    return this.courses();
  }

  goToPage(page: number) {
    if (page >= 1) {
      this.currentPage = page;
      this.getCourses(page);
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
    this.getCourses(1);
    this.router?.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.currentPage, limit: this.pageSize },
      queryParamsHandling: 'merge',
    });
  }
}
