import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeader, EmptyState],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Class Details" subtitle="Class information and student management">
        @if (classItem()) {
          <a class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554]" [routerLink]="['/admin/classes', classItem()?.id, 'students']">
            Manage Students
          </a>
        }
      </app-page-header>

      @if (isLoading()) {
        <div class="rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading class...</div>
      } @else if (!classItem()) {
        <app-empty-state title="Class not found"></app-empty-state>
      } @else {
        <section class="max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
          <div class="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-teal-700">Class</p>
              <h2 class="mt-2 text-2xl font-extrabold text-slate-900">{{ classItem()?.name }}</h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{{ classItem()?.description || 'No description' }}</p>
            </div>
            <span class="rounded-2xl bg-teal-50 px-4 py-2 text-sm font-extrabold text-teal-700">{{ classItem()?.student_count || 0 }} students</span>
          </div>
          <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Created By</p>
              <p class="mt-1 font-bold text-slate-900">{{ classItem()?.created_by || '--' }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Students</p>
              <p class="mt-1 font-bold text-slate-900">{{ classItem()?.student_count || 0 }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Created At</p>
              <p class="mt-1 font-bold text-slate-900">{{ classItem()?.created_at | date: 'medium' }}</p>
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class ClassDetail {
  classItem = signal<any | null>(null);
  isLoading = signal(false);
  private route = inject(ActivatedRoute);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.isLoading.set(true);
    this.commonHttp.getClassById(id).subscribe({
      next: (res: any) => {
        this.classItem.set(res?.data || null);
        this.isLoading.set(false);
      },
      error: () => {
        this.classItem.set(null);
        this.isLoading.set(false);
      },
    });
  }
}
