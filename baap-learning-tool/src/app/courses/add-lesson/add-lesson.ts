import {
  Pipe,
  Input,
  Output,
  signal,
  inject,
  OnChanges,
  Component,
  EventEmitter,
  SimpleChanges,
  PipeTransform,
} from '@angular/core';
import { Modal } from '../../modal/modal';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonHttpService } from '../../services/common-http.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  FormGroup,
  Validators,
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Tooltip } from '../../shared/tooltip';
import { STORAGEENUMS } from '../../shared/enum';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { StorageService } from '../../services/storage-service';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';
@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    return this.sanitizer?.bypassSecurityTrustResourceUrl(url);
  }
}
@Component({
  selector: 'app-add-lesson',
  imports: [
    Modal,
    Tooltip,
    CommonModule,
    ReactiveFormsModule,
    NgxSkeletonLoaderModule,
  ],
  templateUrl: './add-lesson.html',
  styleUrl: './add-lesson.scss',
})
export class AddLesson implements OnChanges {
  lessonForm!: FormGroup;
  clientId = '';
  courseId: any;
  course_data: any;
  showModal = false;
  @Input() open = false;
  sectionId: string = '';
  editMode: boolean = false;
  selectedSection: any = null;
  @Input() course: any = null;
  sections = signal<any[]>([]);
  @Input() isLoading: boolean = false;
  @Input() openLessonModal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() courseAdded = new EventEmitter<any>();
  @Output() lessonAdded = new EventEmitter<any>();
  @Output() lessonsLoaded = new EventEmitter<any>();
  @Output() refreshCourse = new EventEmitter<void>();
  @Output() sectionSelected = new EventEmitter<any>();
  @Output() openLessonModalChange = new EventEmitter<boolean>();
  private router = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  public skeletonService = inject(SkeletonTheme);
  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.route?.params?.subscribe((params: any) => {
      this.courseId = params['id'];
      this.sectionId = params['sectionId'];
    });
    this.initializeLessonForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['course'] && changes['course'].currentValue) {
      this.course_data = changes['course'].currentValue;
      // this.fullCourseData = changes['course'].currentValue;
      this.loadLessonsFromCourse();
    }
    if (changes['openLessonModal'] && this.openLessonModal) {
      this.initializeLessonForm();
      this.showModal = true;
    }
  }

  private loadLessonsFromCourse() {
    if (!this.course_data?.id) return;
    if (this.course_data?.lessons && this.course_data?.lessons?.length > 0) {
      this.sections?.set(
        this.course_data?.lessons?.map((l: any) => ({ ...l, expanded: false })),
      );
      return;
    }
  }

  lessonPopUpForm() {
    // Trim trailing spaces from title before validation
    const titleValue = this.lessonForm.get('title')?.value;
    if (titleValue) {
      this.lessonForm.get('title')?.setValue(titleValue.trimEnd());
    }

    this.lessonForm?.markAllAsTouched();
    if (!this.lessonForm?.valid) return;

    const payload = {
      title: this.lessonForm?.value?.title,
      seq_no: this.lessonForm?.value?.seq_no,
      course_id: this.course_data?.id,
    };

    if (this.editMode && this.selectedSection?.id) {
      this.commonHttp
        .putCourse(
          `/eduforge/api/lesson/${this.selectedSection?.id}`,
          payload,
        )
        .subscribe({
          next: () => {
            this.toastr.success('Lesson updated successfully', '', {
              // closeButton: false,
              timeOut: 2000,
              progressBar: true,
            });
            this.showModal = false;
            this.openLessonModalChange?.emit(false);
            this.refreshCourse?.emit();
            this.initializeLessonForm();
            this.editMode = false;
            this.selectedSection = null;
          },
          error: (err) => {
            this.toastr.error(err?.error?.error, '', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
          },
        });
    } else {
      this.commonHttp
        .postCourse(`/eduforge/api/lesson`, payload)
        .subscribe({
          next: () => {
            this.toastr.success('Lesson added successfully', '', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
            this.showModal = false;
            this.openLessonModalChange?.emit(false);
            this.refreshCourse?.emit();
            this.initializeLessonForm();
          },
          error: (err) => {
            this.toastr?.error(err?.error?.error, '', {
              // closeButton: true,
              timeOut: 2000,
              progressBar: true,
            });
          },
        });
    }
  }

  navigateToLesson(lesson: any) {
    if (lesson && lesson.id) {
      this.router.navigate([this.workspaceNav.getCourseViewSectionRoute(lesson.id)], {
        queryParams: { courseId: this.course_data?.id || this.courseId },
      });
    }
  }

  editLesson(lesson: any) {
    if (lesson && lesson?.id) {
      this.editMode = true;
      this.showModal = true;
      this.lessonForm?.patchValue({
        title: lesson?.title,
        seq_no: lesson?.seq_no,
      });
      this.selectedSection = { ...lesson };
    }
  }

  deleteLesson(lesson: any) {
    this.commonHttp
      .delete(`/eduforge/api/lesson/${lesson?.id}`, {
        course_id: this.courseId,
      })
      .subscribe({
        next: () => {
          this.toastr?.success('Lesson deleted successfully');
          const updatedSections = this.sections()?.filter(
            (l: any) => l?.id !== lesson?.id,
          );
          this.sections?.set(updatedSections);
        },
        error: () => this.toastr?.warning('Please delete section first'),
      });
  }

  closeModal() {
    this.showModal = false;
    this.initializeLessonForm();
    this.openLessonModalChange?.emit(false);
  }

  private initializeLessonForm() {
    this.lessonForm = new FormGroup({
      title: new FormControl('', [
        Validators.required,
        Validators.pattern(/^(?!.*[!&,._@/]{2,})(?!.*[!&,._@/]$)[A-Za-z0-9\s!&,._@/]+$/),
      ]),
      seq_no: new FormControl('', [Validators.pattern(/^[1-9]\d*$/)]),
    });
    this.lessonForm?.markAsPristine();
    this.lessonForm?.markAsUntouched();
    this.lessonForm?.updateValueAndValidity({
      onlySelf: false,
      emitEvent: false,
    });
  }
  onTitleInput(event: Event): void {
    const input = event?.target as HTMLInputElement;
    if (!input) return;
    let v = (input?.value || '')
      .replace(/[^A-Za-z0-9\s!&,._@/]/g, '')
      .replace(/[!&,._@/]{2,}/g, (match) => match[0])
      .replace(/^\s+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[^A-Za-z]+/, '');

    let seenLetter = false,
      digits = 0;
    v = Array.from(v)
      .filter((ch) => {
        if (/[A-Za-z]/.test(ch)) return (seenLetter = true);
        if (/[0-9]/.test(ch)) return seenLetter && digits++ < 3;
        if (['!', '&', ',', '.', '_', '@', '/'].includes(ch)) return true;
        return ch === ' ';
      })
      .join('');

    if (input?.value !== v) input.value = v;
    this.lessonForm?.get('title')?.setValue(v);
  }
}
