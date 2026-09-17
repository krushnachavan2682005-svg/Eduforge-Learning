import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';
import { SelectClient } from './select-client/select-client';
import { RoleGuard } from './core/guards/role.guard';
import { PermissionGuard } from './core/guards/permission.guard';
import { RoleRedirectGuard } from './core/guards/role-redirect.guard';
import { LegacyWorkspaceRedirectGuard } from './core/guards/legacy-workspace-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [RoleRedirectGuard],
    loadComponent: () =>
      import('./layouts/app-shell/app-shell').then((m) => m.AppShell),
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
    path: 'platform',
    loadComponent: () =>
      import('./layouts/role-shell/role-shell').then((m) => m.RoleShell),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['super_admin'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/platform/platform-dashboard/platform-dashboard').then(
            (m) => m.PlatformDashboard,
          ),
      },
      {
        path: 'organization-overview',
        loadComponent: () =>
          import('./features/platform/organization-overview/organization-overview').then(
            (m) => m.OrganizationOverview,
          ),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'Platform Workspace' },
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layouts/role-shell/role-shell').then((m) => m.RoleShell),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['super_admin', 'organization_admin', 'owner', 'admin'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/admin-dashboard/admin-dashboard').then(
            (m) => m.AdminDashboard,
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./admin/members/member-list/member-list').then((m) => m.MemberList),
        canActivate: [PermissionGuard],
        data: { permissions: ['MEMBER_VIEW'] },
      },
      {
        path: 'members/create',
        loadComponent: () =>
          import('./admin/members/member-create/member-create').then(
            (m) => m.MemberCreate,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['MEMBER_CREATE'] },
      },
      {
        path: 'members/:id',
        loadComponent: () =>
          import('./admin/members/member-detail/member-detail').then(
            (m) => m.MemberDetail,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['MEMBER_VIEW'] },
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./admin/students/student-list/student-list').then(
            (m) => m.StudentList,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'classes',
        loadComponent: () =>
          import('./admin/classes/class-list/class-list').then((m) => m.ClassList),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'classes/create',
        loadComponent: () =>
          import('./admin/classes/class-create/class-create').then(
            (m) => m.ClassCreate,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['CLASS_CREATE'] },
      },
      {
        path: 'classes/:id',
        loadComponent: () =>
          import('./admin/classes/class-detail/class-detail').then(
            (m) => m.ClassDetail,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'classes/:id/students',
        loadComponent: () =>
          import('./admin/classes/class-students/class-students').then(
            (m) => m.ClassStudents,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['CLASS_CREATE'] },
      },
      {
        path: 'enrollments',
        loadComponent: () =>
          import('./admin/enrollments/enrollment-list/enrollment-list').then(
            (m) => m.EnrollmentList,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'enrollments/create',
        loadComponent: () =>
          import('./admin/enrollments/enrollment-create/enrollment-create').then(
            (m) => m.EnrollmentCreate,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['ENROLLMENT_CREATE'] },
      },
      {
        path: 'enrollments/:id',
        loadComponent: () =>
          import('./admin/enrollments/enrollment-detail/enrollment-detail').then(
            (m) => m.EnrollmentDetail,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./courses/courses-list/courses-list').then((m) => m.CoursesList),
        canActivate: [PermissionGuard],
        data: { permissions: ['COURSE_CREATE', 'LMS_C'] },
      },
      {
        path: 'tests',
        loadComponent: () =>
          import('./tests/test/test').then((m) => m.Test),
        canActivate: [PermissionGuard],
        data: { permissions: ['EXAM_CREATE', 'LMS_CT'] },
      },
      {
        path: 'action-items',
        loadComponent: () =>
          import('./action-items/action-items/action-items').then(
            (m) => m.ActionItems,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['LMS_AI'] },
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'Admin Workspace' },
      },
    ],
  },
  {
    path: 'teacher',
    loadComponent: () =>
      import('./layouts/role-shell/role-shell').then((m) => m.RoleShell),
    canActivate: [AuthGuard, RoleGuard],
    data: {
      roles: ['teacher', 'organization_admin', 'owner', 'admin', 'super_admin', 'tutor'],
    },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/teacher/teacher-dashboard/teacher-dashboard').then(
            (m) => m.TeacherDashboard,
          ),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./courses/courses-list/courses-list').then((m) => m.CoursesList),
      },
      {
        path: 'courses/create',
        loadComponent: () =>
          import('./courses/add-courses/add-courses').then((m) => m.AddCourses),
        canActivate: [PermissionGuard],
        data: { permissions: ['COURSE_CREATE', 'LMS_C'] },
      },
      {
        path: 'courses/view-course/:id',
        loadComponent: () =>
          import('./courses/view-course/view-course').then((m) => m.ViewCourse),
      },
      {
        path: 'courses/view-section/:id',
        loadComponent: () =>
          import('./courses/view-section/view-section').then((m) => m.ViewSection),
      },
      {
        path: 'courses/add-section/:section_id',
        loadComponent: () =>
          import('./courses/add-section/add-section').then((m) => m.AddSection),
        canActivate: [PermissionGuard],
        data: { permissions: ['COURSE_UPDATE', 'LMS_U'] },
      },
      {
        path: 'tests',
        loadComponent: () => import('./tests/test/test').then((m) => m.Test),
      },
      {
        path: 'tests/create',
        loadComponent: () =>
          import('./tests/add-new-test/add-new-test').then((m) => m.AddNewTest),
        canActivate: [PermissionGuard],
        data: { permissions: ['EXAM_CREATE', 'LMS_CT'] },
      },
      {
        path: 'tests/assign',
        loadComponent: () =>
          import('./tests/assign-test/assign-test').then((m) => m.AssignTest),
        canActivate: [PermissionGuard],
        data: { permissions: ['EXAM_ASSIGN'] },
      },
      {
        path: 'tests/reviewer',
        loadComponent: () =>
          import('./tests/reviewer/reviewer').then((m) => m.Reviewer),
      },
      {
        path: 'tests/reviewer/:id',
        loadComponent: () =>
          import('./tests/reviewer/reviewer').then((m) => m.Reviewer),
      },
      {
        path: 'tests/student-review-test/:id',
        loadComponent: () =>
          import('./tests/student-review-test/student-review-test').then(
            (m) => m.StudentReviewTest,
          ),
      },
      {
        path: 'action-items',
        loadComponent: () =>
          import('./action-items/action-items/action-items').then(
            (m) => m.ActionItems,
          ),
      },
      {
        path: 'action-items/create',
        loadComponent: () =>
          import('./action-items/add-action-items/add-action-items').then(
            (m) => m.AddActionItems,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['ACTION_ITEM_ASSIGN', 'LMS_AI'] },
      },
      {
        path: 'action-items/view-student-submissions/:id',
        loadComponent: () =>
          import('./action-items/view-student-submissions/view-student-submissions').then(
            (m) => m.ViewStudentSubmissions,
          ),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./tests/review-list/review-list').then((m) => m.ReviewList),
        canActivate: [PermissionGuard],
        data: { permissions: ['EXAM_UPDATE'] },
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./admin/students/student-list/student-list').then(
            (m) => m.StudentList,
          ),
        canActivate: [PermissionGuard],
        data: { permissions: ['STUDENT_VIEW'] },
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'Teacher Analytics', subtitle: 'Analytics workspace' },
      },
      {
        path: 'ai-tools',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        canActivate: [PermissionGuard],
        data: { title: 'AI Tools', subtitle: 'AI teacher tools', permissions: ['AI_ACCESS'] },
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'Teacher Workspace' },
      },
    ],
  },
  {
    path: 'student',
    loadComponent: () =>
      import('./layouts/role-shell/role-shell').then((m) => m.RoleShell),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['student'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/student/student-dashboard/student-dashboard').then(
            (m) => m.StudentDashboard,
          ),
      },
      {
        path: 'my-learning',
        loadComponent: () =>
          import('./my-learning/my-learning/my-learning').then((m) => m.MyLearning),
      },
      {
        path: 'courses/:id',
        loadComponent: () =>
          import('./my-learning/student-view/student-view').then(
            (m) => m.StudentView,
          ),
      },
      {
        path: 'tests',
        loadComponent: () =>
          import('./tests/my-test/my-test').then((m) => m.MyTest),
      },
      {
        path: 'tests/start/:id',
        loadComponent: () =>
          import('./tests/start-exam/start-exam').then((m) => m.StartExam),
      },
      {
        path: 'tests/results',
        loadComponent: () =>
          import('./tests/test-result/test-result').then((m) => m.TestResult),
      },
      {
        path: 'action-items',
        loadComponent: () =>
          import('./action-items/my-action-items/my-action-items').then(
            (m) => m.MyActionItems,
          ),
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./credit-score/credit-score/credit-score').then(
            (m) => m.CreditScore,
          ),
      },
      {
        path: 'resume',
        loadComponent: () =>
          import('./resume/resume/resume').then((m) => m.Resume),
      },
      {
        path: 'resume/create',
        loadComponent: () =>
          import('./resume/create-resume/create-resume').then(
            (m) => m.CreateResume,
          ),
      },
      {
        path: 'resume/edit/:id',
        loadComponent: () =>
          import('./resume/create-resume/create-resume').then(
            (m) => m.CreateResume,
          ),
      },
      {
        path: 'tests/student-review-test/:id',
        loadComponent: () =>
          import('./tests/student-review-test/student-review-test').then(
            (m) => m.StudentReviewTest,
          ),
      },
      {
        path: 'ai-tutor',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'AI Tutor', subtitle: 'AI learning assistant' },
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/workspace-placeholder/workspace-placeholder').then(
            (m) => m.WorkspacePlaceholder,
          ),
        data: { title: 'Student Workspace' },
      },
    ],
  },
  {
    path: 'my-learning',
    canActivate: [AuthGuard, LegacyWorkspaceRedirectGuard],
    data: { redirects: { student: '/student/my-learning' } },
    loadChildren: () =>
      import('./my-learning/my-learning-module').then(
        (m) => m.MyLearningModule,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [RoleRedirectGuard],
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.DashboardComponent),
  },
  {
    path: 'courses',
    canActivate: [AuthGuard, LegacyWorkspaceRedirectGuard],
    data: {
      redirects: {
        organization_admin: '/admin/courses',
        super_admin: '/admin/courses',
        teacher: '/teacher/courses',
        student: '/student/my-learning',
      },
    },
    loadChildren: () =>
      import('./courses/courses-module').then((m) => m.CoursesModule),
  },
  {
    path: 'resume/shared/:userId/:token',
    loadComponent: () =>
      import('./resume/shared-resume/shared-resume').then((m) => m.SharedResume),
  },
  {
    path: 'resume',
    canActivate: [AuthGuard, LegacyWorkspaceRedirectGuard],
    data: { redirects: { student: '/student/resume' } },
    loadChildren: () =>
      import('./resume/resume-module').then((m) => m.ResumeModule),
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
    canActivate: [AuthGuard, LegacyWorkspaceRedirectGuard],
    data: {
      redirects: {
        teacher: '/teacher/action-items',
        student: '/student/action-items',
      },
    },
    loadChildren: () =>
      import('./action-items/action-items-module')?.then(
        (m) => m?.ActionItemsModule,
      ),
  },
  {
    path: 'tests/public-test-start',
    loadComponent: () =>
      import('./tests/public-test-start/public-test-start').then(
        (m) => m.PublicTestStart,
      ),
  },
  {
    path: 'tests/public-test-start/:id',
    loadComponent: () =>
      import('./tests/public-test-start/public-test-start').then(
        (m) => m.PublicTestStart,
      ),
  },
  {
    path: 'tests',
    canActivate: [AuthGuard, LegacyWorkspaceRedirectGuard],
    data: {
      redirects: {
        teacher: '/teacher/tests',
        student: '/student/tests',
      },
    },
    loadChildren: () =>
      import('./tests/tests-module')?.then((m) => m?.TestsModule),
  },

  {
    path: '**',
    redirectTo: '/auth/login',
  },
];
