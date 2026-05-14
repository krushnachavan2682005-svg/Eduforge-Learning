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
    this.getTutorData();
    this.getStudentData();
    this.getPublicTimeLines();
  }

  getUserName() {
    this.commonHttp
      .getUser(`/auth/api/users/client/${this.client_Id}/user/${this.user_Id}`)
      .subscribe({
        next: (res: any) => {
          const user = res?.user;
          this.userName?.set(user);
          const roleName = user?.user_mappings?.[0]?.role?.name;
          this.roleName?.set(roleName);
          this.address?.set(user?.user_location_department?.[0]?.location);
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
