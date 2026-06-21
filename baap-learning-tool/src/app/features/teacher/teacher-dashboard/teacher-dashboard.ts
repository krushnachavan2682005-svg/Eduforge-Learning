import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { StorageService } from '../../../services/storage-service';
import { STORAGEENUMS } from '../../../shared/enum';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeader, StatCard],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Teacher Dashboard" subtitle="Create content, assign assessments, and review learning activity."></app-page-header>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Courses" [value]="courses()" icon="menu_book"></app-stat-card>
        <app-stat-card label="Tests" [value]="tests()" icon="assignment"></app-stat-card>
        <app-stat-card label="Action Items" [value]="actionItems()" icon="checklist"></app-stat-card>
        <app-stat-card label="Pending Reviews" [value]="reviews()" icon="rate_review"></app-stat-card>
      </div>

      <section class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        @for (item of shortcuts; track item.route) {
          <a class="group flex min-h-40 flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md" [routerLink]="item.route">
            <span class="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <i class="material-icons text-2xl">{{ item.icon }}</i>
            </span>
            <h2 class="text-lg font-extrabold text-slate-900">{{ item.label }}</h2>
            <p class="mt-2 flex-1 text-sm leading-6 text-slate-500">{{ item.description }}</p>
            <span class="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-teal-700">Open <i class="material-icons text-base transition group-hover:translate-x-1">arrow_forward</i></span>
          </a>
        }
      </section>
    </div>
  `,
})
export class TeacherDashboard {
  courses = signal(0);
  tests = signal(0);
  actionItems = signal(0);
  reviews = signal(0);
  private http = inject(CommonHttpService);
  private storage = inject(StorageService);
  shortcuts = [
    { label: 'Create Test', description: 'Build MCQ and theory assessments', icon: 'add_task', route: '/teacher/tests/create' },
    { label: 'View Tests', description: 'Manage tests you created', icon: 'assignment', route: '/teacher/tests' },
    { label: 'Assign Test', description: 'Assign tests to students or classes', icon: 'assignment_ind', route: '/teacher/tests/assign' },
    { label: 'Review Submissions', description: 'Score submitted descriptive answers', icon: 'rate_review', route: '/teacher/reviews' },
    { label: 'Courses', description: 'Create and manage learning content', icon: 'menu_book', route: '/teacher/courses' },
    { label: 'Action Items', description: 'Manage action item assignments', icon: 'checklist', route: '/teacher/action-items' },
    { label: 'Students', description: 'View students in this organization', icon: 'school', route: '/teacher/students' },
    { label: 'AI Tools Coming Soon', description: 'Prepare AI-assisted teacher workflows', icon: 'auto_awesome', route: '/teacher/ai-tools' },
  ];

  ngOnInit() {
    const clientId = this.storage.getItem<string>(STORAGEENUMS.CLIENT_ID) || '';
    const userId = this.storage.getItem<string>(STORAGEENUMS.USER_ID) || '';
    if (!clientId) return;
    this.http.getCourse(`/client/${clientId}/all-courses?page=1&limit=1`).subscribe((res: any) => this.courses.set(res?.pagination?.total || res?.items?.length || 0));
    this.http.getCourse(`/client/${clientId}/all-exams?page=1&limit=1`).subscribe((res: any) => this.tests.set(res?.total || res?.data?.length || res?.exams?.length || 0));
    this.http.getCourse(`/client/${clientId}/action-items?page=1&limit=1`).subscribe((res: any) => this.actionItems.set(res?.data?.pagination?.total || res?.data?.items?.length || 0));
    if (userId) {
      this.http.getCourse(`/client/${clientId}/reviewer-dashboard/${userId}`).subscribe({
        next: (res: any) => this.reviews.set((res?.data || []).length),
        error: () => this.reviews.set(0),
      });
    }
  }
}
