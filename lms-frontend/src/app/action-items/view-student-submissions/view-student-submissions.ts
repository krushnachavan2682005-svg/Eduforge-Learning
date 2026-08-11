import {
  Component,
  computed,
  inject,
  Pipe,
  PipeTransform,
  signal,
} from '@angular/core';
import { Tooltip } from '../../shared/tooltip';
import { CommonModule } from '@angular/common';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { ToastrService } from 'ngx-toastr';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { SidebarService } from '../../services/sidebar.service';
import { StorageService } from '../../services/storage-service';
import { Modal } from '../../modal/modal';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/header.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    return this.sanitizer?.bypassSecurityTrustResourceUrl(url);
  }
}

@Component({
  selector: 'app-view-student-submissions',
  standalone: true,
  imports: [
    Tooltip,
    CommonModule,
    Modal,
    FormsModule,
    SafeUrlPipe,
    HeaderComponent,
  ],
  templateUrl: './view-student-submissions.html',
  styleUrl: './view-student-submissions.scss',
})
export class ViewStudentSubmissions {
  user_id = '';
  client_id = '';
  approveScore = '';
  rejectComment = '';
  scoreError = false;
  showPdfModal = false;
  scoreTouched = false;

  rejectTouched = false;
  assignment: any = null;
  showRejectModal = false;
  showApproveModal = false;
  selectedItem: any = null;
  pdfUrl: string | null = null;
  selectedAssignment: any = null;
  isLoadingAction = signal(false);
  ActionItemList = signal<any[]>([]);
  searchKey = signal<string>('');

  filteredResults = computed(() => {
    const search = this.searchKey().toLowerCase().trim();
    const students = this.assignment?.student_assignments || [];

    if (!search) {
      return students;
    }

    return students.filter((studA: any) => {
      const studentName = (studA?.user_ids?.[0]?.name || '').toLowerCase();
      let status = (studA?.status || '').toLowerCase();
      if (status === 'assigned') {
        status = 'not submitted';
      }
      return studentName.includes(search) || status.includes(search);
    });
  });

  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private http = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);
  public sidebarService = inject(SidebarService);

  ngOnInit() {
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.client_id = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.assignment = history.state.assignment;

    console.log('Assignment:', this.assignment);

    this.assignment?.student_assignments?.forEach((s: any) => {
      s.subCardOpen = false;
    });
  }

  getAttachmentFolderName(path: string): string {
    if (!path) return '--';

    const parts = path.split('/');
    return parts.length >= 3 ? parts[1] : '--';
  }

  onRejectClick(item: any, studA: any) {
    this.selectedItem = item;
    this.selectedAssignment = studA;
    this.rejectComment = '';
    this.rejectTouched = false;
    this.showRejectModal = true;
  }

  onRejectBlur() {
    this.rejectTouched = true;
  }

  isRejectDisabled(): boolean {
    return !this.rejectComment.trim();
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.selectedItem = null;
    this.rejectComment = '';
  }
  onScoreBlur() {
    this.scoreTouched = true;
  }

  isApproveDisabled(): boolean {
    if (!this.approveScore || this.scoreError) {
      return true;
    }
    return false;
  }

  onScoreInput(event: any) {
    this.scoreTouched = true;
    const input = event.target as HTMLInputElement;
    let value = input.value;
    value = value.replace(/[^0-9]/g, '');
    if (value.length > 3) {
      value = value.slice(0, 3);
    }

    this.approveScore = value;
    input.value = value;

    if (this.selectedItem && this.selectedItem.total_score) {
      this.scoreError =
        Number(this.approveScore) > Number(this.selectedItem.total_score);
    } else {
      this.scoreError = false;
    }
  }

  headers = [
    {
      title: '',
      subtitle: 'REVIEW STUDENT SUBMISSIONS',
    },
  ];
  closePdfModal() {
    this.showPdfModal = false;
    this.pdfUrl = null;
  }

  closeApproveModal() {
    this.showApproveModal = false;
    this.selectedItem = null;
    this.approveScore = '';
  }

  confirmApproval() {
    if (!this.selectedItem) return;

    this.submitActionItem(this.selectedItem, 'APPROVED');
    this.closeApproveModal();
  }

  confirmRejection() {
    if (!this.selectedAssignment) return;

    this.selectedAssignment.comment = this.rejectComment;

    this.submitActionItem(this.selectedAssignment, 'REJECTED');

    this.closeRejectModal();
  }
  submitActionItem(Item: any, action: 'APPROVED' | 'REJECTED') {
    this.isLoadingAction?.set(true);
    const assignment = this.selectedAssignment;
    const student_Id = assignment?.user_ids[0]?.id;

    const payload = {
      assigned_action_item_id: assignment?.assignment_id,
      status: action,
      comment:
        action === 'REJECTED'
          ? this.rejectComment
          : assignment?.comment || 'Approved',
      attachment: assignment?.attachment || [],
      ...(action === 'APPROVED' &&
        this.approveScore && { score: this.approveScore }),
    };

    this.http
      .putCourse(
        `/eduforge/api/update-assigned-action-status/${student_Id}`,
        payload,
      )
      .subscribe({
        next: () => {
          this.toastr.success(
            `Assignment ${action?.toLowerCase()} successfully`,
          );
          // this.getAllActionItems();
          this.isLoadingAction?.set(false);
        },
        error: (err) => {
          console.error('Action failed', err);
          this.toastr.error('Failed to update action item');
          this.isLoadingAction?.set(false);
        },
      });
  }

  onApproveClick(item: any, studA: any) {
    this.selectedItem = item;
    this.selectedAssignment = studA;
    this.approveScore = '';
    this.scoreError = false;
    this.scoreTouched = false;
    this.showApproveModal = true;
  }

  openPdf(url: string) {
    this.pdfUrl = url;
    this.showPdfModal = true;
    this.ActionItemList.update((list) =>
      list?.map((i) => ({
        ...i,
        selectedPdfUrl: i === url || null,
      })),
    );
  }
}
