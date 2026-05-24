import { CommonHttpService } from './../services/common-http.service';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../shared/header.component';
import { Router } from '@angular/router';
import { STORAGEENUMS } from '../shared/enum';
import { StorageService } from '../services/storage-service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../services/skeleton-theme';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, NgxSkeletonLoaderComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  user_Id = '';
  address = signal<any>('--');
  client_Id = '';
  roleName = signal<string>('');
  userName = signal<any>(null);
  private route = inject(Router);
  timelineLoading = signal(true);
  profileData = signal<any>(null);
  timelineData = signal<any[]>([]);
  searchKey = signal<string>('');
  examProgress = signal<any>(null);
  actionProgress = signal<any>(null);
  courseProgress = signal<any>(null);
  private str = inject(StorageService);
  recentActivityData = signal<any>(null);
  public skeletonService = inject(SkeletonTheme);
  private commonHttp = inject(CommonHttpService);

  filteredTimelineData = computed(() => {
    const search = this.searchKey().toLowerCase().trim();
    if (!search) {
      return this.timelineData();
    }
    return this.timelineData().filter((item: any) => {
      const studentName = (item?.studentName || '').toLowerCase();
      const type = (item?.type || '').toLowerCase();
      const title = (item?.title || '').toLowerCase();
      const description = (item?.description || '').toLowerCase();
      const achievedMarks = (item?.raw?.achieved_marks != null ? String(item.raw.achieved_marks) : '').toLowerCase();

      return (
        studentName.includes(search) ||
        type.includes(search) ||
        title.includes(search) ||
        description.includes(search) ||
        achievedMarks.includes(search)
      );
    });
  });
  ngOnInit() {
    this.client_Id = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_Id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.getUserName();
    this.getLocalDashboardData();
  }

  getUserName() {
    this.commonHttp
      .getLocalUserMe()
      .subscribe({
        next: (res: any) => {
          console.log('[LocalDashboard] user hydration success', res?.data);
          const user = res?.data;
          this.userName?.set(user);
          const roleName = user?.role;
          this.roleName?.set(roleName);
          this.address?.set({ name: user?.organization?.name || '--' });
        },
        error: (err) => {
          console.warn(
            '[LocalDashboard] user hydration failed; using local storage',
            err,
          );
          this.userName?.set(this.str?.getItem(STORAGEENUMS.USER));
          this.roleName?.set(this.str?.getItem(STORAGEENUMS.ROLE) || '');
          this.address?.set('--');
        },
      });
  }

  getLocalDashboardData() {
    this.timelineLoading.set(true);
    this.commonHttp.getLocalDashboardMe().subscribe({
      next: (res: any) => {
        console.log('[LocalDashboard] dashboard hydration success', res?.data);
        const data = res?.data || {};
        const stats = data?.stats || {};

        this.profileData.set(data?.profile || { profileViews: 0 });
        this.timelineData.set(data?.timeline || []);
        this.recentActivityData.set({
          courses: [],
          tests: [],
          actionItems: [],
        });
        this.courseProgress.set({
          created: stats?.courses_created || 0,
          assigned: stats?.courses_assigned || 0,
          totalStudentsAssigned: stats?.total_students || 0,
          completedByStudents: stats?.completed_students || 0,
          pendingCompletion: stats?.pending_students || 0,
        });
        this.examProgress.set({
          created: 0,
          assigned: 0,
          totalStudentsAssigned: 0,
          submittedByStudents: 0,
          reviewedByTutor: 0,
          pendingReview: 0,
          pendingSubmission: 0,
        });
        this.actionProgress.set({
          created: 0,
          assigned: 0,
          totalStudentsAssigned: 0,
          submittedByStudents: 0,
          reviewedByTutor: 0,
          pendingReview: 0,
          pendingSubmission: 0,
        });
        this.timelineLoading.set(false);
      },
      error: (err) => {
        console.warn(
          '[LocalDashboard] dashboard hydration failed; using safe defaults',
          err,
        );
        this.profileData.set({ profileViews: 0 });
        this.timelineData.set([]);
        this.recentActivityData.set({
          courses: [],
          tests: [],
          actionItems: [],
        });
        this.courseProgress.set({
          created: 0,
          assigned: 0,
          totalStudentsAssigned: 0,
          completedByStudents: 0,
          pendingCompletion: 0,
        });
        this.timelineLoading.set(false);
      },
    });
  }

  getStudentData() {
    this.timelineLoading.set(true);
    this.commonHttp
      .getCourse(`/client/${this.client_Id}/dashboard/${this.user_Id}`)
      .subscribe({
        next: (res: any) => {
          this.profileData.set(res?.data?.profile);
          // this.timelineData.set(res?.data?.timeline ?? []);
          this.recentActivityData.set(res?.data?.recentCompletedActivity);
          this.timelineLoading.set(false);
        },
        error: (err) => {
          console.error('Error fetching dashboard data:', err);
          console.warn('[Dashboard] dashboard data failed; keeping authenticated shell');
          this.timelineLoading.set(false);
        },
      });
  }

  getTutorData() {
    this.commonHttp
      .getCourse(`/client/${this.client_Id}/tutor-dashboard/${this.user_Id}`)
      .subscribe({
        next: (res: any) => {
          this.examProgress.set(res?.data?.testProgress?.tests);
          this.actionProgress.set(res?.data?.testProgress?.actionItems);
          this.courseProgress.set(res?.data?.testProgress?.courses);
        },
        error: (err) => {
          console.error('Error fetching tutor dashboard data:', err);
          console.warn('[Dashboard] tutor dashboard data failed; keeping authenticated shell');
        },
      });
  }
  getPublicTimeLines() {
    (this,
      this.commonHttp
        .getCourse(`/client/${this.client_Id}/assignment/publish-timeline`)
        .subscribe({
          next: (res: any) => {
            this.timelineData.set(res?.data ?? []);
          },
          error: (err) => {
            console.error('Error fetching public timelines:', err);
            console.warn('[Dashboard] public timeline failed; keeping authenticated shell');
          },
        }));
  }

  getInitials(name: string | undefined): string {
    if (!name) return '';

    const words = name
      .trim()
      .split(' ')
      .filter((w) => w);

    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }

    const first = words[0][0];
    const last = words[words.length - 1][0];

    return (first + last).toUpperCase();
  }

  getProgressWidth(value: number): string {
    return value + '%';
  }
}
