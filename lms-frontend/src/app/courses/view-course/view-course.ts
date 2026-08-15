import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CommonHttpService } from '../../services/common-http.service';
import { DomSanitizer } from '@angular/platform-browser';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { AddLesson } from "../add-lesson/add-lesson";
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-view-course',
  imports: [CommonModule, AddLesson],
  providers: [StorageService],
  templateUrl: './view-course.html',
  styleUrl: './view-course.scss',
})
export class ViewCourse {
  showLessonModal = false;
  showModal = false;
  courses: any[] = [];
  course = signal<any>({});
  lessons = signal<any>({});
  isLoading = signal(false);
  showAddCourseModal = false;
  public router = inject(Router);
  private currentCourseId: string = '';
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  private getListQueryParams() {
    const qp = this.route?.snapshot?.queryParamMap;
    const page = qp?.get('page');
    const limit = qp?.get('limit');
    return {
      ...(page ? { page } : {}),
      ...(limit ? { limit } : {}),
    } as { page?: string; limit?: string };
  }
 
  ngOnInit() {
    this.route?.params?.subscribe((params: any) => {
      const courseId = params['id'];
      if (!courseId) {
        return;
      }
      this.currentCourseId = courseId;
      this.getCourseById(courseId);
    });
  }

  getCourseById(courseId: any) {
    this.isLoading?.set(true);
    this.commonHttp
      .getCourse(`/course/${courseId}`)
      .subscribe({
        next: (response: any) => {
          const courseData = response?.data;
          this.course?.set({
            ...courseData?.course,
            lessons: courseData?.lessons || [],
          });
          this.isLoading?.set(false);
        },
        error: () => {
          this.isLoading?.set(false);
        },
      });
  }

  onRefreshCourse() {
    if (this.currentCourseId) {
      this.getCourseById(this.currentCourseId);
    }
  }

  goToLessonsByCourseId() {
    const id = this.course()?.id;
    if (id) {
      this.router.navigate([this.workspaceNav.getCourseViewSectionRoute(id)], {
        queryParams: { courseId: id },
      });
    }
  }

  goToBack() {
    this.router.navigate([this.workspaceNav.getCourseListRoute()], {
      queryParams: this.getListQueryParams(),
    });
  }

  closeAddCourseModal() {
    this.showAddCourseModal = false;
  }

  goToCoursesList() {
    this.router?.navigate([this.workspaceNav.getCourseListRoute()], {
      queryParams: this.getListQueryParams(),
    });
  }

  toggleCourse(i: number) {
    this.courses[i].expanded = !this.courses[i]?.expanded;
  }

  gotoLessons() {
    this.router?.navigate(['/lessons']);
  }

  getSafeVideoUrl(url: string) {
    if (url?.includes('youtube.com/watch?v=')) {
      const videoId = url?.split('v=')[1]?.split('&')[0];
      if (videoId) {
        url = `https://www.youtube.com/embed/${videoId}`;
      }
    }
    return this.sanitizer?.bypassSecurityTrustResourceUrl(url);
  }

  getContent(lesson: any, type: 'VIDEO' | 'IMAGE' | 'PDF' | 'TEXT'): string[] {
    const items = (lesson?.content_type ?? []) as Array<{
      type?: string;
      value?: string;
    }>;
    return items
      ?.filter((item) => item?.type === type)
      ?.map((item) => item?.value || '')
      ?.filter((urlOrHtml) => !!urlOrHtml);
  }

  getFirstContentValue(
    lesson: any,
    type: 'VIDEO' | 'IMAGE' | 'PDF' | 'TEXT',
  ): string | null {
    const all = this?.getContent(lesson, type);
    return all?.length ? all[0] : null;
  }
}
