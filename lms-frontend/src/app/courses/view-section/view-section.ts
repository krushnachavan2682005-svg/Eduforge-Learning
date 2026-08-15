import {
  Component,
  inject,
  OnInit,
  Pipe,
  PipeTransform,
  signal,
} from '@angular/core';
import { Modal } from '../../modal/modal';
import { combineLatest } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  SafeHtml,
  DomSanitizer,
  SafeResourceUrl,
} from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { ToastrService } from 'ngx-toastr';
import { STORAGEENUMS } from '../../shared/enum';
import { Tooltip } from '../../shared/tooltip';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    return this.sanitizer?.bypassSecurityTrustResourceUrl(url);
  }
}

@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

@Component({
  selector: 'app-view-section',
  imports: [
    Modal,
    Tooltip,
    SafeUrlPipe,
    CommonModule,
    CommonModule,
    SafeHtmlPipe,
    FormsModule,
  ],
  templateUrl: './view-section.html',
  styleUrl: './view-section.scss',
})
export class ViewSection implements OnInit {
  [x: string]: any;
  lessonId: string = '';
  courseId: string = '';
  showDeleteModal = false;
  lesson = signal<any>(null);
  isLoading = signal<boolean>(true);
  sectionToDelete: any = null;

  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);

  ngOnInit() {
    combineLatest([this.route.params, this.route.queryParams]).subscribe(
      ([params, queryParams]) => {
        this.lessonId = params['id'];
        this.courseId = queryParams['courseId'];
        if (this.lessonId && this.courseId) {
          this.fetchLessonDetails();
        } else if (this.lessonId && !this.courseId) {
          this.toastr.error('Course ID missing');
          this.isLoading?.set(false);
        }
      },
    );
  }

  getPresignedUrl(content: any) {
    this.commonHttp
      .postCourse('/presigned-url', { key: content?.url })
      .subscribe({
        next: (res: any) => {
          content.signedUrl = res?.data;
        },
        error: () => {
          this.toastr.error('File load failed');
        },
      });
  }

  fetchLessonDetails() {
    this.isLoading?.set(true);
    if (this.courseId) {
      this.commonHttp
        .getCourse(`/course/${this.courseId}`)
        .subscribe({
          next: (res: any) => {
            const lessons = res?.data?.lessons || [];
            const foundLesson = lessons?.find(
              (l: any) => l.id === this.lessonId,
            );
            if (foundLesson) {
              const processedLesson = { ...foundLesson };
              if (
                processedLesson.sections &&
                (!processedLesson.lessons || !processedLesson?.lessons?.length)
              ) {
                processedLesson.lessons = processedLesson?.sections || [];
              }
              if (processedLesson.lessons) {
                processedLesson.lessons = processedLesson?.lessons?.map(
                  (section: any) => {
                    if (section?.content_type?.length) {
                      const processedContentType = section?.content_type?.map(
                        (content: any) => {
                          if (content?.url) {
                            this.getPresignedUrl(content);
                          }

                          return content;
                        },
                      );

                      if (processedContentType?.length) {
                        section.content_type = processedContentType.sort(
                          (a: any, b: any) => {
                            return (a.sequence || 0) - (b.sequence || 0);
                          },
                        );
                      }
                    }

                    return {
                      ...section,
                      isExpanded: false,
                    };
                  },
                );
              }
              this.lesson?.set(processedLesson);
            } else {
              this.toastr.error('Lesson not found');
            }
            this.isLoading.set(false);
          },
          error: (err) => {
            this.toastr.error('Failed to load lesson details');
            this.isLoading.set(false);
          },
        });
    } else {
      this.isLoading.set(false);
      this.toastr.error('Course ID missing');
    }
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

  addSection() {
    const currentLesson = this.lesson();
    if (currentLesson && currentLesson?.id) {
      const navigationPath = [this.workspaceNav.getCourseAddSectionRoute(currentLesson?.id)];
      const queryParams = {
        courseId: this.courseId,
        lessonId: currentLesson?.id,
      };
      this.router.navigate(navigationPath, { queryParams });
    }
  }

  editSection(section: any) {
    if (section && section?.id) {
      const navigationPath = [this.workspaceNav.getCourseAddSectionRoute(section?.id)];
      const queryParams = {
        courseId: this.courseId,
        lessonId: section?.lessons_id,
        editMode: true,
      };
      this.router.navigate(navigationPath, { queryParams });
    } else {
      this.toastr.error('Section ID is missing');
    }
  }

  deleteSection(section: any) {
    this.sectionToDelete = section;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (this.sectionToDelete && this.sectionToDelete.id) {
      this.commonHttp
        .delete(`/section/${this.sectionToDelete.id}`, {
          course_id: this.courseId,
        })
        .subscribe({
          next: () => {
            this.toastr.success('Section deleted successfully');
            const currentLesson = this.lesson();
            if (currentLesson) {
              const updatedSections =
                currentLesson?.lessons?.filter(
                  (s: any) => s.id !== this.sectionToDelete.id,
                ) || [];
              this.lesson?.set({ ...currentLesson, lessons: updatedSections });
            }
            this.cancelDelete();
          },
          error: () => {
            this.toastr.error('Failed to delete section');
            this.cancelDelete();
          },
        });
    }
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.sectionToDelete = null;
  }

  toggleSection(selectedSection: any) {
    this.lesson()?.lessons?.forEach((section: any) => {
      if (section !== selectedSection) {
        section.isExpanded = false;
      }
    });
    selectedSection.isExpanded = !selectedSection?.isExpanded;
  }

  goBack() {
    this.router.navigate([this.workspaceNav.getCourseDetailRoute(this.courseId)]);
  }
}
