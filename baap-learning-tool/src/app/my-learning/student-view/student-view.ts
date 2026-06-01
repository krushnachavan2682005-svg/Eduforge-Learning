import { Component, signal, inject, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import {
  DomSanitizer,
  SafeResourceUrl,
  SafeHtml,
} from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { Pipe, PipeTransform } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LessonsMenu } from '../lessons-menu/lessons-menu';
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
  selector: 'app-student-view',
  imports: [CommonModule, LessonsMenu, SafeUrlPipe, SafeHtmlPipe],
  templateUrl: './student-view.html',
  styleUrl: './student-view.scss',
})
export class StudentView {
  @ViewChild(LessonsMenu) lessonsMenu!: LessonsMenu;
  data: any;
  clientId = '';
  isSidebarOpen = true;
  is_completed = false;
  currentQuizIndex = 0;
  courseId: string = '';
  showQuizSection = false;
  course = signal<any>([]);
  sectionId: string | null = null;
  private router = inject(Router);
  courseTitle = signal<string>('');
  lessonTitle = signal<string>('');
  isLoading = signal<boolean>(true);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private sanitizer = inject(DomSanitizer);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  selectedAnswers: { [key: number]: string } = {};
  videoUrls: Map<string, SafeResourceUrl> = new Map();

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.route?.paramMap?.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.courseId = params?.get('id') || '';
    });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.sectionId = params['sectionId'] || null;
      });
  }

  ngOnDestroy() {
    this.destroy$?.next();
    this.destroy$?.complete();
    this.videoUrls?.clear();
  }
  onSectionSelected(section: any) {
    this.data = section;
    this.sectionId = section?.id;
    this.is_completed = !!section?.is_completed;
    this.course?.set(section?.content_type || []);
    this.lessonTitle?.set(section?.title || '');
    this.selectedAnswers = {};
    this.currentQuizIndex = 0;
    if (section?.content_type?.length) {
      section?.content_type?.forEach((content: any) => {
        if (content?.url) {
          this.getPresignedUrl(content);
        }
      });
    }
    if (
      section?.is_completed &&
      section?.user_quiz_answers &&
      Array?.isArray(section?.user_quiz_answers)
    ) {
      section?.user_quiz_answers?.forEach((answer: any) => {
        if (answer?.quiz_no && answer?.answer) {
          const quizIndex = answer?.quiz_no - 1;
          this.selectedAnswers[quizIndex] = answer?.answer;
        }
      });
    }
    this.preprocessVideoUrls();
    this.showQuizSection = false;
    this.isLoading?.set(false);
  }

  onDataLoaded() {
    this.isLoading?.set(false);
  }

  getPresignedUrl(content: any) {
    this.commonHttp
      .postCourse('/presigned-url', { key: content?.url })
      .subscribe({
        next: (res: any) => {
          content.signedUrl = res?.data;
          this.course?.set([...this.course()]);
        },
        error: () => {
          this.toastr.error('File load failed');
        },
      });
  }

  nextQuiz() {
    if (this.currentQuizIndex < (this.data?.quizzes?.length || 0) - 1) {
      this.currentQuizIndex++;
    }
  }

  prevQuiz() {
    if (this.currentQuizIndex > 0) {
      this.currentQuizIndex--;
    }
  }

  preprocessVideoUrls() {
    this.videoUrls?.clear();
    if (this.data?.content_type) {
      this.data?.content_type?.forEach((content: any) => {
        if (content?.type === 'VIDEO' && content?.value) {
          this.videoUrls?.set(
            content?.value,
            this.getSafeVideoUrl(content?.value),
          );
        }
      });
    }
  }

  getVideoUrl(url: string): SafeResourceUrl {
    return (
      this.videoUrls?.get(url) ||
      this.sanitizer?.bypassSecurityTrustResourceUrl('')
    );
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    if (url?.includes('youtube.com/watch?v=')) {
      const videoId = url?.split('v=')[1]?.split('&')[0];
      if (videoId) {
        url = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&enablejsapi=1`;
      }
    } else if (url?.includes('youtu.be/')) {
      const videoId = url?.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) {
        url = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&enablejsapi=1`;
      }
    }
    return this.sanitizer?.bypassSecurityTrustResourceUrl(url);
  }

  selectOption(quizIndex: number, option: string) {
    this.selectedAnswers[quizIndex] = option;

    const quiz = this.data?.quizzes[quizIndex];
    if (quiz && quiz.correct_answer === option) {
      this.triggerConfetti();
    }
  }

  triggerConfetti() {
    import('canvas-confetti').then((confetti) => {
      const myConfetti = confetti.default || confetti;
      myConfetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 1 },
        scalar: 1.2,
        drift: 0,
        ticks: 200,
      });
    });
  }

  goToBack() {
    this.router?.navigate([this.workspaceNav.getMyLearningRoute()]);
  }

  areAllQuizzesAnswered(): boolean {
    if (!this.hasQuizzes()) return true;
    return this.data?.quizzes?.every(
      (_: any, index: number) => !!this.selectedAnswers[index],
    );
  }

  hasQuizzes(): boolean {
    return !!this.data?.quizzes?.length;
  }

  toggleQuizSection() {
    this.showQuizSection = !this.showQuizSection;
  }

  markAsCompleted() {
    if (this.is_completed) return;
    this.is_completed = true;
    this.showQuizSection = false;

    const quizAnswersArray = Object?.keys(this.selectedAnswers)?.map((key) => {
      const index = Number(key);
      return {
        quiz_no: index + 1,
        answer: this.selectedAnswers[index],
      };
    });

    const payload = {
      user_id: this.str?.getItem(STORAGEENUMS?.USER_ID),
      course_id: this.data?.course_id,
      section_id: this.sectionId,
      lesson_id: this.data?.lesson_id,
      user_quiz_answers: quizAnswersArray,
    };
    this.commonHttp
      .postCourse(`/client/${this.clientId}/completed-assign-course`, payload)
      .subscribe({
        next: () => {
          this.toastr?.success('Course completed successfully');
          this.lessonsMenu?.updateSectionCompletion(
            this.data?.id,
            quizAnswersArray,
          );
          if (!this.lessonsMenu?.navigateToNextSection()) {
            this.router.navigate([this.workspaceNav.getMyLearningRoute()]);
          }
        },
        error: () => {
          this.is_completed = false;
          this.toastr?.error('Failed to complete the course');
        },
      });
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  getCorrectAnswersCount(): number {
    if (!this.data?.quizzes) return 0;
    let count = 0;
    this.data?.quizzes?.forEach((quiz: any, index: number) => {
      if (this.selectedAnswers[index] === quiz?.correct_answer) {
        count++;
      }
    });
    return count;
  }
}
