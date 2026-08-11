import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Tooltip } from '../../shared/tooltip';

@Component({
  selector: 'app-add-level',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, Tooltip],
  templateUrl: './add-level.html',
  styleUrl: './add-level.scss',
})
export class AddLevel implements OnInit, OnChanges {
  @Input() show = false;
  @Output() closePopUp = new EventEmitter<void>();
  @Output() levelAdded = new EventEmitter<any>();
  clientId = '';
  showModal = false;
  isLoading = false;
  isSidebarOpen = false;
  levelForm!: FormGroup;
  deletLevel: boolean = false;
  allLevels = signal<any[]>([]);
  selectedLevelId: string | null = null;

  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS.CLIENT_ID) || '';
    this.levelForm = this.fb.group({
      level_name: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(?!.*[!&,._@/]{2,})(?!.*[!&,._@/]$)[A-Za-z0-9\s!&,._@/]+$/,
          ),
        ],
      ],
    });
    this.getLevels();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && changes['show'].currentValue) {
      this.openSidebar();
    }
  }

  openSidebar() {
    this.isSidebarOpen = true;
    this.showModal = true;
  }

  getLevels() {
    this.commonHttp.getCourse(`/level`).subscribe({
      next: (res: any) => {
        const levels = res?.data?.map((l: any) => ({
          ...l,
        }));
        this.allLevels.set(levels);
      },
    });
  }

  deleteLevel(id: string) {
    this.commonHttp
      .delete(`/level/${id}`, {})
      .subscribe({
        next: () => {
          const updated = this.allLevels().filter((l) => l?.id !== id);
          this.allLevels.set(updated);
          this.toastr.success('Level deleted successfully');
        },
        error: (err) => {
          const msg = err?.error?.message || 'failed to Delete';
          this.toastr?.error(msg);
        },
      });
  }

  openDeleteModel(level: any) {
    this.deletLevel = true;
  }

  editLevel(level: any) {
    this.selectedLevelId = level?.id;

    this.levelForm.patchValue({
      level_name: level?.level_name,
    });

    this.openSidebar();
  }

  submitForm() {
    if (this.levelForm.invalid) {
      this.levelForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const today = new Date()?.toISOString();

    const payload = {
      ...this.levelForm?.value,
      start_date: today,
      end_date: today,
    };

    if (this.selectedLevelId) {
      this.commonHttp
        .putCourse(
          `/level/${this.selectedLevelId}`,
          payload,
        )
        .subscribe({
          next: () => {
            this.toastr.success('Level updated successfully');
            this.afterSave();
          },
          error: (err) => {
            this.isLoading = false;
            const msg = err?.error?.message || 'failed to update';
            this.toastr?.error(msg);
          },
        });
    } else {
      this.commonHttp
        .postCourse(`/level`, payload)
        .subscribe({
          next: () => {
            this.toastr.success('Level added successfully');
            this.afterSave();
          },
          error: () => {
            this.toastr.error('Failed to add level');
            this.isLoading = false;
          },
        });
    }
  }

  afterSave() {
    this.isLoading = false;
    this.selectedLevelId = null;
    this.levelForm.reset();
    this.getLevels();
    this.closeSidebar();
  }

  closeSidebar() {
    this.isSidebarOpen = false;
    this.showModal = false;
    this.levelForm.reset();
    this.closePopUp.emit();
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
    this.levelForm?.get('title')?.setValue(v);
  }
}
