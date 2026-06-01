import {
  Component,
  EventEmitter,
  Output,
  signal,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  Pipe,
  PipeTransform,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Editor } from 'ngx-editor';
import { ToastrService } from 'ngx-toastr';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { combineLatest } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { HttpEventType } from '@angular/common/http';
import { Tooltip } from '../../shared/tooltip';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Pipe({
  name: 'stripHtml',
  standalone: true,
})
export class StripHtmlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value?.replace(/<[^>]+>/g, '');
  }
}

interface QuizOption {
  key: string;
  value: string;
  label: string;
}

interface Question {
  key: number;
  text: string;
  options: QuizOption[];
  correct_answer: string | null;
}

@Component({
  selector: 'app-add-section',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NgSelectModule,
    FormsModule,
    QuillModule,
    Tooltip,
    DragDropModule,
  ],
  providers: [StorageService],
  templateUrl: './add-section.html',
  styleUrl: './add-section.scss',
})
export class AddSection implements OnInit, OnDestroy {
  clientId = '';
  aiPrompt = '';
  editor: Editor;
  uploading = false;
  isLoading = false;
  isEditMode = false;
  uploadProgress = 0;
  courseId: string = '';
  lessonId: string = '';
  sectionId: string = '';
  isAiGenerating = false;
  isAiSidebarOpen = false;
  sectionForm!: FormGroup;
  enteredText: string = '';
  userId: string | null = null;
  selectedImage: string | null = null;
  selectedPdfFileName: string | null = null;
  showQuizQuestions = signal<boolean>(false);
  @Output() close = new EventEmitter<void>();
  selectedImageFileName: string | null = null;
  uploadStatus: 'success' | 'error' | null = null;
  @Output() lessonAdded = new EventEmitter<any>();
  uploadedFiles = signal<
    Array<{
      id?: string;
      sequence?: number;
      url: string;
      file_name: string;
      file_type: string;
      position?: 'left' | 'right' | 'center';
    }>
  >([]);

  contentTypeOptions: Array<{
    label: string;
    value: 'VIDEO' | 'IMAGE' | 'PDF' | 'TEXT';
  }> = [
    { label: 'Text', value: 'TEXT' },
    { label: 'Image', value: 'IMAGE' },
    { label: 'Video', value: 'VIDEO' },
    { label: 'PDF', value: 'PDF' },
  ];

  IMAGE_POSITION_OPTIONS: Array<{
    label: string;
    value: 'left' | 'right' | 'center';
  }> = [
    { label: 'Left', value: 'left' },
    { label: 'Right', value: 'right' },
    { label: 'Center', value: 'center' },
  ];

