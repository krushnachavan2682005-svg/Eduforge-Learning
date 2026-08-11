import { Injectable, inject } from '@angular/core';
import { AuthSessionService } from '../session/auth-session.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceNavigationService {
  private session = inject(AuthSessionService);

  getCourseListRoute() {
    if (this.session.isStudent()) return '/student/my-learning';
    if (this.session.isOrganizationAdmin() || this.session.isPlatformAdmin()) {
      return '/admin/courses';
    }
    return '/teacher/courses';
  }

  getCourseCreateRoute() {
    return '/teacher/courses/create';
  }

  getCourseDetailRoute(id: string) {
    if (this.session.isStudent()) return `/student/courses/${id}`;
    return `/teacher/courses/view-course/${id}`;
  }

  getCourseViewSectionRoute(id: string) {
    return `/teacher/courses/view-section/${id}`;
  }

  getCourseAddSectionRoute(id: string) {
    return `/teacher/courses/add-section/${id}`;
  }

  getTestListRoute() {
    if (!this.session.getRole()) return '/tests/my-test';
    return this.session.isStudent() ? '/student/tests' : '/teacher/tests';
  }

  getTestCreateRoute() {
    return '/teacher/tests/create';
  }

  getTestAssignRoute() {
    return '/teacher/tests/assign';
  }

  getTestStartRoute(id: string) {
    return `/student/tests/start/${id}`;
  }

  getTestResultsRoute() {
    return '/student/tests/results';
  }

  getReviewListRoute() {
    return '/teacher/reviews';
  }

  getReviewerRoute(id?: string) {
    return id ? `/teacher/tests/reviewer/${id}` : '/teacher/tests/reviewer';
  }

  getStudentReviewRoute(id?: string) {
    return id ? `/student/tests/student-review-test/${id}` : '/student/tests';
  }

  getActionItemsRoute() {
    return this.session.isStudent()
      ? '/student/action-items'
      : '/teacher/action-items';
  }

  getActionItemCreateRoute() {
    return '/teacher/action-items/create';
  }

  getActionItemSubmissionsRoute(id: string) {
    return `/teacher/action-items/view-student-submissions/${id}`;
  }

  getMyLearningRoute() {
    return '/student/my-learning';
  }

  getStudentCourseRoute(id: string) {
    return `/student/courses/${id}`;
  }

  getResumeRoute() {
    return '/student/resume';
  }

  getResumeCreateRoute() {
    return '/student/resume/create';
  }

  getResumeEditRoute(id: string) {
    return `/student/resume/edit/${id}`;
  }
}
