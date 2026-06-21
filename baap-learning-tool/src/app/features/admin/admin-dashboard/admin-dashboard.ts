import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { StorageService } from '../../../services/storage-service';
import { STORAGEENUMS } from '../../../shared/enum';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeader, StatCard],
  template: `
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Organization Dashboard" subtitle="Members, students, classes, enrollments, and LMS operations in one workspace."></app-page-header>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Members" [value]="members()" icon="group"></app-stat-card>
        <app-stat-card label="Students" [value]="stats()?.total_students || 0" icon="school"></app-stat-card>
        <app-stat-card label="Classes" [value]="classes()" icon="groups"></app-stat-card>
        <app-stat-card label="Enrollments" [value]="stats()?.assigned_courses || 0" icon="assignment_turned_in"></app-stat-card>
      </div>

      <section class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (card of operationCards(); track card.route) {
          <a class="group flex min-h-44 flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md" [routerLink]="card.route">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-lg font-extrabold text-slate-900">{{ card.title }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-500">{{ card.description }}</p>
              </div>
              <span class="inline-flex min-w-12 justify-center rounded-2xl bg-slate-100 px-3 py-2 text-lg font-extrabold text-slate-900">{{ card.count }}</span>
            </div>
            <div class="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-teal-700">
              {{ card.action }}
              <span class="material-icons text-base transition group-hover:translate-x-1">arrow_forward</span>
            </div>
          </a>
        }
      </section>
    </div>
  `,
})
export class AdminDashboard {
  stats = signal<any>(null);
  members = signal(0);
  classes = signal(0);
  courses = signal<string | number>('—');
  tests = signal<string | number>('—');
  private http = inject(CommonHttpService);
  private storage = inject(StorageService);

  operationCards = signal<any[]>([]);

  ngOnInit() {
    const clientId = this.storage.getItem<string>(STORAGEENUMS.CLIENT_ID) || '';
    this.http.getLocalDashboardMe().subscribe((res: any) => {
      this.stats.set(res?.data?.stats || {});
      this.refreshCards();
    });
    this.http.getMembers({ limit: 1 }).subscribe((res: any) => {
      this.members.set(res?.data?.pagination?.total || 0);
      this.refreshCards();
    });
    this.http.getLocalClasses().subscribe((res: any) => {
      this.classes.set((res?.data || []).length);
      this.refreshCards();
    });
    if (clientId) {
      this.http.getCourse(`/client/${clientId}/all-courses?page=1&limit=1`).subscribe({
        next: (res: any) => {
          this.courses.set(res?.pagination?.total || res?.items?.length || 0);
          this.refreshCards();
        },
        error: () => this.refreshCards(),
      });
      this.http.getCourse(`/client/${clientId}/all-exams?page=1&limit=1`).subscribe({
        next: (res: any) => {
          this.tests.set(res?.total || res?.data?.length || res?.exams?.length || 0);
          this.refreshCards();
        },
        error: () => this.refreshCards(),
      });
    }
    this.refreshCards();
  }

  private refreshCards() {
    this.operationCards.set([
      {
        title: 'Members',
        description: 'Create teachers and students, manage access and roles.',
        count: this.members(),
        action: 'Manage Members',
        route: '/admin/members',
      },
      {
        title: 'Students',
        description: 'View student profiles created from member onboarding.',
        count: this.stats()?.total_students ?? 0,
        action: 'View Students',
        route: '/admin/students',
      },
      {
        title: 'Classes',
        description: 'Create classes and add students to them.',
        count: this.classes(),
        action: 'Manage Classes',
        route: '/admin/classes',
      },
      {
        title: 'Enrollments',
        description: 'Assign courses to students through local enrollments.',
        count: this.stats()?.assigned_courses ?? 0,
        action: 'Manage Enrollments',
        route: '/admin/enrollments',
      },
      {
        title: 'Courses',
        description: 'Use the existing course management module.',
        count: this.courses(),
        action: 'Open Courses',
        route: '/courses',
      },
      {
        title: 'Tests',
        description: 'Use the existing test creation and assignment module.',
        count: this.tests(),
        action: 'Open Tests',
        route: '/tests/test',
      },
    ]);
  }
}
