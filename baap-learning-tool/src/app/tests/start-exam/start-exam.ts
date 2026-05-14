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

  private countdown: any = null;
  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private commonHttp = inject(CommonHttpService);
  private boundContextMenuHandler!: (e: MouseEvent) => void;
  private boundGlobalKeyHandler!: (e: KeyboardEvent) => void;
  private boundClipboardHandler!: (e: ClipboardEvent) => void;

  goBack() {
    this.router?.navigate(['/tests/my-test']);
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
    this.commonHttp
      .getCourse(
        `/client/${this.clientId}/exams/${this.examId}/start/${this.userId}`,
      )
      .subscribe((response: any) => {
        this.session_id?.set(response?.data?.session_id || '');
        this.examData?.set(response?.data?.exam_details || {});
        this.questions?.set(this.examData()?.questions || []);
        const questionCount = this.questions()?.length;

        const savedAnswers = response?.data?.saved_answers || [];
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
        // this.selectedOptions?.set(new Array(questionCount)?.fill(''));
        // this.answeredStatus?.set(new Array(questionCount)?.fill(false));
        // this.selectedOptions?.set(
        //   new Array(this.questions()?.length)?.fill(''),
        // );
        const durationMinutes = Number(this.examData()?.duration_minutes) || 0;
        const exam = this.examData();
        const totalSeconds = durationMinutes * 60;
        let scheduledStart: Date | null = null;

        if (exam?.exam_date && exam?.exam_start_time) {
          const dateStr =
            typeof exam?.exam_date === 'string'
              ? exam?.exam_date
              : new Date(exam?.exam_date)?.toISOString()?.split('T')[0];

          const timeStr = exam?.exam_start_time?.toString();
          const direct = new Date(timeStr);
          scheduledStart =
            timeStr?.includes('T') && !isNaN(direct?.getTime())
              ? direct
              : new Date(`${dateStr}T${timeStr}`);
        }
        if (
          scheduledStart &&
          !isNaN(scheduledStart?.getTime()) &&
          this.actualStartTime
        ) {
          const delaySeconds = Math?.max(
            0,
            Math?.floor(
              (this.actualStartTime?.getTime() - scheduledStart?.getTime()) /
                1000,
            ),
          );

          const remainingSeconds = Math?.max(0, totalSeconds - delaySeconds);
          this?.startCountdown(remainingSeconds);
        } else {
          this?.startCountdown(totalSeconds);
        }
      });
  }

  submitExam() {
    const payload = {
      session_id: this.session_id(),
    };

    this.saveAnswer().subscribe({
      next: () => {
        this.commonHttp
          .postCourse(
            `/client/${this.clientId}/exam/submit/${this.userId}`,
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
      `/client/${this.clientId}/exam/${this.userId}/save-answer`,
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
      this.onTimeUp();
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

    this.showTimeUpModal?.set(true);
    this.submitExam();
  }
  onTimeUpOk() {
    this.showTimeUpModal?.set(false);

    this.router?.navigate(['/tests/test-result']);
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
    document.addEventListener('cut', this.boundClipboardHandler);
    this.boundGlobalKeyHandler = this.globalKeyHandler.bind(this);
    document.addEventListener('copy', this.boundClipboardHandler);
    this.boundClipboardHandler = this.onGlobalClipboard.bind(this);
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
