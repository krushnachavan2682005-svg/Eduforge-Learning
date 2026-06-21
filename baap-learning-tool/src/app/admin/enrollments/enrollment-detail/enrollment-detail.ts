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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Enrollment Details" subtitle="Student course enrollment"></app-page-header>

      @if (isLoading()) {
        <div class="rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading enrollment...</div>
      } @else if (!enrollment()) {
        <app-empty-state title="Enrollment not found"></app-empty-state>
      } @else {
        <section class="max-w-5xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
          <div class="flex flex-col gap-5 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-teal-700">Enrollment</p>
              <h2 class="mt-2 text-2xl font-extrabold text-slate-900">{{ studentName(enrollment()) }}</h2>
              <p class="mt-2 text-sm leading-6 text-slate-500">{{ enrollment()?.course?.title || enrollment()?.course_id }}</p>
            </div>
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-3">
              <p class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Update Status</p>
              <div class="flex flex-col gap-2 sm:flex-row">
                <select class="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" [(ngModel)]="selectedStatus">
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  class="h-11 rounded-2xl bg-[#116466] px-5 text-sm font-extrabold text-white transition hover:bg-[#0f3554] disabled:opacity-60"
                  [disabled]="isSaving() || selectedStatus === enrollment()?.status"
                  (click)="updateStatus()"
                >
                  {{ isSaving() ? 'Saving...' : 'Update' }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
              <p class="mt-1"><span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-extrabold capitalize text-teal-700">{{ enrollment()?.status }}</span></p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Course ID</p>
              <p class="mt-1 break-all font-bold text-slate-900">{{ enrollment()?.course_id }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Enrolled At</p>
              <p class="mt-1 font-bold text-slate-900">{{ enrollment()?.enrolled_at | date: 'medium' }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Completed At</p>
              <p class="mt-1 font-bold text-slate-900">{{ enrollment()?.completed_at ? (enrollment()?.completed_at | date: 'medium') : '--' }}</p>
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
