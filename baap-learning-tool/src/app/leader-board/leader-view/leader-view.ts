import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { UserLocalService } from '../../services/user-local-service';
import { STORAGEENUMS } from '../../shared/enum';

interface UserProfile {
  name: string;
  profileImage: string;
  phone: string;
  qualification: string;
  email: string;
  location: string;
}

interface LearningOverview {
  currentCourses: number;
  creditScore: number;
  badges: number;
}

interface Course {
  name: string;
  progress: number;
  courseId: string;
}

interface ActionItem {
  id: string;
  title: string;
}

@Component({
  selector: 'app-leader-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leader-view.html',
  styleUrls: ['./leader-view.scss']
})
export class LeaderView implements OnInit {
  private commonHttp = inject(CommonHttpService);
  private str = inject(StorageService);
  private router = inject(Router);
  private userService = inject(UserLocalService);

  clientId = '';
  userId = '';
  
  profileImageError = signal<boolean>(false);

  userProfile = signal<UserProfile>({
    name: 'Vedant Kadam',
    profileImage: '',
    phone: '1234567890',
    qualification: 'BCA',
    email: 'pratik@gmail.com',
    location: 'Los Angeles, CA'
  });

  learningOverview = signal<LearningOverview>({
    currentCourses: 3,
    creditScore: 6,
    badges: 3
  });

  courseProgress = signal<Course[]>([
    { name: 'HTML', progress: 80, courseId: '1' },
    { name: 'CSS', progress: 50, courseId: '2' },
    { name: 'JAVASCRIPT', progress: 30, courseId: '3' }
  ]);

  actionItems = signal<ActionItem[]>([
    { id: '1', title: 'Watched Lecture 4 in Html' },
    { id: '2', title: 'Build a Responsive Personal Profile Page' },
    { id: '3', title: 'HTML & CSS Portfolio Webpage' },
    { id: '4', title: 'Responsive Web Design Assignment' }
  ]);

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || this.userService?.getUserId() || '';
  }

  private loadUserProfile() {
    this.commonHttp.getLocalUserMe()
      .subscribe({
        next: (res: any) => {
          const user = res?.user || res?.data || res;
          if (user) {
            this.userProfile.set({
              name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User',
              profileImage: user?.profile_image || '',
              phone: user?.phone || user?.phone_number || '',
              qualification: user?.qualification || '',
              email: user?.email || '',
              location: user?.location || ''
            });
          }
        },
        error: (err) => console.error('Error loading user profile:', err)
      });
  }

  private loadCourses() {
    this.commonHttp.getCourse(`/eduforge/api/get-assigned-course-byuser/${this.userId}`)
      .subscribe({
        next: (res: any) => {
          const courses = res?.data || [];
          
          // Update course progress
          const progressData = courses.slice(0, 3).map((c: any) => ({
            name: c?.title || c?.name || 'Course',
            progress: this.calculateProgress(c?.completed, c?.total),
            courseId: c?.course_id || c?.id || ''
          }));
          this.courseProgress.set(progressData);
          
          // Update learning overview
          this.learningOverview.update(overview => ({
            ...overview,
            currentCourses: courses.length
          }));
        },
        error: (err) => console.error('Error loading courses:', err)
      });
  }

  private loadActionItems() {
    this.commonHttp.getCourse(`/eduforge/api/action-items`)
      .subscribe({
        next: (res: any) => {
          const items = res?.data?.items || [];
          const formattedItems = items.slice(0, 4).map((item: any, index: number) => ({
            id: item?.id || String(index + 1),
            title: item?.title || item?.name || item?.description || 'Action Item'
          }));
          this.actionItems.set(formattedItems);
        },
        error: (err) => console.error('Error loading action items:', err)
      });
  }

  private calculateProgress(completed: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round(((completed || 0) / total) * 100);
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }




  onImageError() {
    this.profileImageError.set(true);
  }
}
