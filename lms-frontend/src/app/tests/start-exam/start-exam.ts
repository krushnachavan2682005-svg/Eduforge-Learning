import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { ExamMenubar } from '../exam-menubar/exam-menubar';
import { Router, ActivatedRoute } from '@angular/router';
import { CodeEditor } from '../code-editor/code-editor';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Tooltip } from '../../shared/tooltip';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-start-exam',
  imports: [CommonModule, FormsModule, CodeEditor, ExamMenubar, Tooltip],
  templateUrl: './start-exam.html',
  styleUrl: './start-exam.scss',
})
export class StartExam {
  userId = '';
  clientId = '';
  examId: string = '';
  message: string = '';
  isSidebarOpen = true;
  examSubmitted = false;
  examData = signal<any>({});
  cancelExam: boolean = false;
  questions = signal<any[]>([]);
  examSubmiteed: boolean = false;
  session_id = signal<string>('');
  currentQuestionIndex: number = 0;
  actualStartTime: Date | null = null;
  remainingSeconds = signal<number>(0);
  selectedOptions = signal<string[]>([]);
  answeredStatus = signal<boolean[]>([]);
  showTimeUpModal = signal<boolean>(false);
  startError = signal<string>('');
  isLoading = signal(false);

  private countdown: any = null;
  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  private boundContextMenuHandler!: (e: MouseEvent) => void;
  private boundGlobalKeyHandler!: (e: KeyboardEvent) => void;
  private boundClipboardHandler!: (e: ClipboardEvent) => void;

