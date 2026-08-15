import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { Router, ActivatedRoute } from '@angular/router';
import { CodeEditor } from '../code-editor/code-editor';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-reviewer',
  imports: [CommonModule, FormsModule, CodeEditor],
  templateUrl: './reviewer.html',
  styleUrl: './reviewer.scss',
})
export class Reviewer {
  userId = '';
  examId: string = '';
  examData = signal<any>({});
  cancelExam: boolean = false;
  questions = signal<any[]>([]);
  examSubmiteed: boolean = false;
  session_id = signal<string>('');
  currentQuestionIndex: number = 0;
  selectedOptions = signal<string[]>([]);

  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);

  reviewMarks = signal<number[]>([]);
  reviewIsCorrect = signal<boolean[]>([]);
  reviewerComments = signal<string[]>([]);
  ngOnInit() {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.route?.queryParams?.subscribe((params: any) => {
      this.examId = params['examId'];
      this.userId = params['userId'];
      this.session_id?.set(params['session_id']);
      this.getExam();
    });
  }

  getExam(): void {
    this.commonHttp
      ?.getCourse(
        `/submission/user/${this.userId}/session/${this.session_id()}`,
      )
      .subscribe({
        next: (res: any) => {
          const data = res?.data;
          const details = data?.submission_details ?? [];

          if (!res?.success || !data) {
            this.toastr?.error('No submission data found');
            return;
          }

          this.examData?.set(data);
          this.questions?.set(details);

          this.selectedOptions?.set(
            details?.map((q: any) => q?.user_answer || ''),
          );
          this.reviewMarks?.set(
            details?.map((q: any) => q?.marks_obtained ?? 0),
          );
          this.reviewIsCorrect?.set(
            details?.map((q: any) => q?.is_correct ?? false),
          );
          this.reviewerComments?.set(
            details?.map((q: any) => q?.reviewer_comment || ''),
          );
        },
        error: () => this.toastr?.error('Failed to load exam for review'),
      });
  }

  submitExam() {
    const reviewedAnswers = this.questions()?.map((q, index) => ({
      question_id: q?.question_id,
      marks_obtained: Number(this.reviewMarks()[index] || 0),
      is_correct: this.reviewIsCorrect()[index] === true,
      reviewer_comment: this.reviewerComments()[index] || '',
    }));

    const reviewPayload = {
      exam_reviews: this.userId,
      reviewed_answers: reviewedAnswers,
    };

    this.commonHttp
      ?.putCourse(
        `/exam/review/${this.session_id()}`,
        reviewPayload,
      )
      ?.subscribe({
        next: (res: any) => {
          this.toastr?.success('Exam Reviewed Successfully');
          this.examSubmiteed = true;
          this.goBack();
        },
        error: (error) => {
          const apiErrorMessage = error?.error?.message;
          const errorMessage = apiErrorMessage || 'Review Submission Failed.';
          this.toastr?.error(errorMessage);
        },
      });
  }

  setReviewStatus(isCorrect: boolean) {
    const currentQIndex = this.currentQuestionIndex;

    this.reviewIsCorrect.update((arr) => {
      const updated = [...arr];
      updated[currentQIndex] = isCorrect;
      return updated;
    });

    if (!isCorrect) {
      this.reviewMarks.update((arr) => {
        const updated = [...arr];
        updated[currentQIndex] = 0;
        return updated;
      });
    }
  }

  validateMarks(index: number) {
    const marksArr = [...this.reviewMarks()];
    const questionMax = this.questions()[index]?.question_marks || 0;
    const totalAllowed = this.examData()?.total_marks || 0;
    if (marksArr[index] > questionMax) {
      marksArr[index] = questionMax;
      this.toastr?.error(`Max marks allowed: ${questionMax}`);
    }
    const totalGiven = marksArr?.reduce((a, b) => a + Number(b || 0), 0);
    if (totalGiven > totalAllowed) {
      marksArr[index] = 0; // reset only current
      this.toastr?.error(`Total cannot exceed ${totalAllowed}`);
    }

    this.reviewMarks?.set(marksArr);
  }

  goToNextQuestion() {
    if (this.currentQuestionIndex < this.questions()?.length - 1) {
      this.currentQuestionIndex++;
      this.cdr?.detectChanges();
    }
  }
  goToPreviousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  goBack() {
    this.router?.navigate([this.workspaceNav.getReviewListRoute()]);
  }
  closePupUp() {
    this.cancelExam = false;
  }
}
