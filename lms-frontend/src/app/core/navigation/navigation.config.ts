import { NavConfig, NavItem } from './navigation.types';

const footerItems: NavItem[] = [
  { id: 'theme-selector', label: 'Change Theme', icon: 'contrast', action: 'theme-selector' },
  { id: 'logout', label: 'Logout', icon: 'logout', action: 'logout' },
];

export const platformNavigation: NavConfig = {
  title: 'LMS Platform',
  logo: '/assets/logo.svg',
  menuItems: [
    { id: 'platform-dashboard', label: 'Dashboard', icon: 'dashboard', route: '/platform/dashboard', permissions: 'LMS_VIEW' },
    { id: 'platform-organizations', label: 'Organizations', icon: 'business', route: '/platform/organizations', permissions: 'ORG_ADMIN' },
    { id: 'platform-users', label: 'Users', icon: 'group', route: '/platform/users', permissions: 'MEMBER_VIEW' },
    { id: 'platform-rbac', label: 'RBAC', icon: 'admin_panel_settings', route: '/platform/rbac', permissions: 'ROLE_ASSIGN' },
    { id: 'platform-health', label: 'System Health', icon: 'monitor_heart', route: '/platform/system-health', permissions: 'ORG_ADMIN' },
    { id: 'platform-ai', label: 'AI Usage', icon: 'auto_awesome', route: '/platform/ai-usage', permissions: 'AI_ACCESS' },
  ],
  footerItems,
};

export const adminNavigation: NavConfig = {
  title: 'LMS Admin',
  logo: '/assets/logo.svg',
  menuItems: [
    { id: 'admin-dashboard', label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard', permissions: 'LMS_VIEW' },
    { id: 'admin-members', label: 'Members', icon: 'group', route: '/admin/members', permissions: 'MEMBER_VIEW' },
    { id: 'admin-students', label: 'Students', icon: 'school', route: '/admin/students', permissions: 'STUDENT_VIEW' },
    { id: 'admin-classes', label: 'Classes', icon: 'groups', route: '/admin/classes', permissions: 'STUDENT_VIEW' },
    { id: 'admin-enrollments', label: 'Enrollments', icon: 'assignment_turned_in', route: '/admin/enrollments', permissions: 'STUDENT_VIEW' },
    { id: 'admin-courses', label: 'Courses', icon: 'menu_book', route: '/admin/courses', permissions: 'COURSE_CREATE,LMS_C' },
    { id: 'admin-tests', label: 'Tests', icon: 'assignment', route: '/admin/tests', permissions: 'EXAM_CREATE,LMS_CT' },
    { id: 'admin-actions', label: 'Action Items', icon: 'checklist', route: '/admin/action-items', permissions: 'LMS_AI' },
    { id: 'admin-analytics', label: 'Analytics', icon: 'query_stats', route: '/admin/analytics', permissions: 'LMS_VIEW' },
    { id: 'admin-settings', label: 'Settings', icon: 'settings', route: '/admin/settings', permissions: 'ORG_ADMIN' },
  ],
  footerItems,
};

export const teacherNavigation: NavConfig = {
  title: 'LMS Teacher',
  logo: '/assets/logo.svg',
  menuItems: [
    { id: 'teacher-dashboard', label: 'Dashboard', icon: 'dashboard', route: '/teacher/dashboard', permissions: 'LMS_VIEW' },
    { id: 'teacher-courses', label: 'Courses', icon: 'menu_book', route: '/teacher/courses', permissions: 'COURSE_CREATE,LMS_C' },
    { id: 'teacher-tests', label: 'Tests', icon: 'assignment', route: '/teacher/tests', permissions: 'EXAM_CREATE,LMS_CT' },
    { id: 'teacher-create-test', label: 'Create Test', icon: 'add_task', route: '/teacher/tests/create', permissions: 'EXAM_CREATE,LMS_CT' },
    { id: 'teacher-assign-test', label: 'Assign Test', icon: 'assignment_ind', route: '/teacher/tests/assign', permissions: 'EXAM_ASSIGN' },
    { id: 'teacher-actions', label: 'Action Items', icon: 'checklist', route: '/teacher/action-items', permissions: 'LMS_AI,ACTION_ITEM_ASSIGN' },
    { id: 'teacher-reviews', label: 'Reviews', icon: 'rate_review', route: '/teacher/reviews', permissions: 'EXAM_UPDATE' },
    { id: 'teacher-students', label: 'Students', icon: 'school', route: '/teacher/students', permissions: 'STUDENT_VIEW' },
    { id: 'teacher-analytics', label: 'Analytics', icon: 'query_stats', route: '/teacher/analytics', permissions: 'LMS_VIEW' },
    { id: 'teacher-ai', label: 'AI Tools', icon: 'auto_awesome', route: '/teacher/ai-tools', permissions: 'AI_ACCESS' },
  ],
  footerItems,
};

export const studentNavigation: NavConfig = {
  title: 'LMS Student',
  logo: '/assets/logo.svg',
  menuItems: [
    { id: 'student-dashboard', label: 'Dashboard', icon: 'dashboard', route: '/student/dashboard', permissions: 'LMS_VIEW' },
    { id: 'student-learning', label: 'My Learning', icon: 'book', route: '/student/my-learning', permissions: 'LMS_ML,LMS_R' },
    { id: 'student-tests', label: 'Tests', icon: 'assignment', route: '/student/tests', permissions: 'LMS_CT,LMS_R' },
    { id: 'student-actions', label: 'Action Items', icon: 'checklist', route: '/student/action-items', permissions: 'LMS_AI,LMS_R' },
    { id: 'student-progress', label: 'Progress', icon: 'trending_up', route: '/student/progress', permissions: 'LMS_VIEW' },
    { id: 'student-resume', label: 'Resume', icon: 'assignment_ind', route: '/student/resume', permissions: 'LMS_R' },
    { id: 'student-ai', label: 'AI Tutor', icon: 'auto_awesome', route: '/student/ai-tutor', permissions: 'AI_ACCESS' },
  ],
  footerItems,
};
