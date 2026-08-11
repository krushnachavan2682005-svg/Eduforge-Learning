import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { StorageService } from '../../../services/storage-service';
import { STORAGEENUMS } from '../../../shared/enum';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeader, StatCard],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Student Dashboard" subtitle="Continue learning, complete tests, and track your progress."></app-page-header>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Assigned Courses" [value]="courses()" icon="book"></app-stat-card>
        <app-stat-card label="Assigned Tests" [value]="tests()" icon="assignment"></app-stat-card>
        <app-stat-card label="Action Items" [value]="actionItems()" icon="checklist"></app-stat-card>
        <app-stat-card label="Progress" [value]="progress() + '%'" icon="trending_up"></app-stat-card>
      </div>

      <section class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
export class StudentDashboard {
  courses = signal(0);
  tests = signal(0);
  actionItems = signal(0);
  progress = signal(0);
  private http = inject(CommonHttpService);
  private storage = inject(StorageService);
  shortcuts = [
    { label: 'My Learning', description: 'Continue assigned courses', icon: 'book', route: '/student/my-learning' },
    { label: 'Tests', description: 'Open assigned tests', icon: 'assignment', route: '/student/tests' },
    { label: 'Action Items', description: 'Track assigned tasks', icon: 'checklist', route: '/student/action-items' },
    { label: 'Progress', description: 'Review learning progress', icon: 'trending_up', route: '/student/progress' },
    { label: 'Resume', description: 'Manage your resume', icon: 'assignment_ind', route: '/student/resume' },
    { label: 'AI Tutor Coming Soon', description: 'Prepare AI-assisted learning', icon: 'auto_awesome', route: '/student/ai-tutor' },
  ];

  ngOnInit() {
    const clientId = this.storage.getItem<string>(STORAGEENUMS.CLIENT_ID) || '';
    const userId = this.storage.getItem<string>(STORAGEENUMS.USER_ID) || '';
    if (!clientId || !userId) return;
    this.http.getCourse(`/get-assigned-course-byuser/${userId}?page=1&limit=100`).subscribe((res: any) => {
      const data = res?.data || [];
      this.courses.set(data.length);
      const total = data.length || 0;
      const sum = data.reduce((acc: number, item: any) => acc + Number(item?.progress_percentage || 0), 0);
      this.progress.set(total ? Math.round(sum / total) : 0);
    });
    this.http.getCourse(`/assigned-exams/${userId}?page=1&limit=100`).subscribe((res: any) => this.tests.set((res?.data || []).length));
    this.http.getCourse(`/get-assigned-action-items-byuser/${userId}?page=1&limit=100`).subscribe((res: any) => this.actionItems.set((res?.data || []).length));
  }
}
