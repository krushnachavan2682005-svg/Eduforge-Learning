import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
  ValidatorFn,
  AbstractControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { ToastrService } from 'ngx-toastr';
import { Calendar } from '../../shared/calendar/calendar';
import { CalendarService } from '../../services/calender-service';
import { Tooltip } from '../../shared/tooltip';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-add-new-test',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgSelectModule,
    Calendar,
    Tooltip,
  ],
  templateUrl: './add-new-test.html',
  styleUrl: './add-new-test.scss',
  providers: [StorageService],
})
export class AddNewTest {
  user_id: any;
  clientId: any;
  form!: FormGroup;
  isLoading = false;
  isEditMode = false;
  examId: string | null = null;
  detailsSaved = false;
  reviewerOptions: any[] = [];
  addedTestDetails: {
    title: string;
    subject: string;
    reviewers: any;
    total_marks: number | null;
    passing_marks: number | null;
    duration_minutes: number | null;
    attempt_limit: number | null;
    exam_date: string;
    exam_start_time: string;
  } | null = null;
  private loadedQuestionsSnapshot: any[] = [];
  private addedItemsInitializedForId: string | null = null;
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private toastOptions = {
    // closeButton: true,
    timeOut: 2000,
  } as const;
  private readonly metaControlNames = [
    'title',
    'subject',
    'reviewers',
    'total_marks',
    'passing_marks',
    'duration_minutes',
    // 'attempt_limit',
    'exam_date',
    'exam_start_time',
  ];

  hoursList = Array.from({ length: 13 }, (_, i) =>
    i.toString().padStart(2, '0'),
  );

