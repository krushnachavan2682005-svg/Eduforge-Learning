import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/header.component';
import { CommonHttpService } from '../../services/common-http.service';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { SkeletonTheme } from '../../services/skeleton-theme';

export interface Task {
  name: string;
  score: number;
}

export interface Level {
  level: number;
  period: string;
  score: number;
  expanded: boolean;
  tasks: Task[];
}

@Component({
  selector: 'app-credit-score',
  standalone: true,
  imports: [CommonModule, HeaderComponent, NgxSkeletonLoaderComponent],
  templateUrl: './credit-score.html',
  styleUrl: './credit-score.scss',
})
export class CreditScore {
  user = {
    class: 'FY BCA',
  };
  user_Id = '';
  client_Id = '';
  student = signal<any>(null);
  creditLoaded = signal(false);
  allLevels = signal<any[]>([]);
  isLoadingCredit = signal(false);
  creditScore = signal<string>('');
  allStudentCredit = signal<any[]>([]);
  private str = inject(StorageService);
  private commonHttp = inject(CommonHttpService);
  public skeletonService = inject(SkeletonTheme);

  ngOnInit() {
    this.client_Id = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_Id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.fetchAndSetUser();
    this.getLevels();
  }

  getLevels() {
    this.creditLoaded?.set(false);
    this.isLoadingCredit?.set(true);

    this.commonHttp
      .getCourse(
        `/client/${this.client_Id}/get-approved-action-items-grouped/${this.user_Id}`,
      )
      .subscribe({
        next: (res: any) => {
          const data = res?.data ?? [];

          if (data?.length === 0) {
            this.getAllStudentCredit();
            this.isLoadingCredit?.set(false);
            this.creditLoaded?.set(true);
            return;
          }

          let totalObtained = 0;
          let totalMax = 0;

          const updatedLevels = data?.map((level: any) => {
            const obtained = Number(level?.obtained_score ?? 0);
            totalObtained += obtained;

            const levelTotal = (level?.action_items ?? [])?.reduce(
              (sum: number, item: any) => sum + Number(item?.total_score ?? 0),
              0,
            );

            totalMax += levelTotal;
            const percent = levelTotal > 0 ? (obtained / levelTotal) * 100 : 0;

            return {
              ...level,
              expanded: true,
              percent,
              totalScore: levelTotal,
            };
          });

          this.allLevels?.set(updatedLevels);
          const rawScore = totalMax > 0 ? (totalObtained / totalMax) * 10 : 0;
          const finalScore = Math?.floor(rawScore * 10) / 10;
          this.creditScore?.set(finalScore?.toFixed(1));
          this.isLoadingCredit?.set(false);
          this.creditLoaded?.set(true);
        },
        error: () => {
          this.isLoadingCredit?.set(false);
          this.creditLoaded?.set(true);
        },
      });
  }

  getAllStudentCredit() {
    this.commonHttp
      .getCourse(`/client/${this.client_Id}/tutor/all-approved-action-items`)
      .subscribe((res: any) => {
        const levels = (res?.data ?? []).map((level: any) => {
          const updatedStudents = (level?.students ?? []).map(
            (student: any) => {
              const obtained = Number(student?.obtained_score ?? 0);

              const total = (student?.action_items ?? [])?.reduce(
                (sum: number, item: any) =>
                  sum + Number(item?.total_score ?? 0),
                0,
              );

              const percent = total > 0 ? (obtained / total) * 100 : 0;

              return {
                ...student,
                expanded: true,
                obtained,
                percent,
                totalScore: total,
                action_items: student?.action_items ?? [],
              };
            },
          );

          return {
            ...level,
            expanded: true,
            students: updatedStudents,
          };
        });

        this.allLevels?.set(levels);
      });
  }

  getMedalByPercentage(percentage: number): 'gold' | 'silver' | null {
    if (percentage >= 80) return 'gold';
    if (percentage >= 50) return 'silver';
    return null;
  }
  getPercentage(obtained: number, total: number): number {
    if (!total) return 0;
    return Math.round((obtained / total) * 100);
  }

  fetchAndSetUser() {
    this.commonHttp
      .getLocalUserMe()
      .subscribe({
        next: (res: any) => {
          const user = res?.data || res?.user;
          this.student?.set(user);
        },
      });
  }

  toggleLevel(index: number): void {
    this.allLevels?.update((levels) =>
      levels?.map((level, i) =>
        i === index ? { ...level, expanded: !level?.expanded } : level,
      ),
    );
  }
  collapseAll(): void {
    this.allLevels()?.forEach((level) => (level.expanded = false));
  }
  expandAll(): void {
    this.allLevels()?.forEach((level) => (level.expanded = true));
  }
}
