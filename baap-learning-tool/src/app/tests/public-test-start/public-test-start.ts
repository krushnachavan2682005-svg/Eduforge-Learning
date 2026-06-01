import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CodeEditor } from '../code-editor/code-editor';
import { Tooltip } from '../../shared/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage-service';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-public-test-start',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CodeEditor,
    Tooltip,
  ],
  templateUrl: './public-test-start.html',
  styleUrl: './public-test-start.scss',
})
export class PublicTestStart {
  userId = '';
  clientId = '';
  examId: string = '';
  message: string = '';
  isSidebarOpen = true;
  showExamUI = false;
  showResultUI = false;
  examSubmitted = false;
  resultData: any = null;
  candidateForm!: FormGroup;
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
  private fb = inject(FormBuilder);
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

  initForm() {
    this.candidateForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    });
  }

  onSubmit() {
    if (this.candidateForm.valid) {
      this.commonHttp.postCourse(
        `/client/${this.clientId}/exams/${this.examId}/public`,
        this.candidateForm.value,
      );
      this.toastr.success('Details Saved! Starting Exam...');
      this.showExamUI = true;
    }
  }

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.route?.params?.subscribe((params: any) => {
      this.examId = params['id'];
    });
    this.initForm();
    this.copyPaste();
  }

  startExam() {
    this.actualStartTime = new Date();
    const formValues = this.candidateForm?.value;
    const payload = {
      first_name: formValues?.first_name,
      last_name: formValues?.last_name,
    };
    this.commonHttp
      .postCourse(`/exams/${this.examId}/public`, payload)
      .subscribe((response: any) => {
        const exam = response?.data?.exam_details;
        const sessionId = response?.data?.session_id;

        if (!exam) return;
        this.examData.set(exam || {});
        this.session_id.set(sessionId || '');
        this.questions.set(exam?.questions || []);

        const questionCount = this.questions().length;

        this.selectedOptions.set(new Array(questionCount).fill(''));
        this.answeredStatus.set(new Array(questionCount).fill(false));
        const durationMinutes = Number(exam?.duration_minutes) || 0;
        const totalSeconds = durationMinutes * 60;

        this.startCountdown(totalSeconds);
      });
  }

  submitExam() {
    const answersPayload = this.questions().map((q: any, index: number) => {
      return {
        question_id: q.id,
        user_answer: this.selectedOptions()[index] || '',
      };
    });

    const payload = {
      answers: answersPayload,
    };

    this.commonHttp
      .postCourse(
        `/exams/${this.examId}/public/${this.session_id()}/submit`,
        payload,
      )
      .subscribe({
        next: (res: any) => {
          this.message = 'Exam submitted successfully!';
          this.examSubmitted = true;
          this.resultData = res?.data;
          this.toastr.success('Exam submitted successfully!');
        },
        error: (err) => {
          console.error(err);
          this.message = 'Submission failed.';
          this.toastr.error('Exam session is already submitted.');
        },
      });
  }

  goToNextQuestion() {
    const currentAnswer = this.selectedOptions()[this.currentQuestionIndex];
    const isAnswered =
      currentAnswer && currentAnswer?.toString()?.trim() !== '';

    if (isAnswered) {
      this.updateAnsweredStatus(this.currentQuestionIndex, true);
      this.message = 'Answer saved successfully!';
      setTimeout(() => {
        this.message = '';
        if (this.currentQuestionIndex < this.questions().length - 1) {
          this.currentQuestionIndex++;
          this.cdr?.detectChanges();
        }
      }, 1000);
    } else {
      if (this.currentQuestionIndex < this.questions().length - 1) {
        this.currentQuestionIndex++;
        this.cdr?.detectChanges();
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
    this.showTimeUpModal?.set(true);
  }
  onTimeUpOk() {
    this.showTimeUpModal.set(false);

    if (this.examSubmitted) {
      this.showExamUI = false;
      this.showResultUI = true;
    }
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
      return this.block(e, 'Copy-paste is disabled  exam!');
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
