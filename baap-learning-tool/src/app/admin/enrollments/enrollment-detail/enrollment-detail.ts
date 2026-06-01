import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-enrollment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeader, EmptyState],
  template: `
    <div class="p-4">
      <app-page-header title="Enrollment Details" subtitle="Student course enrollment"></app-page-header>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary theme-border rounded">Loading enrollment...</div>
      } @else if (!enrollment()) {
        <app-empty-state title="Enrollment not found"></app-empty-state>
      } @else {
        <section class="theme-bg-secondary theme-border rounded p-4 max-w-3xl">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">{{ studentName(enrollment()) }}</h2>
              <p class="opacity-70 mt-1">{{ enrollment()?.course?.title || enrollment()?.course_id }}</p>
            </div>
            <div class="flex gap-2">
              <select class="px-3 py-2 rounded theme-bg-gray theme-border" [(ngModel)]="selectedStatus">
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                class="px-4 py-2 rounded theme-bg-gray theme-border font-semibold"
                [disabled]="isSaving() || selectedStatus === enrollment()?.status"
                (click)="updateStatus()"
              >
                {{ isSaving() ? 'Saving...' : 'Update' }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <p class="text-sm opacity-70">Status</p>
              <p>{{ enrollment()?.status }}</p>
            </div>
            <div>
              <p class="text-sm opacity-70">Course ID</p>
              <p>{{ enrollment()?.course_id }}</p>
            </div>
            <div>
              <p class="text-sm opacity-70">Enrolled At</p>
              <p>{{ enrollment()?.enrolled_at | date: 'medium' }}</p>
            </div>
            <div>
              <p class="text-sm opacity-70">Completed At</p>
              <p>{{ enrollment()?.completed_at ? (enrollment()?.completed_at | date: 'medium') : '--' }}</p>
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class EnrollmentDetail {
  enrollment = signal<any | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  selectedStatus = 'assigned';
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.loadEnrollment();
  }

  loadEnrollment() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.isLoading.set(true);
    this.commonHttp.getEnrollmentById(id).subscribe({
      next: (res: any) => {
        const enrollment = res?.data || null;
        this.enrollment.set(enrollment);
        this.selectedStatus = enrollment?.status || 'assigned';
        this.isLoading.set(false);
      },
      error: () => {
        this.enrollment.set(null);
        this.isLoading.set(false);
      },
    });
  }

  updateStatus() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || !this.selectedStatus) return;
    this.isSaving.set(true);
    this.commonHttp.updateEnrollmentStatus(id, this.selectedStatus).subscribe({
      next: (res: any) => {
        const enrollment = res?.data || null;
        this.enrollment.set(enrollment);
        this.selectedStatus = enrollment?.status || this.selectedStatus;
        this.isSaving.set(false);
        this.toastr.success('Enrollment status updated');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastr.error(err?.error?.message || 'Failed to update status');
      },
    });
  }

  studentName(item: any) {
    const student = item?.student;
    const fullName = [student?.first_name, student?.last_name]
      .filter(Boolean)
      .join(' ');
    return fullName || student?.email || item?.student_id;
  }
}
