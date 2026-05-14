import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';
import { SelectClient } from './select-client/select-client';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth-module').then((m) => m.AuthModule),
  },
  {
    path: 'login',
    redirectTo: '/auth/login',
  },
  {
    path: 'my-learning',
    loadChildren: () =>
      import('./my-learning/my-learning-module').then(
        (m) => m.MyLearningModule,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'courses',
    loadChildren: () =>
      import('./courses/courses-module').then((m) => m.CoursesModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'resume',
    loadChildren: () =>
      import('./resume/resume-module').then((m) => m.ResumeModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'organizations',
    component: SelectClient,
  },
  {
    path: 'credit-score',
    loadChildren: () =>
      import('./credit-score/credit-score-module')?.then(
        (m) => m?.CreditScoreModule,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'leaderboard',
    loadChildren: () =>
      import('./leader-board/leader-board-module')?.then(
        (m) => m?.LeaderBoardModule,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'action-items',
    loadChildren: () =>
      import('./action-items/action-items-module')?.then(
        (m) => m?.ActionItemsModule,
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'tests',
    loadChildren: () =>
      import('./tests/tests-module')?.then((m) => m?.TestsModule),
    canActivate: [AuthGuard],
  },

  {
    path: '**',
    redirectTo: '/auth/login',
  },
];