  goBack() {
    this.router?.navigate([this.workspaceNav.getTestListRoute()]);
  }

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.route?.params?.subscribe((params: any) => {
      this.examId = params['id'];
      this.getExam();
    });
    this.copyPaste();
  }

  getExam() {
    this.actualStartTime = new Date();
    this.clearCountdown();
    this.isLoading.set(true);
    this.startError.set('');
    this.commonHttp
      .getCourse(
        `/eduforge/api/exams/${this.examId}/start/${this.userId}`,
      )
      .subscribe({
        next: (response: any) => {
        this.isLoading.set(false);
        const normalized = this.normalizeStartExamResponse(response);
        if (!normalized.sessionId || !normalized.questions.length) {
          this.startError.set('Unable to load this test. Please try again.');
          return;
        }

        this.session_id?.set(normalized.sessionId);
        this.examData?.set(normalized.exam);
        this.questions?.set(normalized.questions);
        const questionCount = normalized.questions.length;

        const savedAnswers = normalized.savedAnswers;
        const selected = new Array(questionCount)?.fill('');
        const answered = new Array(questionCount)?.fill(false);

        savedAnswers?.forEach((ans: any) => {
          const index = ans?.question_index;

          if (index !== undefined && index < questionCount) {
            selected[index] = ans?.user_answer;
            answered[index] = true;
          }
        });

        this.selectedOptions?.set(selected);
        this.answeredStatus?.set(answered);

        if (normalized.remainingSeconds > 0) {
          this?.startCountdown(normalized.remainingSeconds);
          return;
        }

        this.startError.set('This test has expired.');
      },
      error: (error) => {
        this.isLoading.set(false);
        const code = error?.error?.error_code;
        const message =
          code === 'TEST_EXPIRED'
            ? 'This test has expired.'
            : code === 'TEST_NOT_STARTED'
              ? 'This test has not started yet.'
              : code === 'TEST_ALREADY_SUBMITTED'
                ? 'You have already submitted this test.'
                : code === 'TEST_NOT_ASSIGNED'
                  ? 'This test is not assigned to you.'
                  : error?.error?.message || 'Unable to start this test.';
        this.startError.set(message);
        this.toastr.error(message);
      },
    });
  }

  private normalizeStartExamResponse(response: any) {
    const data = response?.data || {};
    const rawExam =
      data?.exam ||
      data?.exam_details ||
      data?.exam_snapshot ||
      data?.session?.exam_snapshot ||
      data?.answers_data?.exam_snapshot ||
      {};
    const rawQuestions =
      data?.questions ||
      rawExam?.questions ||
      data?.exam_snapshot?.questions ||
      data?.answers_data?.exam_snapshot?.questions ||
      [];
    const questions = (Array.isArray(rawQuestions) ? rawQuestions : []).map(
      (question: any) => this.normalizeQuestion(question),
    );
    const durationMinutes = Number(
      rawExam?.duration_minutes || rawExam?.durationMinutes || data?.duration_minutes || 0,
    );
    const expiresAt =
      rawExam?.expires_at ||
      rawExam?.end_time ||
      rawExam?.endTime ||
      data?.expires_at ||
      null;
    const remainingFromBackend = Number(data?.remaining_seconds);
    const remainingFromExpiry = expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      : 0;
    const remainingSeconds = Number.isFinite(remainingFromBackend) && remainingFromBackend > 0
      ? remainingFromBackend
      : remainingFromExpiry > 0
        ? remainingFromExpiry
        : durationMinutes > 0
          ? durationMinutes * 60
          : 0;

    return {
      sessionId: data?.session_id || data?.session?.id || '',
      savedAnswers: data?.saved_answers || data?.answers || [],
      remainingSeconds,
      exam: {
        id: rawExam?.id || rawExam?.exam_id || this.examId,
        title: rawExam?.title || rawExam?.name || '',
        duration_minutes: durationMinutes,
        total_marks: Number(rawExam?.total_marks || rawExam?.totalMarks || 0),
        passing_marks: Number(rawExam?.passing_marks || rawExam?.passingMarks || 0),
        started_at: rawExam?.started_at || data?.started_at || null,
        expires_at: expiresAt,
        exam_date: rawExam?.exam_date || rawExam?.start_time || null,
        exam_start_time: rawExam?.exam_start_time || rawExam?.start_time || null,
        questions,
      },
      questions,
    };
  }

  private normalizeQuestion(question: any) {
    const rawType = String(
      question?.question_type || question?.type || question?.questionType || '',
    ).toLowerCase();
    const type =
      rawType === 'mcq'
        ? 'mcq'
        : rawType === 'long' || rawType === 'practical'
          ? rawType
          : 'short';
    const rawOptions =
      question?.options || question?.choices || question?.answer_options || [];
    const options = (Array.isArray(rawOptions) ? rawOptions : []).map((option: any) =>
      typeof option === 'string'
        ? { option_text: option }
        : {
            ...option,
            option_text:
              option?.option_text || option?.label || option?.value || option?.text || '',
          },
    );

    return {
      ...question,
      id: question?.id || question?.question_id,
      question_id: question?.question_id || question?.id,
      text:
        question?.question_text ||
        question?.question ||
        question?.title ||
        question?.text ||
        '',
      question_text:
        question?.question_text ||
        question?.question ||
        question?.title ||
        question?.text ||
        '',
      type,
      question_type: type === 'mcq' ? 'mcq' : 'theory',
      options,
      marks: Number(question?.marks || question?.question_marks || 0),
    };
  }

  submitExam() {
    const payload = {
      session_id: this.session_id(),
    };

    this.saveAnswer().subscribe({
      next: () => {
        this.commonHttp
          .postCourse(
            `/eduforge/api/exam/submit/${this.userId}`,
            payload,
          )
          .subscribe({
            next: (res: any) => {
              this.message = 'Exam submitted successfully!';
              this.examSubmitted = true;
            },
            error: () => {
              this.message = 'Submission failed.';
              this.toastr.error('Exam session is already submmited.');
            },
          });
      },
      error: () => {
        this.toastr?.error('Error saving final answer before submission:');
      },
    });
  }

  saveAnswer() {
    const payload = {
      session_id: this.session_id(),
      question_id: this.questions()[this.currentQuestionIndex]?.id,
      user_answer: this.selectedOptions()[this.currentQuestionIndex],
      current_question_index: this.currentQuestionIndex,
    };

    return this.commonHttp?.postCourse(
      `/eduforge/api/exam/${this.userId}/save-answer`,
      payload,
    );
  }
  goToNextQuestion() {
    const currentAnswer = this.selectedOptions()[this.currentQuestionIndex];
    const isAnswered =
      currentAnswer && currentAnswer?.toString()?.trim() !== '';

    if (isAnswered) {
      this.saveAnswer()?.subscribe({
        next: () => {
          this.updateAnsweredStatus(this.currentQuestionIndex, true);

          this.message = 'Answer saved successfully..!';

          setTimeout(() => {
            this.message = '';

            if (this.currentQuestionIndex < this.questions().length - 1) {
              this.currentQuestionIndex++;
              this.cdr?.detectChanges();
            }
          }, 1500);
        },
        error: () => {
          this.message = 'Exam session is already completed';
        },
      });
    } else {
      if (this.currentQuestionIndex < this.questions().length - 1) {
        this.currentQuestionIndex++;
        this.cdr.detectChanges();
      }
    }
  }

  goToPreviousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.cdr?.detectChanges();
    }
  }

  onQuestionSelect(newIndex: number) {
    if (newIndex === this.currentQuestionIndex) return;
    this.currentQuestionIndex = newIndex;
    if (this.currentQuestionIndex === 0) {
      this.cdr?.detectChanges();
    }

    this.cdr?.detectChanges();
  }

  updateAnsweredStatus(index: number, status: boolean) {
    this.answeredStatus?.update((statusArray) => {
      const newStatusArray = [...statusArray];
      newStatusArray[index] = status;
      return newStatusArray;
    });
    this.cdr?.detectChanges();
  }

  private startCountdown(totalSeconds: number) {
    this.clearCountdown();
    this.remainingSeconds?.set(Math?.max(0, totalSeconds));
    if (this.remainingSeconds() <= 0) {
      this.startError.set('This test has expired.');
      return;
    }
    this.countdown = setInterval(() => {
      const next = this.remainingSeconds() - 1;
      if (next <= 0) {
        this.remainingSeconds?.set(0);
        this.clearCountdown();
        this.onTimeUp();
      } else {
        this.remainingSeconds?.set(next);
      }
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = null;
    }
  }

  formatRemainingTime(): string {
    const t = this.remainingSeconds();
    const h = Math?.floor(t / 3600);
    const m = Math?.floor((t % 3600) / 60);
    const s = t % 60;
    return `${h ? String(h)?.padStart(2, '0') + ':' : ''}${String(m)?.padStart(2, '0')}:${String(s)?.padStart(2, '0')}`;
  }

  private onTimeUp() {
    if (this.examSubmitted) return;
    if (!this.session_id() || !this.questions().length) return;

    this.showTimeUpModal?.set(true);
    this.submitExam();
  }
  onTimeUpOk() {
    this.showTimeUpModal?.set(false);

    this.router?.navigate([this.workspaceNav.getTestResultsRoute()]);
  }
  ngOnDestroy() {
    this.clearCountdown();
    if (this.boundGlobalKeyHandler) {
      document?.removeEventListener('keydown', this.boundGlobalKeyHandler);
    }
    if (this.boundContextMenuHandler) {
      document?.removeEventListener(
        'contextmenu',
        this.boundContextMenuHandler,
      );
    }
    if (this.boundClipboardHandler) {
      document?.removeEventListener('copy', this.boundClipboardHandler);
      document?.removeEventListener('cut', this.boundClipboardHandler);
      document?.removeEventListener('paste', this.boundClipboardHandler);
    }
  }
  copyPaste() {
    this.boundGlobalKeyHandler = this.globalKeyHandler.bind(this);
    this.boundClipboardHandler = this.onGlobalClipboard.bind(this);
    document.addEventListener('cut', this.boundClipboardHandler);
    document.addEventListener('copy', this.boundClipboardHandler);
    document.addEventListener('paste', this.boundClipboardHandler);
    document.addEventListener('keydown', this.boundGlobalKeyHandler);
    this.boundContextMenuHandler = this.onGlobalContextMenu.bind(this);
    document.addEventListener('contextmenu', this.boundContextMenuHandler);
  }

  private block(e: Event, msg?: string): void {
    e?.preventDefault();
    e?.stopPropagation();
    if (msg) this.toastr?.warning(msg);
  }

  preventCopyPaste(e: Event) {
    this.block(e, 'Copy-paste is disabled during exam');
  }
  disableRightClick(e: MouseEvent) {
    this.block(e, 'Right-click is disabled during exam');
  }
  onGlobalClipboard(e: ClipboardEvent) {
    this.block(e, 'Copy-paste is disabled during exam');
  }
  onGlobalContextMenu(e: MouseEvent) {
    this.block(e, 'Right-click is disabled during exam');
  }

  private isDevToolsShortcut(e: KeyboardEvent) {
    const isCtrlOrCmd = e?.ctrlKey || e?.metaKey,
      isShift = e?.shiftKey,
      k = e?.key?.toLowerCase();
    return k === 'f12' || (isCtrlOrCmd && isShift && k === 'i');
  }

  private isClipboardShortcut(e: KeyboardEvent) {
    const isCtrlOrCmd = e?.ctrlKey || e?.metaKey,
      k = e?.key?.toLowerCase();
    return isCtrlOrCmd && ['c', 'v', 'x', 'a', 'z']?.includes(k);
  }

  private handleKey(e: KeyboardEvent) {
    if (this.isClipboardShortcut(e))
      return this.block(e, 'Copy-paste is disabled during exam!');
    if (this.isDevToolsShortcut(e))
      return this.block(e, 'Developer tools are blocked during exam!');
  }

  preventKeyboardShortcuts(e: KeyboardEvent) {
    this.handleKey(e);
  }
  globalKeyHandler(e: KeyboardEvent) {
    this.handleKey(e);
  }
  closePupUp() {
    this.examSubmitted = false;
    this.cancelExam = false;
    this.showTimeUpModal?.set(false);
  }
}
