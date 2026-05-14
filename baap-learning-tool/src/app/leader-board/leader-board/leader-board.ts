import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../shared/header.component';

@Component({
  selector: 'app-leader-board',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './leader-board.html',
  styleUrl: './leader-board.scss',
})
export class LeaderBoard {
  constructor(private router: Router) {}
  activePeriod: 'week' | 'month' | 'all' = 'month';
  enableScroll = true;

  headers = [
    {
      title: 'LEADERBOARD',
      subtitle: 'TOP PERFORMERS | COMPETE WITH YOUR PEERS',
    },
  ];
  leaderView() {
    this.router?.navigate(['/leaderboard/leader-view']);
  }
  get dynamicSubtitle() {
    const periodMap = {
      week: "THIS WEEK'S TOP PERFORMERS",
      month: "THIS MONTH'S TOP PERFORMERS",
      all: 'ALL TIME TOP PERFORMERS',
    };
    return periodMap[this.activePeriod] || 'TOP PERFORMERS';
  }

  setPeriod(period: 'week' | 'month' | 'all') {
    this.activePeriod = period;
  }
  leaderboardEntries: Array<{
    rank: number;
    name: string;
    avatarUrl: string;
    coursesCompleted: number;
    rating: number; // 0..5
    badges?: string[];
    points: number;
  }> = [
    {
      rank: 1,
      name: 'Ajay Awari',
      avatarUrl: 'https://randomuser.me/api/portraits/men/12.jpg',
      coursesCompleted: 8,
      rating: 4.5,
      badges: ['Monthly Champ', 'Quiz Master', ' Master', '+4'],
      points: 1520,
    },
    {
      rank: 2,
      name: 'Swaminath Baban Kadner',
      avatarUrl: 'https://randomuser.me/api/portraits/men/21.jpg',
      coursesCompleted: 7,
      rating: 3.5,
      badges: ['Top Designer', 'Quiz Master', 'Monthly Champ', '+2'],
      points: 1340,
    },
    {
      rank: 3,
      name: 'Mayur Chakor',
      avatarUrl: 'https://randomuser.me/api/portraits/men/31.jpg',
      coursesCompleted: 6,
      rating: 4.0,
      badges: ['Code Streak', 'Growth Hacker', '+1'],
      points: 1120,
    },
    {
      rank: 4,
      name: 'Deva Ghuge',
      avatarUrl: 'https://randomuser.me/api/portraits/men/41.jpg',
      coursesCompleted: 5,
      rating: 3.0,
      badges: ['Top Designer', 'Quiz Master', 'Code Streak'],
      points: 980,
    },
    {
      rank: 5,
      name: 'You',
      avatarUrl: 'https://randomuser.me/api/portraits/lego/1.jpg',
      coursesCompleted: 4,
      rating: 4.0,
      badges: ['Quiz Master', 'Fast Learner', 'Code Streak'],
      points: 790,
    },
    {
      rank: 6,
      name: 'Sagar Avhad',
      avatarUrl: 'https://randomuser.me/api/portraits/men/55.jpg',
      coursesCompleted: 4,
      rating: 2.0,
      badges: ['Growth Hacker', 'Quiz Master'],
      points: 788,
    },
    {
      rank: 7,
      name: 'Sagar Avhad',
      avatarUrl: 'https://randomuser.me/api/portraits/men/56.jpg',
      coursesCompleted: 4,
      rating: 2.0,
      badges: ['Code Streak', 'Quiz Master'],
      points: 788,
    },
    {
      rank: 8,
      name: 'Sagar Avhad',
      avatarUrl: 'https://randomuser.me/api/portraits/men/57.jpg',
      coursesCompleted: 4,
      rating: 2.0,
      badges: ['Top Designer', 'Quiz Master'],
      points: 788,
    },
  ];

  get topThree() {
    return this.leaderboardEntries.slice(0, 3);
  }

  get restEntries() {
    return this.leaderboardEntries.slice(3);
  }

  get allEntries() {
    return this.leaderboardEntries;
  }

  getStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
  }
  toggleScroll(on: boolean) {
    this.enableScroll = on;
  }
}