  savedQuestions = signal<Question[]>([]);
  questions = signal<Question[]>([
    {
      key: 1,
      text: '',
      options: [
        { key: 'A', value: '', label: 'Option' },
        { key: 'B', value: '', label: 'Option' },
      ],
      correct_answer: null,
    },
  ]);
  editingKey: number | null = null;

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ direction: 'rtl' }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ['link', 'image', 'video'],
      ['clean'],
    ],
    clipboard: {
      matchVisual: false,
    },
  };

  private router = inject(Router);
  private str = inject(StorageService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private fb: FormBuilder = inject(FormBuilder);
  private commonHttp = inject(CommonHttpService);
  private workspaceNav = inject(WorkspaceNavigationService);
  constructor() {
    this.editor = new Editor();
    this.sectionForm = this.fb?.group({
      title: ['', [Validators?.required, Validators?.minLength(3)]],
      duration: [
        '',
        [
          Validators.required,
          Validators.maxLength(3),
          Validators.pattern('^[0-9]+$'),
        ],
      ],
      contentType: [null, Validators.required],
      video_url: [''],
      description: [''],
      question: [''],
    });
  }

  ngOnInit() {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID);
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    combineLatest([this.route?.params, this.route.queryParams]).subscribe(
      ([params, queryParams]) => {
        this.sectionId = params['section_id'];
        this.lessonId = queryParams['lessonId'] || '';
        this.courseId = queryParams['courseId'] || '';
        this.isEditMode = queryParams['editMode'] === 'true';
        if (this.isEditMode && this.sectionId) {
          this.fetchSectionById();
        }
        const aiPrompt = queryParams['aiPrompt'];
        if (aiPrompt && !this.isEditMode) {
          this.handleAiGeneration(aiPrompt);
        }
      },
    );
    this.sectionForm.get('contentType')?.valueChanges.subscribe((value) => {
      this.resetOtherFields(value as string);
    });
    this.sectionForm.get('description')?.valueChanges.subscribe(() => {
      this.cdr?.detectChanges();
    });
  }

  ngOnDestroy() {
    this?.editor?.destroy();
  }

  handleAiGeneration(prompt: string) {
    this.isAiGenerating = true;
    setTimeout(() => {
      this.sectionForm.patchValue({
        title:
          'Generated: ' +
          (prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt),
        duration: '15',
        contentType: 'TEXT',
      });

      const contentUrl = `<p>This section was generated by AI using the prompt: <strong>${prompt}</strong></p><p>You can edit this content manually before saving.</p>`;
      this.sectionForm.get('description')?.setValue(contentUrl);

      this.uploadedFiles.set([
        {
          url: contentUrl,
          file_name: 'text',
          file_type: 'TEXT',
        },
      ]);

      this.savedQuestions.set([
        {
          key: 1,
          text: `What is the main topic of: ${prompt}?`,
          options: [
            { key: 'A', value: 'Option A', label: 'Option' },
            { key: 'B', value: 'Option B', label: 'Option' },
            { key: 'C', value: 'None of the above', label: 'Option' },
          ],
          correct_answer: 'A',
        },
      ]);

      this.showQuizQuestions.set(true);
      this.toastr.success(
        'AI generation complete. You can now review and save.',
      );
      this.isAiGenerating = false;
    }, 1500);
  }

  private resetOtherFields(currentContentType: string | null): void {
    if (currentContentType !== 'TEXT') {
      this.sectionForm.get('description')?.setValue('', { emitEvent: false });
      this.editor?.setContent('');
    }
    if (currentContentType !== 'VIDEO') {
      this.sectionForm.get('video_url')?.setValue('', { emitEvent: false });
    }
    if (currentContentType !== 'IMAGE') {
      this.selectedImageFileName = null;
    }
    if (currentContentType !== 'PDF') {
      this.selectedPdfFileName = null;
    }
  }
  get hasDescription(): boolean {
    const rawValue = this.sectionForm.get('description')?.value || '';
    if (!rawValue) return false;

    const hasImage = /<img\b[^>]*>/i.test(rawValue);
    const hasText = rawValue.replace(/<[^>]*>|&nbsp;/g, ' ').trim().length > 0;
    return hasText || hasImage;
  }

  toggleQuizQuestions() {
    this.showQuizQuestions?.set(!this?.showQuizQuestions());
  }

  saveQuestion() {
    const currentQuestions = this?.questions();
    let hasValid = false;
    for (const currentQuestion of currentQuestions) {
      if (!currentQuestion?.text?.trim()) {
        continue;
      }
      if (currentQuestion?.options?.some((opt) => !opt?.value?.trim())) {
        this.toastr.error('Please fill all options or remove empty ones');
        return;
      }
      const validOptions = currentQuestion?.options?.filter(
        (o) => o?.value?.trim() !== '',
      );
      if (validOptions?.length < 2) {
        this?.toastr?.error('Please add at least 2 options for each question');
        return;
      }
      if (!currentQuestion?.correct_answer) {
        this?.toastr?.error('Please select a correct answer for each question');
        return;
      }
      const savedQuestions = [...this.savedQuestions()];
      let questionToSave: Question;
      if (this.editingKey !== null) {
        const filtered = savedQuestions?.filter(
          (q) => q?.key !== this.editingKey,
        );
        questionToSave = { ...currentQuestion, key: this.editingKey };
        this.savedQuestions?.set(
          [...filtered, questionToSave]?.sort((a, b) => a?.key - b?.key),
        );
        this.toastr.success('Question updated successfully');
        this.editingKey = null;
      } else {
        const newKey =
          savedQuestions.length > 0
            ? Math?.max(...savedQuestions?.map((q) => q?.key)) + 1
            : 1;
        questionToSave = { ...currentQuestion, key: newKey };
        this.savedQuestions?.set(
          [...savedQuestions, questionToSave]?.sort((a, b) => a?.key - b?.key),
        );
        this.toastr.success('Question added successfully');
      }
      hasValid = true;
    }
    if (!hasValid) {
      this.toastr.error('Please enter at least one valid question');
      return;
    }
    this.questions?.set([
      {
        key: 1,
        text: '',
        options: [
          { key: 'A', value: '', label: 'Option' },
          { key: 'B', value: '', label: 'Option' },
        ],
        correct_answer: null,
      },
    ]);
  }

  addNewQuestion() {
    const currentQuestions = this.questions();
    const newKey =
      currentQuestions?.length > 0
        ? Math?.max(...currentQuestions?.map((q) => q?.key)) + 1
        : 1;
    const newQuestion: Question = {
      key: newKey,
      text: '',
      options: [
        { key: 'A', value: '', label: 'Option' },
        { key: 'B', value: '', label: 'Option' },
      ],
      correct_answer: null,
    };
    this?.questions?.set([...currentQuestions, newQuestion]);
  }
  editQuestion(key: number) {
    const questionToEdit = this.savedQuestions()?.find((q) => q?.key === key);
    if (questionToEdit) {
      this.questions?.set([questionToEdit]);
      this.editingKey = key;
      const updatedSaved = this.savedQuestions()?.filter((q) => q?.key !== key);
      this.savedQuestions?.set(updatedSaved);
    }
  }
  deleteQuestion(key: number) {
    const updatedSaved = this.savedQuestions()?.filter((q) => q?.key !== key);
    this.savedQuestions?.set(updatedSaved);
  }
  removeQuestion(key: number) {
    const currentQuestions = this?.questions();
    const filteredQuestions = currentQuestions?.filter((q) => q?.key !== key);
    this?.questions?.set(filteredQuestions);
  }

  // Update question text
  updateQuestionText(key: number, value: string) {
    const currentQuestions = this?.questions();
    const updatedQuestions = currentQuestions?.map((q) =>
      q?.key === key ? { ...q, text: value } : q,
    );
    this?.questions?.set(updatedQuestions);
  }

  // Add option to specific question
  addQuizOption(questionKey: number) {
    const currentQuestions = this?.questions();
    const questionIndex = currentQuestions?.findIndex(
      (q) => q?.key === questionKey,
    );
    if (questionIndex === -1) return;

    const question = currentQuestions[questionIndex];
    if (question?.options?.length >= 4) return;

    const newKey = String?.fromCharCode(65 + question?.options?.length);
    const newOption = { key: newKey, value: '', label: 'Option' };

    const updatedQuestion = {
      ...question,
      options: [...question?.options, newOption],
    };

    const updatedQuestions = [...currentQuestions];
    updatedQuestions[questionIndex] = updatedQuestion;
    this?.questions?.set(updatedQuestions);
  }

  // Remove option from specific question
  removeQuizOption(questionKey: number, optionKey: string) {
    const currentQuestions = this?.questions();
    const questionIndex = currentQuestions?.findIndex(
      (q) => q?.key === questionKey,
    );
    if (questionIndex === -1) return;

    const question = currentQuestions[questionIndex];
    const filteredOptions = question?.options?.filter(
      (option) => option?.key !== optionKey,
    );
    const reorderedOptions = filteredOptions?.map((option, index) => ({
      ...option,
      key: String?.fromCharCode(65 + index),
      label: `Option`,
    }));

    const updatedQuestion = {
      ...question,
      options: reorderedOptions,
    };

    const updatedQuestions = [...currentQuestions];
    updatedQuestions[questionIndex] = updatedQuestion;
    this?.questions?.set(updatedQuestions);
  }

  // Update option value for specific question
  updateQuizOption(questionKey: number, optionKey: string, value: string) {
    const currentQuestions = this?.questions();
    const questionIndex = currentQuestions?.findIndex(
      (q) => q?.key === questionKey,
    );
    if (questionIndex === -1) return;

    const question = currentQuestions[questionIndex];
    const updatedOptions = question?.options?.map((option) =>
      option?.key === optionKey ? { ...option, value } : option,
    );

    const updatedQuestion = {
      ...question,
      options: updatedOptions,
    };

    const updatedQuestions = [...currentQuestions];
    updatedQuestions[questionIndex] = updatedQuestion;
    this?.questions?.set(updatedQuestions);
  }

  updateQuestionCorrectAnswer(questionKey: number, correctAnswer: string) {
    const currentQuestions = this?.questions();
    const updatedQuestions = currentQuestions?.map((q) =>
      q?.key === questionKey ? { ...q, correct_answer: correctAnswer } : q,
    );
    this.questions?.set(updatedQuestions);
  }

  fetchSectionById() {
    this.isLoading = true;
    this.commonHttp
      .getCourse(`/client/${this.clientId}/section/${this.sectionId}`)
      .subscribe({
        next: (res: any) => {
          const data = res?.data;
          this.lessonId = data?.lesson_id?.id;
          this.sectionForm.patchValue({
            title: data?.title || '',
            duration: data?.duration || '',
          });

          this.uploadedFiles?.set(
            (data?.content_type || [])?.map((c: any) => ({
              id: c?.id,
              sequence: c?.sequence,
              url: c?.value,
              file_name:
                c?.type === 'TEXT' ? 'text' : c?.value?.split('/')?.pop(),
              file_type: c?.type,
              position: c?.position,
            })),
          );

          this.uploadedFiles()?.forEach((f) => {
            switch (f?.file_type) {
              case 'TEXT':
                this.sectionForm?.patchValue({ description: '' });
                this.editor?.setContent('');
                break;
              case 'VIDEO':
                break;
              case 'IMAGE':
                this.selectedImageFileName = f?.file_name;
                break;
              case 'PDF':
                this.selectedPdfFileName = f?.file_name;
                break;
            }
          });

          const files = this.uploadedFiles();

          if (files.length > 0) {
            this.sectionForm
              .get('contentType')
              ?.setValue(files[0]?.file_type, { emitEvent: true });
          }

          if (data?.quizzes?.length) {
            const quizData = data?.quizzes?.map((q: any, idx: number) => {
              const options = q?.options?.map((opt: string, i: number) => ({
                key: String?.fromCharCode(65 + i),
                label: 'Option ',
                value: opt,
              }));

              const correctAnswerKey =
                options?.find(
                  (option: any) =>
                    option?.value?.toLowerCase()?.trim() ===
                    q?.correct_answer?.toLowerCase()?.trim(),
                )?.key || null;

              return {
                key: idx + 1,
                text: q?.question,
                options,
                correct_answer: correctAnswerKey,
              };
            });
            this.savedQuestions?.set(quizData);
          }

          this.isLoading = false;
        },
        error: () => (this.isLoading = false),
      });
  }

  goBack() {
    if (this.lessonId) {
      this.router?.navigate([this.workspaceNav.getCourseViewSectionRoute(this.lessonId)], {
        queryParams: { courseId: this.courseId },
      });
    } else if (this?.courseId) {
      this.router?.navigate([this.workspaceNav.getCourseDetailRoute(this?.courseId)]);
    } else {
      this?.router?.navigate([this.workspaceNav.getCourseListRoute()]);
    }
  }

  handleAddQuiz() {
    if (!this.sectionForm.valid) {
      this.toastr.error('Please fill all required fields before adding quiz');
      return;
    }

    if (this.uploadedFiles()?.length === 0) {
      this.toastr.error(
        'Please fill and upload at least one content before adding quiz',
      );
      return;
    }
    this.toggleQuizQuestions();
  }

  submitsectionForm() {
    if (!this.sectionForm?.valid) return;
    if (this.uploadedFiles()?.length === 0) {
      this.toastr?.error(
        'Please add at least one content (Text, Image, Video, or PDF) to the section',
      );
      return;
    }
    this.isLoading = true;

    this.lessonId =
      this.lessonId || this.route?.snapshot?.queryParams['lessonId'];

    const formValue = this.sectionForm?.value;
    const contentTypeArray = this.uploadedFiles().reduce(
      (acc: any[], f, index) => {
        if ((f.file_type === 'IMAGE' || f.file_type === 'PDF') && !f.url) {
          return acc;
        }

        const isFileTypeWithKey =
          f.file_type === 'IMAGE' || f.file_type === 'PDF';

        const item: any = {
          type: f.file_type,
          value: f?.url,
          sequence: index + 1,
        };

        if (f.id) {
          item.id = f.id;
        }

        if (isFileTypeWithKey) {
          item.url = f.url;
        }

        if (f.file_type === 'IMAGE' && f.position) {
          item.position = f.position;
        }

        acc.push(item);
        return acc;
      },
      [],
    );

    const payload: any = {
      course_id: this.courseId,
      lesson_id: this.lessonId,
      title: formValue?.title,
      duration: Number(formValue?.duration),
      content_type: contentTypeArray,
    };

    const validQuestions = this.savedQuestions()?.filter(
      (q) => q?.text?.trim() !== '',
    );
    if (validQuestions?.length > 0) {
      payload.quizzes = validQuestions?.map((q) => {
        const options = q?.options
          ?.filter((o) => o?.value?.trim() !== '')
          ?.map((o) => o?.value);
        const selectedOption = q?.options?.find(
          (o) => o?.key === q?.correct_answer,
        );
        const correctAnswerText = selectedOption
          ? selectedOption?.value?.trim()
          : q?.correct_answer;
        return {
          question: q?.text?.trim(),
          options,
          correct_answer: correctAnswerText,
        };
      });
    }

    const request$ = this.isEditMode
      ? this.commonHttp.putCourse(
          `/client/${this.clientId}/section/${this.sectionId}`,
          payload,
        )
      : this.commonHttp.postCourse(`/client/${this.clientId}/section`, payload);

    request$.subscribe({
      next: (res: any) => {
        this.toastr?.success(
          this.isEditMode
            ? 'Section updated successfully'
            : 'Section Saved successfully',
          '',
          // { closeButton: false },
        );
        this.router?.navigate([this.workspaceNav.getCourseViewSectionRoute(this.lessonId)], {
          queryParams: { courseId: this.courseId },
        });
        this.sectionForm?.reset();
        this.uploadedFiles?.set([]);
        this.lessonAdded?.emit(res);
        this.goBack();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error', err);
        this.isLoading = false;
        this.toastr.error('Failed to save Section');
      },
    });
  }

  addVideoUrl(): void {
    const url: string = this?.sectionForm?.get('video_url')?.value?.trim();
    if (!url) {
      return;
    }
    let isValidUrl = false;
    try {
      const parsed = new URL(url);
      isValidUrl = !!parsed?.href;
    } catch (_) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      return;
    }
    if (this.uploadedFiles()?.some((f) => f?.url === url)) {
      this.sectionForm.get('video_url')?.setErrors({ duplicate: true });
      this.sectionForm.get('video_url')?.markAsTouched();
      return;
    }
    const derivedName = (() => {
      try {
        const u = new URL(url);
        const path = u?.pathname?.split('/')?.filter(Boolean);
        return path[path?.length - 1] || 'video-url';
      } catch {
        return 'video-url';
      }
    })();
    this.uploadedFiles?.update((files) => [
      ...files,
      {
        url,
        file_name: derivedName,
        file_type: 'VIDEO',
      },
    ]);

    const videoCtrl = this.sectionForm.get('video_url');
    if (videoCtrl) {
      videoCtrl.setValue('');
      try {
        videoCtrl.markAsPristine();
        videoCtrl.markAsUntouched();
      } catch {}
    }
  }

  editingItemIndex: number | null = null;

  addTextContent(): void {
    const descriptionValue: string =
      this.sectionForm.get('description')?.value || '';
    const trimmed = descriptionValue?.trim();
    if (!trimmed) return;
    const normalizedText = trimmed
      .replace(/&nbsp;/g, ' ')
      .replace(/<\/p>/g, '</p>\r\n');
    const displayName = 'text';

    this.uploadedFiles.update((files) => {
      const newFiles = [...files];
      const newItem = {
        url: normalizedText,
        file_name: displayName,
        file_type: 'TEXT',
      };

      if (
        this.editingItemIndex !== null &&
        this.editingItemIndex >= 0 &&
        this.editingItemIndex <= newFiles.length
      ) {
        newFiles.splice(this.editingItemIndex, 0, newItem);
      } else {
        newFiles.push(newItem);
      }
      return newFiles;
    });

    this.sectionForm.get('description')?.setValue('');
    this.editingItemIndex = null;
  }

  editTextContent(index: number): void {
    const files = this.uploadedFiles();
    const item = files[index];
    if (item && item.file_type === 'TEXT') {
      this.editingItemIndex = index;
      this.sectionForm.get('contentType')?.setValue('TEXT');
      this.sectionForm.get('description')?.setValue(item.url);
      this.uploadedFiles?.update((currentFiles) =>
        currentFiles?.filter((_, i) => i !== index),
      );
    }
  }

  onPdfFilesSelected(event: Event): void {
    const files = (event?.target as HTMLInputElement)?.files;
    if (!files || files?.length === 0) return;
    this.selectedPdfFileName =
      files?.length === 1 ? files[0]?.name : `${files?.length} PDFs selected`;
    this.uploadFiles(Array?.from(files), 'PDF');
    (event?.target as HTMLInputElement).value = '';
  }

  removeUploadedItem(index: number): void {
    const list = this.uploadedFiles();
    if (index < 0 || index >= list.length) return;
    const removedItem = list[index];

    this.uploadedFiles?.update((files) => files?.filter((_, i) => i !== index));

    if (removedItem?.file_type === 'IMAGE') {
      this.selectedImageFileName = null;
    }
    if (removedItem?.file_type === 'PDF') {
      this.selectedPdfFileName = null;
    }
  }

  onImageFilesSelected(event: Event): void {
    const files = (event?.target as HTMLInputElement)?.files;
    if (!files || files?.length === 0) return;
    this.selectedImageFileName =
      files?.length === 1 ? files[0]?.name : `${files?.length} Images selected`;
    this.uploadFiles(Array?.from(files), 'IMAGE');
    (event.target as HTMLInputElement).value = '';
    Array?.from(files)?.forEach((file) => {
      const tempUrl = URL?.createObjectURL(file);
      this.uploadedFiles?.update((files) => [
        ...files,
        {
          url: tempUrl,
          file_name: (file as File).name,
          file_type: 'IMAGE',
          position: 'left',
        },
      ]);
    });
  }
  updateImagePosition(index: number, newPosition: 'left' | 'right' | 'center') {
    this.uploadedFiles?.update((items) => {
      if (index >= 0 && index < items?.length) {
        const updatedItems = [...items];
        updatedItems[index] = { ...updatedItems[index], position: newPosition };
        return updatedItems;
      }
      return items;
    });
  }

  private uploadFiles(files: File[], fileType: string): void {
    files?.forEach((file) => {
      const formData = new FormData();
      formData?.append('file', file);
      this.uploading = true;
      this.uploadProgress = 0;
      this.uploadStatus = null;

      this.commonHttp.uploadCourseImage(`/upload`, formData).subscribe({
        next: (event: any) => {
          if (event?.type === HttpEventType?.UploadProgress && event?.total) {
            this.uploadProgress = Math?.round(
              (event?.loaded / event?.total) * 100,
            );
          }
          if (event?.type === HttpEventType?.Response) {
            this.uploading = false;
            this.uploadStatus = 'success';
            this.toastr?.success(`${fileType} uploaded successfully`);

            const data = event?.body?.data;
            const fileKey = data?.key;
            const presignedUrl = data?.presignedUrl;
            const fileName = file?.name;

            this.uploadedFiles?.update((files) => [
              ...files,
              {
                key: fileKey,
                url: fileKey,
                file_name: fileName,
                file_type: fileType,
                ...(fileType === 'IMAGE' ? { position: 'left' } : {}),
              },
            ]);

            this.toastr.success(`${fileType} uploaded successfully`);
            this.cdr?.detectChanges();
          }
        },
        error: () => {
          this.uploading = false;
          this.uploadStatus = 'error';
          this.toastr?.error(`Invalid ${fileType}.`);
        },
      });
    });
  }

  preventSpecialCharacters(event: any, fieldName: string) {
    const char = String?.fromCharCode(event?.which);
    const currentValue = (event?.target as HTMLInputElement)?.value;
    const cursorPosition =
      (event?.target as HTMLInputElement)?.selectionStart || 0;
    const allowedPattern = /^[a-zA-Z\s\-_]$/;

    if (!allowedPattern?.test(char)) {
      event?.preventDefault();
      return false;
    }
    if (char === ' ') {
      const charBefore = currentValue[cursorPosition - 1];
      if (charBefore === ' ' || cursorPosition === 0) {
        event?.preventDefault();
        return false;
      }
    }

    return true;
  }

  cleanInput(fieldName: string) {
    const currentValue = this.sectionForm?.get(fieldName)?.value;
    if (currentValue) {
      let cleanedValue = currentValue?.replace(/[^a-zA-Z\s\-_]/g, '');
      cleanedValue = cleanedValue?.replace(/\s+/g, ' ')?.trim();

      if (currentValue !== cleanedValue) {
        this.sectionForm?.get(fieldName)?.setValue(cleanedValue);
      }
    }
  }
  getOptionsString(question: Question): string {
    return question?.options?.map((opt) => opt?.value)?.join(', ');
  }
  getCorrectAnswer(question: Question): string {
    return (
      question?.options?.find((o) => o?.key === question?.correct_answer)
        ?.value ||
      question?.correct_answer ||
      ''
    );
  }

  drop(event: CdkDragDrop<string[]>) {
    this.uploadedFiles.update((files) => {
      const newFiles = [...files];
      moveItemInArray(newFiles, event.previousIndex, event.currentIndex);
      return newFiles;
    });
  }

  openAiSidebar() {
    this.isAiSidebarOpen = true;
  }

  closeAiSidebar() {
    this.isAiSidebarOpen = false;
    this.aiPrompt = '';
  }

  patchAiPrompt() {
    if (!this.aiPrompt.trim()) {
      this.toastr.error('Please enter a prompt');
      return;
    }

    const payload = {
      course_id: this.courseId,
      lesson_id: this.lessonId,
      title: this.aiPrompt,
      duration: Number(this.sectionForm.value.duration), // optional
    };

    this.isAiGenerating = true;

    this.commonHttp.postAIApi('api/generate-sections', payload).subscribe({
      next: (res: any) => {
        this.patchAiResponseToForm(res?.data);
        this.isAiSidebarOpen = false;
        this.aiPrompt = '';
        this.toastr.success('AI content generated successfully!');
        this.isAiGenerating = false;
      },
      error: (err) => {
        this.toastr.error('Please enter a valid content to generate section.');
        this.isAiGenerating = false;
      },
    });
  }

  patchAiResponseToForm(data: any) {
    if (!data) return;

    this.sectionForm.patchValue({
      title: data.title || '',
      duration: data.duration || '',
    });

    const uploaded: any[] = [];

    let detectedContentType: any = null;

    data.content_type?.forEach((item: any) => {
      if (!detectedContentType) {
        detectedContentType = item.type;
      }

      if (item.type === 'TEXT') {
        uploaded.push({
          url: item.value,
          file_name: 'text',
          file_type: 'TEXT',
        });
      }

      if (item.type === 'VIDEO') {
        uploaded.push({
          url: item.value,
          file_name: item.value.split('/').pop() || 'video',
          file_type: 'VIDEO',
        });
      }

      if (item.type === 'IMAGE') {
        uploaded.push({
          url: item.value,
          file_name: item.value.split('/').pop(),
          file_type: 'IMAGE',
          position: 'left',
        });
      }

      if (item.type === 'PDF') {
        uploaded.push({
          url: item.value,
          file_name: item.value.split('/').pop(),
          file_type: 'PDF',
        });
      }
    });
    this.uploadedFiles.set(uploaded);

    if (detectedContentType) {
      this.sectionForm.get('contentType')?.setValue(detectedContentType);
    }
    const firstText = data.content_type?.find((c: any) => c.type === 'TEXT');

    if (firstText) {
      this.sectionForm.get('description')?.setValue(firstText.value);
    }

    if (data.quizzes?.length) {
      const quizData = data.quizzes.map((q: any, idx: number) => {
        const options = q.options.map((opt: string, i: number) => ({
          key: String.fromCharCode(65 + i),
          value: opt,
          label: 'Option',
        }));

        const correctKey =
          options.find(
            (o: any) =>
              o.value.toLowerCase().trim() ===
              q.correct_answer.toLowerCase().trim(),
          )?.key || null;

        return {
          key: idx + 1,
          text: q.question,
          options,
          correct_answer: correctKey,
        };
      });

      this.savedQuestions.set(quizData);
      this.showQuizQuestions.set(true);
    }
  }
}
