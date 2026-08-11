import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { Tooltip } from '../../shared/tooltip';

@Component({
  selector: 'app-lessons-menu',
  standalone: true,
  imports: [CommonModule, Tooltip],
  templateUrl: './lessons-menu.html',
  styleUrl: './lessons-menu.scss',
})
export class LessonsMenu implements OnInit {
  userId = '';
  clientId = '';
  course = signal<any>([]);
  lessons = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  @Input() courseId: string = '';
  selectedSectionId: number | null = null;
  lessonsCache: { [courseId: string]: any[] } = {};
  @Output() sectionSelected = new EventEmitter<any>();
  @Output() dataLoaded = new EventEmitter<void>();

  private str = inject(StorageService);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';

    if (this.courseId) {
      this.getLessons(this.courseId);
    }
  }

  getLessons(courseId: string) {
    if (this.lessonsCache[courseId]) {
      this.lessons?.set(this.lessonsCache[courseId]);
      this.autoSelectFirstSection();
      this.dataLoaded?.emit();
      this.isLoading?.set(false);
      return;
    }

    this.isLoading?.set(true);

    this.commonHttp
      .getCourse(
        `/user/${this.userId}/course/${courseId}`,
      )
      .subscribe({
        next: (res: any) => {
          this.course?.set(res?.data?.course || []);
          const data =
            res?.data?.lessons?.map((l: any) => ({ ...l, expanded: false })) ||
            [];
          this.lessonsCache[courseId] = data;
          this.lessons?.set(data);
          this.autoSelectFirstSection();
          this.dataLoaded?.emit();
          this.isLoading?.set(false);
        },
        error: () => {
          this.isLoading?.set(false);
          this.dataLoaded?.emit();
        },
      });
  }
  autoSelectFirstSection() {
    const firstLesson = this.lessons()[0];
    const firstSection = firstLesson?.sections?.[0];
    if (firstLesson && firstSection) {
      firstLesson.expanded = true;
      this.selectedSectionId = firstSection?.id;
      this.sectionSelected?.emit({
        ...firstSection,
        lesson_id: firstLesson?.id,
        course_id: this.course()?.id,
      });

      this.lessons?.update((l) => [...l]);
    }
  }

  toggleLesson(lesson: any) {
    this.lessons?.update((prev) =>
      prev?.map((l) => ({
        ...l,
        expanded: l?.id === lesson?.id ? !l?.expanded : false,
      })),
    );
  }

  selectSection(lesson: any, section: any) {
    this.selectedSectionId = section?.id;
    this.sectionSelected?.emit({
      ...section,
      lesson_id: lesson?.id,
      course_id: this.course()?.id,
    });
  }

  navigateToNextSection(): boolean {
    const lessons = this.lessons();

    for (let i = 0; i < lessons?.length; i++) {
      const s = lessons[i]?.sections || [];
      const idx = s?.findIndex(
        (x: { id: number | null }) => x?.id === this.selectedSectionId,
      );

      if (idx === -1) continue;

      if (s[idx + 1]) {
        this.selectSection(lessons[i], s[idx + 1]);
        return true;
      }

      const next = lessons[i + 1];
      if (next?.sections?.length) {
        this.lessons?.update((l) =>
          l?.map((x) => ({ ...x, expanded: x?.id === next?.id })),
        );
        this.selectSection(next, next?.sections[0]);
        return true;
      }
      return false;
    }
    return false;
  }

  updateSectionCompletion(id: number, quizAnswers: any[] = []) {
    this.lessons?.update((l) =>
      l.map((x) => ({
        ...x,
        sections: x?.sections?.map((s: { id: number }) =>
          s?.id === id
            ? { ...s, is_completed: true, user_quiz_answers: quizAnswers }
            : s,
        ),
      })),
    );
  }
}
