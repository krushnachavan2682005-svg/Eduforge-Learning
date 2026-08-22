import { Trend, Rate, Counter } from 'k6/metrics';

export const metrics = {
  coursesLatency: new Trend('courses_latency'),
  sectionsLatency: new Trend('sections_latency'),
  lessonsLatency: new Trend('lessons_latency'),
  studentsLatency: new Trend('students_latency'),
  enrollmentsLatency: new Trend('enrollments_latency'),
  examsLatency: new Trend('exams_latency'),
  dashboardLatency: new Trend('dashboard_latency'),
  resultsLatency: new Trend('results_latency'),
  assignmentsLatency: new Trend('assignments_latency'),

  coursesErrors: new Rate('courses_errors'),
  sectionsErrors: new Rate('sections_errors'),
  lessonsErrors: new Rate('lessons_errors'),
  studentsErrors: new Rate('students_errors'),
  enrollmentsErrors: new Rate('enrollments_errors'),
  examsErrors: new Rate('exams_errors'),
  dashboardErrors: new Rate('dashboard_errors'),
  resultsErrors: new Rate('results_errors'),
  assignmentsErrors: new Rate('assignments_errors'),
};