  minutesList = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, '0'),
  );
  ampmList = ['AM', 'PM'];

  selectedHour!: string;
  selectedMinute!: string;
  selectedAmPm: string = 'AM';

  minExamDate: string = '';
  maxExamDate: string = '';
  minExamTime: string = '09:00';
  questions = signal<
    Array<{
      key: number;
      text: string;
      options: Array<{ key: string; value: string; label: string }>;
      correct_answer: string | null;
      marks?: number | null;
      is_mandatory?: boolean;
      touched?: boolean;
    }>
  >([
    {
      key: 1,
      text: '',
      options: [
        { key: 'A', value: '', label: 'Option' },
        { key: 'B', value: '', label: 'Option' },
      ],
      correct_answer: null,
      is_mandatory: true,
      touched: false,
    },
  ]);
  headers = [
    {
      title: 'Create TEST',
      subtitle: 'Define details, set rules, and add questions for the test.',
    },
  ];
  editingMcqIndex: number | null = null;
  editingShortIndex: number | null = null;
  editingLongIndex: number | null = null;
  editingPracticalIndex: number | null = null;
  marksErrors: { [key: string]: boolean } = {};
  isAiSidebarOpen = false;
  aiPrompt = '';
  isGeneratingAi = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private commonservice: CommonHttpService,
    private calService: CalendarService,
    private workspaceNav: WorkspaceNavigationService,
  ) {}

  ngOnInit() {
    // Compute min (today) and max (today + 5 years) for exam date input
    const today = new Date();
    const fiveYearsLater = new Date(today);
    fiveYearsLater.setFullYear(today.getFullYear() + 5);
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    this.minExamDate = toYmd(today);
    this.maxExamDate = toYmd(fiveYearsLater);

    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.loadReviewers();
    this.form = this.fb.group({
      title: ['', Validators.required],
      subject: [],
      reviewers: [[], this.arrayNotEmptyValidator()],
      total_marks: [
        null,
        [Validators.required, Validators.min(0), Validators.max(999)],
      ],
      passing_marks: [
        null,
        [Validators.required, Validators.min(0), Validators.max(999)],
      ],
      duration_minutes: [
        null,
        [Validators.required, Validators.min(10), Validators.max(999)],
      ],
      // attempt_limit: [null],
      exam_date: [
        '',
        [
          Validators.required,
          (control: AbstractControl) =>
            this.calService.validateRequired(control),
          (control: AbstractControl) =>
            this.calService.validateMinDate(control),
          (control: AbstractControl) =>
            this.calService.validateMaxDate(control),
        ],
      ],
      exam_start_time: ['', Validators.required],
      // class_name: ['', Validators.required],
      type: [null, Validators.required],
      marks: [null],
    });

    this.form.get('type')?.valueChanges.subscribe((val) => {
      const type = ((val || '') + '')?.toLowerCase();
      this.onTypeChange(type);
    });

    const examDateCtrl = this.form.get('exam_date');
    examDateCtrl?.setValidators([
      Validators.required,
      this.dateRangeValidator(this.minExamDate, this.maxExamDate),
    ]);
    examDateCtrl?.updateValueAndValidity({ emitEvent: false });
    this.updateMinExamTime(this.form.get('exam_date')?.value);
    examDateCtrl?.valueChanges.subscribe((date) => {
      this.updateMinExamTime(date);
      this.form.get('exam_start_time')?.updateValueAndValidity();
    });

    const examTimeCtrl = this.form.get('exam_start_time');
    examTimeCtrl?.setValidators([Validators.required, this.timeValidator()]);
    examTimeCtrl?.updateValueAndValidity({ emitEvent: false });

    const totalCtrl = this.form.get('total_marks');
    const passingCtrl = this.form.get('passing_marks');
    const syncPassingValidation = () => {
      if (!passingCtrl) return;
      const existingErrors = passingCtrl.errors || {};
      if (
        existingErrors['max'] ||
        existingErrors['min'] ||
        existingErrors['required']
      ) {
        if (existingErrors['passingGreater']) {
          const { passingGreater, ...rest } = existingErrors;
          passingCtrl.setErrors(Object.keys(rest).length ? rest : null);
        }
        return;
      }

      const total = Number(totalCtrl?.value);
      const passing = Number(passingCtrl?.value);
      if (
        Number.isFinite(total) &&
        Number.isFinite(passing) &&
        passing > total
      ) {
        passingCtrl.setErrors({ ...existingErrors, passingGreater: true });
      } else if (existingErrors['passingGreater']) {
        const { passingGreater, ...rest } = existingErrors;
        passingCtrl.setErrors(Object.keys(rest).length ? rest : null);
      }
    };
    totalCtrl?.valueChanges.subscribe(() => syncPassingValidation());
    passingCtrl?.valueChanges.subscribe(() => syncPassingValidation());
    syncPassingValidation();

    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.examId = id;
        this.isEditMode = true;
        this.questions.set([]);
        this.shortQuestions.set([]);
        this.longQuestions.set([]);
        this.practicalQuestions.set([]);
        this.loadExamForEdit(id);
        this.headers = [
          {
            title: 'Edit TEST',
            subtitle: 'Update details, rules, and questions for the test.',
          },
        ];
      }
    });
  }
  private formatToDDMMYYYY(date?: string | null): string {
    if (!date) return '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date)
      : new Date(Date.parse(date));
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  private dateRangeValidator(
    minIsoYmd: string,
    maxIsoYmd: string,
  ): ValidatorFn {
    return (control) => {
      const value = control?.value;
      if (!value) return null;
      const inputDate = new Date(value);
      if (isNaN(inputDate.getTime())) return null;
      const min = new Date(minIsoYmd);
      const max = new Date(maxIsoYmd);
      if (inputDate < min) return { dateTooEarly: true } as any;
      if (inputDate > max) return { dateTooLate: true } as any;
      return null;
    };
  }

  private timeValidator(): ValidatorFn {
    return (control) => {
      const timeValue = control?.value;
      if (!timeValue) return null;

      const examDate = this.form?.get('exam_date')?.value;
      if (!examDate) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(examDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        return null;
      }
      if (selectedDate.getTime() === today.getTime()) {
        const now = new Date();
        const [selectedHours, selectedMinutes] = timeValue
          .split(':')
          .map(Number);
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const selectedTotalMinutes = selectedHours * 60 + selectedMinutes;
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        if (selectedTotalMinutes <= currentTotalMinutes) {
          return { timeInPast: true } as any;
        }
      }

      return null;
    };
  }

  validatePassingMarks() {
    const total = +this.form.get('total_marks')?.value;
    const passingControl = this.form.get('passing_marks');

    if (passingControl && (passingControl.value as any) > total) {
      passingControl.setValue(total);
    }
  }

  onOnlyNumbers(event: any) {
    event.target.value = event.target.value
      .replace(/[^0-9]/g, '')
      .replace(/^0+/, '');
  }

  sanitizeText(controlName: string, event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const value = input.value.trimStart().replace(/\s+/g, ' ');
    this.form.get(controlName)?.setValue(value, { emitEvent: false });
  }

  markExamDateTouched() {
    this.form.get('exam_date')?.markAsTouched();
    this.form.get('exam_date')?.updateValueAndValidity({ emitEvent: false });
  }

  updateMinExamTime(examDate: string | null): void {
    if (!examDate) {
      this.minExamTime = '09:00';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(examDate);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      this.minExamTime = '09:00';
      return;
    }
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();

      minutes += 1;
      if (minutes >= 60) {
        minutes = 0;
        hours += 1;
      }

      if (hours >= 18) {
        this.minExamTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      } else {
        this.minExamTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    } else {
      this.minExamTime = '09:00';
    }
  }
  onHourChange(v: any) {
    this.selectedHour = this.format(v, 0, 12);
    this.updateTimeFromSelection();
  }

  onMinuteChange(v: any) {
    this.selectedMinute = this.format(v, 0, 59);
    this.updateTimeFromSelection();
  }

  private format(v: any, min: number, max: number): string {
    const n = Number(v);
    return isNaN(n)
      ? ''
      : String(Math.min(Math.max(n, min), max)).padStart(2, '0');
  }

  updateTimeFromSelection() {
    const c = this.form.get('exam_start_time');

    if (!this.selectedHour || !this.selectedMinute || !this.selectedAmPm) {
      c?.setValue(null);
      return;
    }

    let h = +this.selectedHour;

    h =
      this.selectedAmPm === 'PM' && h < 12
        ? h + 12
        : this.selectedAmPm === 'AM' && h === 12
          ? 0
          : h;

    c?.setValue(`${String(h).padStart(2, '0')}:${this.selectedMinute}`);
    c?.markAsTouched();
  }

  syncTimeSelectionFromControl(time: string) {
    if (!time) {
      this.selectedHour = this.selectedMinute = '';
      this.selectedAmPm = 'AM';
      return;
    }

    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;

    this.selectedAmPm = h >= 12 ? 'PM' : 'AM';
    this.selectedHour = String(h % 12 || 12).padStart(2, '0');
    this.selectedMinute = String(m).padStart(2, '0');
  }

  private openPicker(event: Event, type: 'date' | 'time'): void {
    const input = event.target as HTMLInputElement;
    if (!input || input.type !== type || typeof input.showPicker !== 'function')
      return;

    input.focus();
    requestAnimationFrame(() => {
      try {
        input.showPicker();
      } catch {}
    });
  }

  openDatePicker(event: Event): void {
    this.openPicker(event, 'date');
  }

  openTimePicker(event: Event): void {
    this.openPicker(event, 'time');
  }

  private arrayNotEmptyValidator(): ValidatorFn {
    return (control) => {
      const value = control?.value;
      if (!Array.isArray(value) || value.length === 0) {
        return { required: true };
      }
      return null;
    };
  }

  private loadExamForEdit(id: string) {
    this.commonservice
      .getCourse(`/eduforge/api/exam/${id}`)
      .subscribe((res: any) => {
        const data = res?.data || res;
        const examDate = data?.exam_date
          ? new Date(data.exam_date).toISOString().slice(0, 10)
          : '';
        // const className = (data as any)?.class || data?.class_name || '';
        const type = data?.type?.toLowerCase() || 'mcq';
        if (!data) return;
        const examStartTime = this.normalizeTimeValue(
          data?.exam_time || data?.start_time || data?.exam_start_time,
        );
        const testReviewer = data?.reviewers || [];
        let reviewerArray: string[] = [];
        if (Array.isArray(testReviewer)) {
          reviewerArray = testReviewer;
        } else if (typeof testReviewer === 'string' && testReviewer.trim()) {
          // Handle comma-separated string from saved data
          reviewerArray = testReviewer
            .split(',')
            .map((r) => r.trim())
            .filter((r) => r.length > 0);
        }

        this.form.patchValue({
          title: data?.title || '',
          subject: data?.subject || '',
          reviewers: data?.reviewers,
          total_marks: data?.total_marks ?? null,
          passing_marks: data?.passing_marks ?? null,
          duration_minutes: data?.duration_minutes ?? null,
          attempt_limit: data?.attempt_limit ?? null,
          exam_date: examDate,
          exam_start_time: examStartTime,
          // class_name: className,
          type: type,
          marks: data?.marks ?? null,
        });

        this.updateMinExamTime(examDate);
        this.onTypeChange(type);

        const incomingQuestions = data?.questions || [];
        this.loadedQuestionsSnapshot = Array.isArray(incomingQuestions)
          ? [...incomingQuestions]
          : [];
        const v = this.form.value as any;
        this.addedTestDetails = {
          title: v?.title || '',
          subject: v?.subject || '',
          reviewers: v?.reviewers || [],
          total_marks: v?.total_marks ?? null,
          passing_marks: v?.passing_marks ?? null,
          duration_minutes: v?.duration_minutes ?? null,
          attempt_limit: v?.attempt_limit ?? null,
          exam_date: this.formatToDDMMYYYY(v?.exam_date || ''),
          exam_start_time: this.normalizeTimeValue(v?.exam_start_time),
        };
        if (this.addedTestDetails?.exam_start_time) {
          this.syncTimeSelectionFromControl(
            this.addedTestDetails.exam_start_time,
          );
        }
        this.detailsSaved = true;
        if (Array.isArray(incomingQuestions) && incomingQuestions.length) {
          const mcqs = incomingQuestions.filter((q: any) => q?.type === 'mcq');
          const shorts = incomingQuestions.filter(
            (q: any) => q?.type === 'short',
          );
          const longs = incomingQuestions.filter(
            (q: any) => q?.type === 'long',
          );
          const practicals = incomingQuestions.filter(
            (q: any) => q?.type === 'practical',
          );

          this.questions.set([]);
          this.shortQuestions.set([]);
          this.longQuestions.set([]);
          this.practicalQuestions.set([]);

          try {
            if (mcqs.length) {
              const mcqMapped = mcqs.map((q: any) => ({
                question: (q?.text || '').trim(),
                options: (q?.options || [])
                  .map((o: any) => (o?.option_text || '').trim())
                  .filter((v: string) => v !== ''),
                correct_answer: (q?.correct_answer || '').trim(),
                marks: this.normalizeMarks(q?.marks ?? this.form.value?.marks),
                is_mandatory: !!q?.is_mandatory,
              }));
              const dedup = Object.values(
                (mcqMapped || []).reduce((acc: any, it: any) => {
                  const k = (it.question || '').toLowerCase().trim();
                  if (!acc[k]) acc[k] = it;
                  return acc;
                }, {}),
              );
              this.addedMcq?.set(dedup as any);
            } else {
              this.addedMcq?.set([]);
            }

            if (shorts.length) {
              const shortMapped = shorts.map((q: any) => ({
                question: (q?.text || '').trim(),
                answer: (q?.correct_answer || '').trim(),
                marks: this.normalizeMarks(q?.marks ?? this.form.value?.marks),
                is_mandatory: !!q?.is_mandatory,
              }));
              const dedup = Object.values(
                (shortMapped || []).reduce((acc: any, it: any) => {
                  const k = (it.question || '').toLowerCase().trim();
                  if (!acc[k]) acc[k] = it;
                  return acc;
                }, {}),
              );
              this.addedShort.set(dedup as any);
            } else {
              this.addedShort.set([]);
            }

            if (longs.length) {
              const longMapped = longs.map((q: any) => ({
                question: (q?.long || q?.text || '').trim(),
                marks: this.normalizeMarks(q?.marks ?? this.form.value?.marks),
                is_mandatory: !!q?.is_mandatory,
              }));
              const dedupLong = Object.values(
                (longMapped || []).reduce((acc: any, it: any) => {
                  const k = (it.question || '').toLowerCase().trim();
                  if (!acc[k]) acc[k] = it;
                  return acc;
                }, {}),
              );
              this.addedLong.set(dedupLong as any);
            } else {
              this.addedLong.set([]);
            }

            if (practicals.length) {
              const practicalMapped = practicals.map((q: any) => ({
                question: (q?.long || q?.text || '').trim(),
                marks: this.normalizeMarks(q?.marks ?? this.form.value?.marks),
                is_mandatory: !!q?.is_mandatory,
                image: q?.image || q?.image_url || q?.question_image || null,
                imageName: q?.image_name || '',
              }));
              const dedup = Object.values(
                (practicalMapped || []).reduce((acc: any, it: any) => {
                  const k = (it.question || '').toLowerCase().trim();
                  if (!acc[k]) acc[k] = it;
                  return acc;
                }, {}),
              );
              this.addedPractical.set(dedup as any);
            } else {
              this.addedPractical.set([]);
            }
          } catch {}
          this.addedItemsInitializedForId = id;
        }
      });
  }

  questionTypes = ['mcq', 'short', 'long', 'practical'];
  selectType(type: string) {
    const control = this.form.get('type');
    control?.setValue(type);
    control?.markAsTouched();
    control?.markAsDirty();
  }

  onSubmit() {
    const timeCtrl = this.form.get('exam_start_time');
    timeCtrl?.updateValueAndValidity({ onlySelf: true });
    if (timeCtrl?.hasError('timeInPast')) {
      this.toastr?.error(
        'Exam time cannot be in the past',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const allocatedMarks = this.getMandatoryAllocatedMarksTotal();
    const totalMarks = Number(this.form?.get('total_marks')?.value) || 0;
    if (allocatedMarks !== totalMarks) {
      this.toastr?.error(
        `Allocated question marks (${allocatedMarks}) must exactly match Total Marks (${totalMarks})`,
        undefined,
        this.toastOptions,
      );
      return;
    }
    if (this.form.invalid) {
      this.form?.markAllAsTouched();
      return;
    }

    const questions: any[] = [];
    if ((this.addedMcq?.() || []).length) {
      const mcqBuilt = this.addedMcq().map((q, index) => ({
        question_id: `mcq${index + 1}`,
        type: 'mcq',
        text: q.question.trim(),
        marks: this.normalizeMarks(q.marks as any),
        correct_answer: (q?.correct_answer || '').trim(),
        is_mandatory: !!q?.is_mandatory,
        options: (q?.options || [])
          ?.filter((v) => (v || '')?.trim() !== '')
          ?.map((v) => ({ option_text: v?.trim() })),
      }));
      questions?.push(...mcqBuilt);
    } else {
      const validMcqInline = (this.questions?.() || [])?.filter(
        (q) => (q?.text || '')?.trim() !== '',
      );
      const mcqInlineBuilt = validMcqInline?.map((q, index) => {
        const options = (q?.options || [])
          ?.filter((o) => (o?.value || '')?.trim() !== '')
          ?.map((o) => ({ option_text: o?.value.trim() }));
        const selectedOption = (q?.options || []).find(
          (o) => o?.key === q?.correct_answer,
        );
        const correctAnswerText = selectedOption
          ? (selectedOption.value || '').trim()
          : '';
        return {
          question_id: `mcq${index + 1}`,
          type: 'mcq',
          text: (q.text || '').trim(),
          marks: this.normalizeMarks(
            (q as any)?.marks ?? this.form.value.marks,
          ),
          correct_answer: correctAnswerText,
          is_mandatory: !!q?.is_mandatory,
          options,
        };
      });
      questions?.push(...mcqInlineBuilt);
    }
    if ((this.addedShort?.() || [])?.length) {
      const shortBuilt = this.addedShort()?.map((q, index) => ({
        question_id: `short${index + 1}`,
        type: 'short',
        text: (q?.question || '')?.trim(),
        marks: this.normalizeMarks(q.marks as any),
        is_mandatory: !!q?.is_mandatory,
      }));
      questions?.push(...shortBuilt);
    } else {
      const validShortInline = (this.shortQuestions?.() || [])?.filter(
        (q) => (q?.question || '')?.trim() !== '',
      );
      const shortInlineBuilt = validShortInline?.map((q, index) => ({
        question_id: `short${index + 1}`,
        type: 'short',
        text: (q.question || '').trim(),
        marks: this.normalizeMarks((q as any)?.marks ?? this.form.value.marks),
        is_mandatory: !!q?.is_mandatory,
      }));
      questions?.push(...shortInlineBuilt);
    }

    if ((this.addedLong?.() || [])?.length) {
      const longBuilt = this.addedLong()?.map((q, index) => ({
        question_id: `long${index + 1}`,
        type: 'long',
        long: (q?.question || '')?.trim(),
        text: (q?.question || '')?.trim(),
        marks: this.normalizeMarks(q.marks as any),
        correct_answer: '',
        is_mandatory: !!q?.is_mandatory,
      }));
      questions?.push(...longBuilt);
    } else if ((this.longQuestions?.() || [])?.length) {
      const validLongInline = (this.longQuestions?.() || [])?.filter(
        (q) => (q?.question || '')?.trim() !== '',
      );
      const longInlineBuilt = validLongInline?.map((q, index) => ({
        question_id: `long${index + 1}`,
        type: 'long',
        long: (q.question || '').trim(),
        text: (q.question || '').trim(),
        marks: this.normalizeMarks((q as any)?.marks ?? this.form.value.marks),
        correct_answer: '',
        is_mandatory: !!q?.is_mandatory,
      }));
      questions?.push(...longInlineBuilt);
    }

    if ((this.addedPractical?.() || [])?.length) {
      const practicalBuilt = this.addedPractical()?.map((q, index) => ({
        question_id: `practical${index + 1}`,
        type: 'practical',
        long: (q?.question || '')?.trim(),
        text: (q?.question || '')?.trim(),
        marks: this.normalizeMarks(q.marks as any),
        correct_answer: '',
        is_mandatory: !!q?.is_mandatory,
        image: q?.image || null,
        image_name: q?.imageName || null,
      }));
      questions?.push(...practicalBuilt);
    } else if ((this.practicalQuestions?.() || [])?.length) {
      const validPracticalInline = (this.practicalQuestions?.() || [])?.filter(
        (q) => (q?.question || '')?.trim() !== '',
      );
      const practicalInlineBuilt = validPracticalInline?.map((q, index) => ({
        question_id: `practical${index + 1}`,
        type: 'practical',
        long: (q.question || '').trim(),
        text: (q.question || '').trim(),
        marks: this.normalizeMarks((q as any)?.marks ?? this.form.value.marks),
        correct_answer: '',
        is_mandatory: !!q?.is_mandatory,
        image: (q as any)?.image || null,
        image_name: (q as any)?.imageName || null,
      }));
      questions?.push(...practicalInlineBuilt);
    }

    const examDateControl = this.form?.value?.exam_date;
    const formValue = { ...this.form?.value };
    const examStartTime = formValue.exam_start_time || '';

    let normalizedDate = '';
    let examStartDateTime: string | null = null;

    if (formValue.exam_date) {
      const dateObj = new Date(formValue.exam_date);
      normalizedDate = dateObj.toISOString();

      if (formValue.exam_start_time) {
        const [h, m] = formValue.exam_start_time.split(':').map(Number);
        dateObj.setHours(h, m, 0, 0);
        examStartDateTime = dateObj.toISOString();
      }
    }

    const testReviewer = formValue.reviewers || [];
    const reviewerList = Array.isArray(testReviewer)
      ? testReviewer.map((r: any) => ({
          id: r?.id,
          name: r?.name,
        }))
      : [];

    const examDate = normalizedDate;

    if (!questions.length) {
      this.toastr?.error(
        'Please add at least one question before saving the test',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const payload: any = {
      created_by: this.user_id,
      updated_by: this.user_id,
      ...formValue,
      reviewers: reviewerList,
      exam_date: examDate,
      date_time: examStartTime,
      exam_start_time: examStartDateTime || null,
      questions: questions?.length
        ? questions
        : this.isEditMode
          ? this.loadedQuestionsSnapshot || []
          : [],
      is_mandatory: false,
    };
    delete payload?.marks;
    const request$ =
      this.isEditMode && this.examId
        ? this.commonservice?.putCourse(
            `/eduforge/api/exam/${this.examId}`,
            payload,
          )
        : this.commonservice?.postCourse(
            `/eduforge/api/exams`,
            payload,
          );

    request$.subscribe(() => {
      this.toastr?.success(
        this.isEditMode
          ? 'Test updated successfully'
          : 'Test created successfully',
        undefined,
        this.toastOptions,
      );
      this.router?.navigate([this.workspaceNav.getTestListRoute()]);
    });
  }

  saveTestDetails() {
    this.metaControlNames.forEach((name) =>
      this.form.get(name)?.markAsTouched(),
    );
    const timeCtrl = this.form.get('exam_start_time');
    timeCtrl?.updateValueAndValidity({ onlySelf: true });
    if (timeCtrl?.hasError('timeInPast')) {
      this.toastr?.error(
        'Exam time cannot be in the past',
        undefined,
        this.toastOptions,
      );
      return;
    }

    if (!this.canSaveDetails()) {
      this.toastr?.error(
        'Please fill required fields',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const isUpdate = !!this.addedTestDetails;
    const v = this.form.value as any;
    const testReviewer = v?.reviewers || [];
    const selectedReviewers = (
      Array.isArray(testReviewer) ? testReviewer : [testReviewer]
    ).filter((r: any) => !!r);
    const reviewerNames: string[] = selectedReviewers
      .map((r: any) => {
        if (!r) return '';
        if (typeof r === 'string') return r;
        return this.formatReviewerName(r);
      })
      .filter((name: string) => !!name && !!name.trim());
    this.addedTestDetails = {
      title: v?.title || '',
      subject: v?.subject || '',
      reviewers: selectedReviewers,
      total_marks: v?.total_marks ?? null,
      passing_marks: v?.passing_marks ?? null,
      duration_minutes: v?.duration_minutes ?? null,
      attempt_limit: v?.attempt_limit ?? null,
      exam_date: this.formatToDDMMYYYY(v?.exam_date || ''),
      exam_start_time: this.normalizeTimeValue(v?.exam_start_time),
    };
    this.detailsSaved = true;
    this.toastr?.success(
      isUpdate ? 'Test details updated' : 'Test details saved',
      undefined,
      this.toastOptions,
    );
  }

  canSaveDetails(): boolean {
    return this.metaControlNames.every((name) => this.form.get(name)?.valid);
  }

  goBack() {
    this.router?.navigate([this.workspaceNav.getTestListRoute()]);
  }

  editTestDetails() {
    this.detailsSaved = false;
    if (this.addedTestDetails) {
      let isoDate = this.form.get('exam_date')?.value;
      if (
        this.addedTestDetails.exam_date &&
        this.addedTestDetails.exam_date.includes('-')
      ) {
        const parts = this.addedTestDetails.exam_date.split('-');
        if (parts[0].length === 4) {
          isoDate = this.addedTestDetails.exam_date;
        } else if (parts[2].length === 4) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      this.form.patchValue({
        title: this.addedTestDetails.title,
        subject: this.addedTestDetails.subject,
        reviewers: this.addedTestDetails.reviewers,
        total_marks: this.addedTestDetails.total_marks,
        passing_marks: this.addedTestDetails.passing_marks,
        duration_minutes: this.addedTestDetails.duration_minutes,
        attempt_limit: this.addedTestDetails.attempt_limit,
        exam_date: isoDate,
        exam_start_time: this.normalizeTimeValue(
          this.addedTestDetails.exam_start_time,
        ),
      });
      this.updateMinExamTime(isoDate);
    }
  }

  addQuestion() {
    const currentQuestions = this.questions();
    const newKey =
      currentQuestions.length > 0
        ? Math.max(...currentQuestions?.map((q) => q.key)) + 1
        : 1;
    const newQuestion = {
      key: newKey,
      text: '',
      options: [
        { key: 'A', value: '', label: 'Option' },
        { key: 'B', value: '', label: 'Option' },
      ],
      correct_answer: null,
      is_mandatory: true,
      touched: false,
    };
    this.questions?.set([...currentQuestions, newQuestion]);
  }

  removeQuestion(key: number) {
    const currentQuestions = this.questions();
    const filtered = currentQuestions.filter((q) => q.key !== key);
    this.questions?.set(filtered);
  }

  setQuestionText(key: number, value: string) {
    const currentQuestions = this.questions();
    const nextQuestions = currentQuestions.map((q) =>
      q?.key === key ? { ...q, text: value } : q,
    );
    this.questions?.set(nextQuestions);
  }

  markQuestionTouched(key: number) {
    const currentQuestions = this.questions();
    const nextQuestions = currentQuestions.map((q) =>
      q?.key === key ? { ...q, touched: true } : q,
    );
    this.questions?.set(nextQuestions);
  }

  addQuizOption(questionKey: number) {
    const currentQuestions = this.questions();
    const idx = currentQuestions.findIndex((q) => q?.key === questionKey);
    if (idx === -1) return;
    const question = currentQuestions[idx];
    if (question?.options.length >= 4) return;
    const newKey = String.fromCharCode(65 + question?.options?.length);
    const nextQuestion = {
      ...question,
      options: [
        ...question.options,
        { key: newKey, value: '', label: 'Option' },
      ],
    };
    const next = [...currentQuestions];
    next[idx] = nextQuestion;
    this.questions?.set(next);
  }

  setQuestionMarks(questionKey: number, value: string | number) {
    const numericMarks = value === '' || value === null ? null : Number(value);
    const total = Number(this.form.get('total_marks')?.value) || 0;
    const currentQuestions = this.questions();
    const idx = currentQuestions.findIndex((q) => q.key === questionKey);
    if (idx === -1) return;
    const question = currentQuestions[idx];
    let finalMarks = numericMarks;
    if (numericMarks !== null && numericMarks > total && total > 0) {
      finalMarks = total;
    }
    if (numericMarks !== null && numericMarks > 0) {
      this.marksErrors[`mcq_${questionKey}`] = false;
    }
    const nextQuestion = { ...question, marks: finalMarks } as any;
    const next = [...currentQuestions];
    next[idx] = nextQuestion;
    this.questions?.set(next);
  }

  setQuestionMandatory(questionKey: number, isMandatory: boolean) {
    const currentQuestions = this.questions();
    const next = currentQuestions.map((q) =>
      q.key === questionKey ? { ...q, is_mandatory: isMandatory } : q,
    );
    this.questions?.set(next);
  }

  removeQuizOption(questionKey: number, optionKey: string) {
    const currentQuestions = this.questions();
    const idx = currentQuestions?.findIndex((q) => q?.key === questionKey);
    if (idx === -1) return;
    const question = currentQuestions[idx];
    const filteredOptions = question?.options.filter(
      (o) => o.key !== optionKey,
    );
    const reordered = filteredOptions.map((option, index) => ({
      ...option,
      key: String.fromCharCode(65 + index),
      label: 'Option',
    }));
    const nextQuestion = { ...question, options: reordered };
    const next = [...currentQuestions];
    next[idx] = nextQuestion;
    this.questions?.set(next);
  }

  setQuizOption(questionKey: number, optionKey: string, value: string) {
    const newValue = ((value ?? '') + '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+/, '');

    const currentQuestions = this.questions();
    const idx = currentQuestions.findIndex((q) => q.key === questionKey);
    if (idx === -1) return;
    const question = currentQuestions[idx];
    const changedOptions = question.options.map((o) =>
      o.key === optionKey ? { ...o, value: newValue } : o,
    );
    const nextQuestion = { ...question, options: changedOptions };
    const next = [...currentQuestions];
    next[idx] = nextQuestion;
    this.questions.set(next);
  }

  setQuestionCorrectAnswer(questionKey: number, correctAnswer: string) {
    const currentQuestions = this.questions();
    const nextQuestions = currentQuestions.map((q) =>
      q.key === questionKey ? { ...q, correct_answer: correctAnswer } : q,
    );
    this.questions?.set(nextQuestions);
  }

  shortQuestions = signal<
    Array<{
      key: number;
      question: string;
      marks?: number | null;
      is_mandatory?: boolean;
      touched?: boolean;
    }>
  >([
    { key: 1, question: '', marks: null, is_mandatory: true, touched: false },
  ]);

  addShortQuestion() {
    const current = this.shortQuestions();
    const newKey =
      current?.length > 0 ? Math.max(...current.map((q) => q.key)) + 1 : 1;
    this.shortQuestions.set([...current]);
  }

  removeShortQuestion(key: number) {
    const current = this.shortQuestions();
    this.shortQuestions?.set(current.filter((q) => q.key !== key));
  }

  setShortQuestionText(key: number, value: string) {
    const current = this.shortQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, question: value } : q,
    );
    this.shortQuestions.set(next);
  }

  markShortTouched(key: number) {
    const current = this.shortQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, touched: true } : q,
    );
    this.shortQuestions.set(next);
  }

  setShortMarks(key: number, value: string | number) {
    const numericMarks = value === '' || value === null ? null : Number(value);
    const total = Number(this.form.get('total_marks')?.value) || 0;
    let finalMarks = numericMarks;
    if (numericMarks !== null && numericMarks > total && total > 0) {
      finalMarks = total;
    }
    if (numericMarks !== null && numericMarks > 0) {
      this.marksErrors[`short_${key}`] = false;
    }
    const current = this.shortQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, marks: finalMarks } : q,
    );
    this.shortQuestions.set(next);
  }

  setShortMandatory(key: number, isMandatory: boolean) {
    const current = this.shortQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, is_mandatory: isMandatory } : q,
    );
    this.shortQuestions.set(next);
  }
  longQuestions = signal<
    Array<{
      key: number;
      question: string;
      marks?: number | null;
      is_mandatory?: boolean;
      touched?: boolean;
    }>
  >([
    { key: 1, question: '', marks: null, is_mandatory: true, touched: false },
  ]);

  addLongQuestion() {
    const current = this.longQuestions();
    const newKey =
      current?.length > 0 ? Math.max(...current.map((q) => q.key)) + 1 : 1;
    this.longQuestions.set([...current]);
  }

  removeLongQuestion(key: number) {
    const current = this.longQuestions();
    this.longQuestions?.set(current.filter((q) => q.key !== key));
  }

  setLongQuestionText(key: number, value: string) {
    const current = this.longQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, question: value } : q,
    );
    this.longQuestions.set(next);
  }

  markLongTouched(key: number) {
    const current = this.longQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, touched: true } : q,
    );
    this.longQuestions.set(next);
  }

  setLongMarks(key: number, value: string | number) {
    const marks = value === '' || value === null ? null : Number(value);
    const total = Number(this.form.get('total_marks')?.value) || 0;

    const finalMarks =
      marks !== null && total > 0 && marks > total ? total : marks;

    if (marks !== null && marks > 0) {
      this.marksErrors[`long_${key}`] = false;
    }

    this.longQuestions.set(
      this.longQuestions().map((q) =>
        q.key === key ? { ...q, marks: finalMarks } : q,
      ),
    );
  }

  setLongMandatory(key: number, isMandatory: boolean) {
    const current = this.longQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, is_mandatory: isMandatory } : q,
    );
    this.longQuestions.set(next);
  }

  addedLong = signal<
    Array<{ question: string; marks: number; is_mandatory: boolean }>
  >([]);

  addLongToList(questionKey: number) {
    const q = this.longQuestions().find((qq) => qq.key === questionKey);
    if (!q) return;

    const question = q.question?.trim();
    if (!question) {
      this.toastr?.error('Please enter question', undefined, this.toastOptions);
      return;
    }

    const rawMarks = q.marks ?? this.form.value.marks;
    const marksNum = Number(rawMarks);
    const total = Number(this.form.get('total_marks')?.value) || 0;

    if (!marksNum || marksNum <= 0) {
      this.marksErrors[`long_${questionKey}`] = true;
      return;
    }
    this.marksErrors[`long_${questionKey}`] = false;

    if (marksNum > total && total > 0) {
      this.toastr?.error(
        `Question marks (${marksNum}) cannot exceed Total Marks (${total})`,
        undefined,
        this.toastOptions,
      );
      return;
    }

    const marks = this.normalizeMarks(rawMarks);
    const isMandatory = !!q.is_mandatory;

    if (this.willExceedTotalMarks(marks, isMandatory)) {
      this.toastr?.error(
        'Allocated marks exceed Total Marks',
        undefined,
        this.toastOptions,
      );
      return;
    }
    const entry = { question, marks, is_mandatory: isMandatory };

    const updated = [...this.addedLong()];
    const idx = this.editingLongIndex;
    const isEdit = idx !== null;
    idx !== null ? updated.splice(idx, 0, entry) : updated.push(entry);

    this.addedLong.set(updated);

    const nextKey = updated.length + 1;
    this.longQuestions.set(
      this.longQuestions().map((qq) =>
        qq.key === questionKey
          ? {
              ...qq,
              key: nextKey,
              question: '',
              marks: null,
              is_mandatory: true,
              touched: false,
            }
          : qq,
      ),
    );

    this.editingLongIndex = null;

    const message = isEdit
      ? 'Question updated successfully'
      : 'Question saved successfully';
    this.toastr?.success(message, undefined, this.toastOptions);
  }

  editAddedLong(index: number) {
    const item = this.addedLong()?.[index];
    if (!item) return;

    this.form?.get('type')?.setValue('Long');

    let lqs = this.longQuestions();
    const emptyIndex = () => lqs.findIndex((q) => !q.question?.trim());

    let idx = emptyIndex();

    if (idx === -1) {
      this.addLongQuestion();
      lqs = this.longQuestions();
      idx = emptyIndex();
      if (idx === -1) return;
    }

    const next = [...lqs];
    next[idx] = {
      key: index + 1,
      question: item.question,
      marks: item.marks,
      is_mandatory: !!item.is_mandatory,
    };

    this.longQuestions.set(next);
    this.editingLongIndex = index;
    this.removeAddedLong(index);
  }

  removeAddedLong(index: number) {
    const current = this.addedLong();
    const filtered = current.filter((_, i) => i !== index);
    this.addedLong.set(filtered);
  }

  practicalQuestions = signal<
    Array<{
      key: number;
      question: string;
      marks?: number | null;
      is_mandatory?: boolean;
      image?: string | null;
      imageName?: string | null;
      touched?: boolean;
    }>
  >([]);

  addPracticalQuestion() {
    const current = this.practicalQuestions();
    const newKey =
      current?.length > 0 ? Math.max(...current.map((q) => q.key)) + 1 : 1;
    this.practicalQuestions.set([...current]);
  }

  removePracticalQuestion(key: number) {
    this.practicalQuestions.set(
      this.practicalQuestions().filter((q) => q.key !== key),
    );
  }

  setPracticalQuestionText(key: number, value: string) {
    const current = this.practicalQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, question: value } : q,
    );
    this.practicalQuestions.set(next);
  }

  markPracticalTouched(key: number) {
    const current = this.practicalQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, touched: true } : q,
    );
    this.practicalQuestions.set(next);
  }

  setPracticalMarks(key: number, value: string | number) {
    const marks = value === '' || value === null ? null : Number(value);
    const total = Number(this.form.get('total_marks')?.value) || 0;

    const finalMarks =
      marks !== null && total > 0 && marks > total ? total : marks;

    this.marksErrors[`practical_${key}`] =
      marks !== null && marks > 0
        ? false
        : this.marksErrors[`practical_${key}`];

    this.practicalQuestions.set(
      this.practicalQuestions().map((q) =>
        q.key === key ? { ...q, marks: finalMarks } : q,
      ),
    );
  }

  setPracticalMandatory(key: number, isMandatory: boolean) {
    const current = this.practicalQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, is_mandatory: isMandatory } : q,
    );
    this.practicalQuestions.set(next);
  }

  async handlePracticalImageChange(key: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      this.removePracticalImage(key);
      if (input) input.value = '';
      return;
    }

    try {
      const image = await this.readFileAsDataURL(file);

      this.practicalQuestions.set(
        this.practicalQuestions().map((q) =>
          q.key === key ? { ...q, image, imageName: file.name } : q,
        ),
      );
    } catch {
      this.toastr?.error(
        'Unable to read selected image',
        undefined,
        this.toastOptions,
      );
    } finally {
      if (input) input.value = '';
    }
  }

  removePracticalImage(key: number) {
    const current = this.practicalQuestions();
    const next = current.map((q) =>
      q.key === key ? { ...q, image: null, imageName: null } : q,
    );
    this.practicalQuestions.set(next);
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  addedPractical = signal<
    Array<{
      question: string;
      marks: number;
      is_mandatory: boolean;
      image?: string | null;
      imageName?: string | null;
    }>
  >([]);

  addPracticalToList(questionKey: number) {
    const q = this.practicalQuestions().find((qq) => qq.key === questionKey);
    if (!q) return;

    const question = q.question?.trim() || '';
    if (!question) {
      this.toastr?.error('Please enter question', undefined, this.toastOptions);
      return;
    }

    const rawMarks = q.marks ?? this.form.value.marks;
    const marksNum = Number(rawMarks);

    if (!Number.isFinite(marksNum) || marksNum <= 0) {
      this.marksErrors[`practical_${questionKey}`] = true;
      return;
    }
    this.marksErrors[`practical_${questionKey}`] = false;

    const totalMarks = Number(this.form.get('total_marks')?.value) || 0;
    if (marksNum > totalMarks && totalMarks > 0) {
      this.toastr?.error(
        `Question marks (${marksNum}) cannot exceed Total Marks (${totalMarks})`,
        undefined,
        this.toastOptions,
      );
      return;
    }

    const marks = this.normalizeMarks(rawMarks);
    const isMandatory = !!q.is_mandatory;

    if (this.willExceedTotalMarks(marks, isMandatory)) {
      this.toastr?.error(
        'Allocated marks exceed Total Marks',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const entry = {
      question,
      marks,
      is_mandatory: isMandatory,
      image: q.image || null,
      imageName: q.imageName || null,
    };

    const updated = [...this.addedPractical()];
    const isEdit = this.editingPracticalIndex !== null;
    this.editingPracticalIndex !== null
      ? updated.splice(this.editingPracticalIndex, 0, entry)
      : updated.push(entry);

    this.addedPractical.set(updated);

    const nextKey = updated.length + 1;
    const next = this.practicalQuestions().map((qq) =>
      qq.key === questionKey
        ? {
            ...qq,
            key: nextKey,
            question: '',
            marks: null,
            is_mandatory: true,
            image: null,
            imageName: null,
            touched: false,
          }
        : qq,
    );

    this.practicalQuestions.set(next);
    this.editingPracticalIndex = null;

    const message = isEdit
      ? 'Question updated successfully'
      : 'Question saved successfully';
    this.toastr?.success(message, undefined, this.toastOptions);
  }

  private normalizeMarks(input: any): number {
    const num = Number(input);
    return Number.isFinite(num) && num >= 1 ? num : 1;
  }

  addedMcq = signal<
    Array<{
      question: string;
      options: string[];
      correct_answer: string;
      marks: number;
      is_mandatory: boolean;
    }>
  >([]);
  addedShort = signal<
    Array<{
      question: string;
      marks: number;
      is_mandatory: boolean;
    }>
  >([]);

  addMcqToList(questionKey: number) {
    const q = this.questions()?.find((qq) => qq.key === questionKey);
    if (!q) return;

    const question = q.text?.trim() || '';
    if (!question) {
      this.toastr?.error('Please enter question', undefined, this.toastOptions);
      return;
    }

    const nonEmptyOptions = (q.options || []).filter((o) => o.value?.trim());
    if (nonEmptyOptions.length < 2) {
      this.toastr?.error(
        'Please enter at least two options',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const correct_answer =
      q.options.find((o) => o.key === q.correct_answer)?.value?.trim() || '';

    if (!correct_answer) {
      this.toastr?.error(
        'Please select a correct answer',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const rawMarks = q.marks ?? this.form.value.marks;
    const marksNum = Number(rawMarks);

    if (!Number.isFinite(marksNum) || marksNum <= 0) {
      this.marksErrors[`mcq_${questionKey}`] = true;
      return;
    }
    this.marksErrors[`mcq_${questionKey}`] = false;

    const totalMarks = Number(this.form.get('total_marks')?.value) || 0;
    if (marksNum > totalMarks && totalMarks > 0) {
      this.toastr?.error(
        `Question marks (${marksNum}) cannot exceed Total Marks (${totalMarks})`,
        undefined,
        this.toastOptions,
      );
      return;
    }

    const marks = this.normalizeMarks(rawMarks);
    const isMandatory = !!q.is_mandatory;

    if (this.willExceedTotalMarks(marks, isMandatory)) {
      this.toastr?.error(
        'Allocated marks exceed Total Marks',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const entry = {
      question,
      options: nonEmptyOptions.map((o) => o.value.trim()),
      correct_answer,
      marks,
      is_mandatory: isMandatory,
    };

    const updated = [...this.addedMcq()];
    this.editingMcqIndex !== null
      ? updated.splice(this.editingMcqIndex, 0, entry)
      : updated.push(entry);

    this.addedMcq.set(updated);
    const nextKey = updated.length + 1;
    const isEdit = this.editingMcqIndex !== null;
    const next = this.questions().map((qq) =>
      qq.key === questionKey
        ? {
            key: nextKey,
            text: '',
            options: [
              { key: 'A', value: '', label: 'Option' },
              { key: 'B', value: '', label: 'Option' },
            ],
            correct_answer: null,
            is_mandatory: true,
            touched: false,
          }
        : qq,
    );

    this.questions.set(next);
    this.editingMcqIndex = null;

    const message = isEdit
      ? 'Question updated successfully'
      : 'Question saved successfully';
    this.toastr?.success(message, undefined, this.toastOptions);
  }

  addShortToList(questionKey: number) {
    const q = this.shortQuestions().find((qq) => qq.key === questionKey);
    if (!q) return;

    const question = q.question?.trim() || '';
    if (!question) {
      this.toastr?.error('Please enter question', undefined, this.toastOptions);
      return;
    }

    const rawMarks = q.marks ?? this.form.value.marks;
    const marksNum = Number(rawMarks);

    if (!Number.isFinite(marksNum) || marksNum <= 0) {
      this.marksErrors[`short_${questionKey}`] = true;
      return;
    }
    this.marksErrors[`short_${questionKey}`] = false;

    const totalMarks = Number(this.form.get('total_marks')?.value) || 0;
    if (marksNum > totalMarks && totalMarks > 0) {
      this.toastr?.error(
        `Question marks (${marksNum}) cannot exceed Total Marks (${totalMarks})`,
        undefined,
        this.toastOptions,
      );
      return;
    }

    const marks = this.normalizeMarks(rawMarks);
    const isMandatory = !!q.is_mandatory;

    if (this.willExceedTotalMarks(marks, isMandatory)) {
      this.toastr?.error(
        'Allocated marks exceed Total Marks',
        undefined,
        this.toastOptions,
      );
      return;
    }

    const updated = [...this.addedShort()];
    const newItem = { question, marks, is_mandatory: isMandatory };

    this.editingShortIndex !== null
      ? updated.splice(this.editingShortIndex, 0, newItem)
      : updated.push(newItem);

    this.addedShort.set(updated);

    const nextKey = updated.length + 1;
    const isEdit = this.editingShortIndex !== null;
    const next = this.shortQuestions().map((qq) =>
      qq.key === questionKey
        ? {
            ...qq,
            key: nextKey,
            question: '',
            marks: null,
            is_mandatory: true,
            touched: false,
          }
        : qq,
    );

    this.shortQuestions.set(next);
    this.editingShortIndex = null;

    const message = isEdit
      ? 'Question updated successfully'
      : 'Question saved successfully';
    this.toastr?.success(message, undefined, this.toastOptions);
  }

  editAddedMcq(index: number) {
    const item = this.addedMcq()?.[index];
    if (!item) return;

    this.form?.get('type')?.setValue('Mcq');

    const isEmptyMcq = (q: any) =>
      !q.text?.trim() && !(q.options || []).some((o: any) => o.value?.trim());

    let qs = this.questions();
    let idx = qs.findIndex(isEmptyMcq);
    if (idx === -1) {
      this.addQuestion();
      qs = this.questions();
      idx = qs.findIndex(isEmptyMcq);
      if (idx === -1) return;
    }

    const options = item.options.map((v: string, i: number) => ({
      key: String.fromCharCode(65 + i),
      value: v,
      label: 'Option',
    }));

    const correctKey =
      options.find((o: any) => o.value === item.correct_answer)?.key || null;

    const next = [...qs];
    next[idx] = {
      key: index + 1,
      text: item.question,
      options,
      correct_answer: correctKey,
      marks: item.marks,
      is_mandatory: !!item.is_mandatory,
    };

    this.questions.set(next);
    this.editingMcqIndex = index;
    this.removeAddedMcq(index);
  }

  removeAddedMcq(index: number) {
    const current = this.addedMcq();
    const filtered = current.filter((_, i) => i !== index);
    this.addedMcq.set(filtered);
  }

  editAddedShort(index: number) {
    const item = this.addedShort()?.[index];
    if (!item) return;

    this.form?.get('type')?.setValue('Short');

    let sqs = this.shortQuestions();
    let idx = sqs.findIndex((q) => !q.question?.trim());

    if (idx === -1) {
      this.addShortQuestion();
      sqs = this.shortQuestions();
      idx = sqs.findIndex((q) => !q.question?.trim());
      if (idx === -1) return;
    }

    const next = [...sqs];
    next[idx] = {
      key: index + 1,
      question: item.question,
      marks: item.marks,
      is_mandatory: !!item.is_mandatory,
    };

    this.shortQuestions.set(next);
    this.editingShortIndex = index;
    this.removeAddedShort(index);
  }

  removeAddedShort(index: number) {
    const current = this.addedShort();
    const filtered = current.filter((_, i) => i !== index);
    this.addedShort.set(filtered);
  }

  editAddedPractical(index: number) {
    const item = this.addedPractical()?.[index];
    if (!item) return;

    this.form?.get('type')?.setValue('Practical');

    let pqs = this.practicalQuestions();
    let idx = pqs.findIndex((q) => !q.question?.trim());

    if (idx === -1) {
      this.addPracticalQuestion();
      pqs = this.practicalQuestions();
      idx = pqs.findIndex((q) => !q.question?.trim());
      if (idx === -1) return;
    }

    const next = [...pqs];
    next[idx] = {
      key: index + 1,
      question: item.question,
      marks: item.marks,
      is_mandatory: !!item.is_mandatory,
      image: item.image ?? null,
      imageName: item.imageName ?? null,
    };

    this.practicalQuestions.set(next);
    this.editingPracticalIndex = index;
    this.removeAddedPractical(index);
  }

  removeAddedPractical(index: number) {
    const current = this.addedPractical();
    const filtered = current.filter((_, i) => i !== index);
    this.addedPractical.set(filtered);
  }

  private onTypeChange(newType: string) {
    const t = (newType || '').toLowerCase();
    if (t === 'mcq' && this.questions().length === 0) {
      this.questions?.set([
        {
          key: 1,
          text: '',
          options: [
            { key: 'A', value: '', label: 'Option' },
            { key: 'B', value: '', label: 'Option' },
          ],
          correct_answer: null,
          is_mandatory: true,
        },
      ]);
    }
    if (t === 'short' && this.shortQuestions()?.length === 0) {
      this.shortQuestions?.set([
        { key: 1, question: '', marks: null, is_mandatory: true },
      ]);
    }
    if (t === 'long' && this.longQuestions().length === 0) {
      this.longQuestions?.set([
        { key: 1, question: '', marks: null, is_mandatory: true },
      ]);
    }
    if (t === 'practical' && this.practicalQuestions().length === 0) {
      this.practicalQuestions?.set([
        {
          key: 1,
          question: '',
          marks: null,
          is_mandatory: true,
          image: null,
          imageName: null,
        },
      ]);
    }
  }

  private willExceedTotalMarks(nextMarks: number, isMandatory = true): boolean {
    if (!isMandatory) return false;
    const totalAllowed = Number(this.form?.get('total_marks')?.value) || 0;
    const allocated = this.getMandatoryAllocatedMarksTotal();
    return allocated + (Number(nextMarks) || 0) > totalAllowed;
  }

  private getMandatoryAllocatedMarksTotal(): number {
    return this.getAllocatedMarksTotal(false);
  }

  private getAllocatedMarksTotal(includeOptional = true): number {
    const sum = (arr: Array<{ marks: number; is_mandatory?: boolean }>) =>
      (arr || []).reduce((a, b) => {
        if (!includeOptional && b?.is_mandatory === false) return a;
        return a + (Number(b?.marks) || 0);
      }, 0);
    const mcq = sum(this.addedMcq());
    const shortQ = sum(this.addedShort());
    const longQ = sum(this.addedLong());
    const practicalQ = sum(this.addedPractical());
    return mcq + shortQ + longQ + practicalQ;
  }
  normalizeTimeValue(v: string | null | undefined): string {
    if (!v) return '';
    if (/^\d{2}:\d{2}$/.test(v)) return v;

    const d = new Date(v);
    return isNaN(d as any)
      ? ''
      : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  getExamTimeDisplay(v: string | Date | null | undefined): string {
    if (!v) return '';

    let date: Date;
    if (v instanceof Date) {
      date = v;
    } else if (/^\d{2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(':').map(Number);
      date = new Date();
      date.setHours(h, m, 0, 0);
    } else {
      date = new Date(v);
      if (isNaN(date.getTime())) return '';
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  getReviewerDisplay(r: any): string {
    const n = (x: any) =>
      !x
        ? ''
        : typeof x === 'string'
          ? x.trim()
          : x.name || `${x.first_name || ''} ${x.last_name || ''}`.trim();

    return Array.isArray(r) ? r.map(n).filter(Boolean).join(', ') : n(r);
  }

  getDurationDisplay(mins?: number | null): string {
    if (!mins || mins <= 0) return '';

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    const hText = h ? `${h} :${h > 1 ? 's' : ''}` : '';
    const mText = m ? `${m} min${m > 1 ? '' : ''}` : '';

    return [hText, mText].filter(Boolean).join(' ');
  }

  loadReviewers() {
    this.commonservice
      .getLocalUserMe()
      .subscribe({
        next: (res: any) => {
          const users = [res?.data].filter(Boolean);

          this.reviewerOptions = users
            ?.filter((u: any) => this.isTutorUser(u))
            ?.map((u: any) => ({
              id: u.id,
              name: `${u.first_name} ${u.last_name}`.trim(),
            }));
        },
        error: () => (this.reviewerOptions = []),
      });
  }

  private isTutorUser(user: any): boolean {
    if (['teacher', 'tutor', 'organization_admin', 'owner'].includes(user?.role)) {
      return true;
    }
    return (user?.user_mappings ?? []).some(
      (m: any) => m?.role?.name?.toLowerCase() === 'tutor',
    );
  }
  private formatReviewerName(user: any): string {
    if (!user) return '';

    const first = user?.first_name?.trim?.() || '';
    const last = user?.last_name?.trim?.() || '';
    const fullName = `${first} ${last}`.trim();

    if (fullName) return fullName;
    return user.name?.trim?.() || '';
  }

  openAiSidebar() {
    this.isAiSidebarOpen = true;
  }

  closeAiSidebar() {
    this.isAiSidebarOpen = false;
    this.aiPrompt = '';
  }

  generateTestWithAi() {
    if (!this.aiPrompt.trim()) {
      this.toastr.error(
        'Please enter a valid prompt (e.g., "10th history chapter 1 test")',
        undefined,
        this.toastOptions,
      );
      return;
    }

    this.isGeneratingAi = true;

    const payload = {
      query: this.aiPrompt,
      total_marks: Number(this.form.get('total_marks')?.value) || 20,
      level: 'medium',
    };

    this.commonservice.postAIApi('api/test/generate', payload).subscribe({
      next: (res: any) => {
        this.isGeneratingAi = false;
        this.closeAiSidebar();

        if (res?.status !== 'success' || !res?.data) {
          this.toastr.error(
            'Failed to generate test. Please try again with a clearer prompt.',
            undefined,
            this.toastOptions,
          );
          return;
        }

        this.bindAiResponse(res?.data);
      },
      error: () => {
        this.isGeneratingAi = false;
        this.toastr.error(
          'AI generation failed. Please check your prompt and try again.',
          undefined,
          this.toastOptions,
        );
      },
    });
  }

  private bindAiResponse(data: any) {
    this.form.patchValue({
      title: data?.title || '',
      subject: data?.subject || '',
      total_marks: data?.total_marks || 0,
      passing_marks: data?.passing_marks || 0,
      duration_minutes: data?.duration || 0,
      exam_date: this.minExamDate,
      exam_start_time: '10:00',
      type: 'mcq',
    });

    this.updateMinExamTime(this.minExamDate);
    this.syncTimeSelectionFromControl('10:00');

    const v = this.form.value;
    this.addedTestDetails = {
      title: v?.title,
      subject: v?.subject,
      reviewers: v?.reviewers,
      total_marks: v?.total_marks,
      passing_marks: v?.passing_marks,
      duration_minutes: v?.duration_minutes,
      attempt_limit: v?.attempt_limit,
      exam_date: this.formatToDDMMYYYY(v?.exam_date),
      exam_start_time: '10:00',
    };

    const mcqs: any[] = [];
    const shorts: any[] = [];
    const longs: any[] = [];

    (data.questions || []).forEach((q: any) => {
      if (q?.type === 'MCQ') {
        mcqs.push({
          question: q?.question,
          options: q?.options || [],
          correct_answer: q?.correct_answer,
          marks: q?.marks,
          is_mandatory: true,
        });
      }

      if (q?.type === 'SHORT') {
        shorts.push({
          question: q?.question,
          marks: q?.marks,
          is_mandatory: true,
        });
      }

      if (q?.type === 'LONG') {
        longs.push({
          question: q?.question,
          marks: q?.marks,
          is_mandatory: true,
        });
      }
    });

    this.addedMcq?.set(mcqs);
    this.addedShort?.set(shorts);
    this.addedLong?.set(longs);

    this.questions?.set([]);
    this.shortQuestions?.set([]);
    this.longQuestions?.set([]);

    this.detailsSaved = true;

    this.toastr.success(
      'Test generated successfully using AI',
      undefined,
      this.toastOptions,
    );
  }
}
