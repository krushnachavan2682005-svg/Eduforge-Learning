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
    <div class="p-4">
      <app-page-header title="Student Dashboard" subtitle="Learning, tests, action items, and progress"></app-page-header>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <app-stat-card label="Assigned Courses" [value]="courses()" icon="book"></app-stat-card>
        <app-stat-card label="Assigned Tests" [value]="tests()" icon="assignment"></app-stat-card>
        <app-stat-card label="Action Items" [value]="actionItems()" icon="checklist"></app-stat-card>
        <app-stat-card label="Progress" [value]="progress() + '%'" icon="trending_up"></app-stat-card>
      </div>

      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        @for (item of shortcuts; track item.route) {
          <a class="theme-bg-secondary theme-border rounded p-4 block" [routerLink]="item.route">
            <div class="material-icons mb-2">{{ item.icon }}</div>
            <h2 class="font-semibold">{{ item.label }}</h2>
            <p class="text-sm opacity-70 mt-1">{{ item.description }}</p>
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
    { label: 'AI Tutor', description: 'Prepare AI-assisted learning', icon: 'auto_awesome', route: '/student/ai-tutor' },
  ];

  ngOnInit() {
    const clientId = this.storage.getItem<string>(STORAGEENUMS.CLIENT_ID) || '';
    const userId = this.storage.getItem<string>(STORAGEENUMS.USER_ID) || '';
    if (!clientId || !userId) return;
    this.http.getCourse(`/client/${clientId}/get-assigned-course-byuser/${userId}?page=1&limit=100`).subscribe((res: any) => {
      const data = res?.data || [];
      this.courses.set(data.length);
      const total = data.length || 0;
      const sum = data.reduce((acc: number, item: any) => acc + Number(item?.progress_percentage || 0), 0);
      this.progress.set(total ? Math.round(sum / total) : 0);
    });
    this.http.getCourse(`/client/${clientId}/assigned-exams/${userId}?page=1&limit=100`).subscribe((res: any) => this.tests.set((res?.data || []).length));
    this.http.getCourse(`/client/${clientId}/get-assigned-action-items-byuser/${userId}?page=1&limit=100`).subscribe((res: any) => this.actionItems.set((res?.data || []).length));
  }
}
