import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeader, EmptyState],
  template: `
    <div class="p-4">
      <app-page-header title="Class Details" subtitle="Class information and student management">
        @if (classItem()) {
          <a class="px-3 py-2 rounded theme-bg-secondary theme-border font-semibold" [routerLink]="['/admin/classes', classItem()?.id, 'students']">
            Manage Students
          </a>
        }
      </app-page-header>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary theme-border rounded">Loading class...</div>
      } @else if (!classItem()) {
        <app-empty-state title="Class not found"></app-empty-state>
      } @else {
        <section class="theme-bg-secondary theme-border rounded p-4 max-w-3xl">
          <h2 class="text-xl font-semibold">{{ classItem()?.name }}</h2>
          <p class="opacity-70 mt-2">{{ classItem()?.description || 'No description' }}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <p class="text-sm opacity-70">Created By</p>
              <p>{{ classItem()?.created_by || '--' }}</p>
            </div>
            <div>
              <p class="text-sm opacity-70">Students</p>
              <p>{{ classItem()?.student_count || 0 }}</p>
            </div>
            <div>
              <p class="text-sm opacity-70">Created At</p>
              <p>{{ classItem()?.created_at | date: 'medium' }}</p>
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
