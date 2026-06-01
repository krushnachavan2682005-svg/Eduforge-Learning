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
    <div class="p-4">
      <app-page-header title="Teacher Dashboard" subtitle="Courses, tests, action items, and reviews"></app-page-header>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <app-stat-card label="Courses" [value]="courses()" icon="menu_book"></app-stat-card>
        <app-stat-card label="Tests" [value]="tests()" icon="assignment"></app-stat-card>
        <app-stat-card label="Action Items" [value]="actionItems()" icon="checklist"></app-stat-card>
        <app-stat-card label="Pending Reviews" [value]="reviews()" icon="rate_review"></app-stat-card>
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
    { label: 'AI Tools', description: 'Prepare AI-assisted teacher workflows', icon: 'auto_awesome', route: '/teacher/ai-tools' },
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
