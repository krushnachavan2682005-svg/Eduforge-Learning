import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environment/env';
import { STORAGEENUMS } from '../shared/enum';
import { StorageService } from './storage-service';

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
  page?: number;
  search?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class CommonHttpService {
  private str = inject(StorageService);
  private http = inject(HttpClient);

  private getHeaders(): HttpHeaders {
    const token = this.str?.getItem(STORAGEENUMS?.AUTH_TOKEN);
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (token) {
      return headers?.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private buildQueryParams(params: Record<string, any>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Do not add 'page' if 'cursor' is present
        if (key === 'page' && params['cursor']) return;
        query.set(key, String(value));
      }
    });
    return query.toString();
  }

  getCourse(endpoint: string): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalUserMe(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/users/me`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getCurrentOrganization(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/organizations/current`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getOrganizationOverview(organizationId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/organizations/organization-data/${organizationId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalDashboardMe(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/dashboard/me`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalStudents(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/students`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getStudents(): Observable<any> {
    return this.getLocalStudents();
  }

  createLocalStudent(data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/students`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  createStudent(data: any): Observable<any> {
    return this.createLocalStudent(data);
  }

  getStudentById(id: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/students/${id}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalClasses(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getClassesList(): Observable<any> {
    return this.getLocalClasses();
  }

  createLocalClass(data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  createClass(data: any): Observable<any> {
    return this.createLocalClass(data);
  }

  getClassById(id: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes/${id}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  addLocalStudentToClass(classId: string, studentId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes/${classId}/students/students/${studentId}`;
    return this.http.post(url, {}, { headers: this.getHeaders() });
  }

  addStudentToClass(classId: string, studentId: string): Observable<any> {
    return this.addLocalStudentToClass(classId, studentId);
  }

  getClassStudents(classId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes/${classId}/students/students`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  removeStudentFromClass(classId: string, studentId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/classes/${classId}/students/students/${studentId}`;
    return this.http.delete(url, { headers: this.getHeaders() });
  }

  createLocalEnrollment(data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/enrollments`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  createEnrollment(data: any): Observable<any> {
    return this.createLocalEnrollment(data);
  }

  getEnrollmentsByStudent(studentId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/enrollments/student/${studentId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getEnrollments(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    const url = `${environment.LMS_BASE_URL}/students/enrollments${qs ? `?${qs}` : ''}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }


  getEnrollmentById(id: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/enrollments/${id}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  updateEnrollmentStatus(id: string, status: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/students/enrollments/${id}/status`;
    return this.http.patch(url, { status }, { headers: this.getHeaders() });
  }

  getMembers(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    const url = `${environment.LMS_BASE_URL}/members/members${qs ? `?${qs}` : ''}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }


  getMember(id: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getMemberById(id: string): Observable<any> {
    return this.getMember(id);
  }

  createMember(data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  updateMember(id: string, data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}`;
    return this.http.patch(url, data, { headers: this.getHeaders() });
  }

  resetMemberPassword(id: string, data: any): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}/password`;
    return this.http.patch(url, data, { headers: this.getHeaders() });
  }

  deactivateMember(id: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}`;
    return this.http.delete(url, { headers: this.getHeaders() });
  }

  assignMemberRole(id: string, roleCode: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}/roles`;
    return this.http.post(url, { role_code: roleCode }, { headers: this.getHeaders() });
  }

  removeMemberRole(id: string, roleId: string): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/members/${id}/roles/${roleId}`;
    return this.http.delete(url, { headers: this.getHeaders() });
  }

  getRoles(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/roles`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getAllPermissions(): Observable<any> {
    const url = `${environment.LMS_BASE_URL}/members/permissions`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getCoursesForEnrollment(page = 1, limit = 100): Observable<any> {

    return this.getCourse(`/all-courses?page=${page}&limit=${limit}`);
  }

  // --- Batch 2: Cursor Pagination Methods ---

  getCoursesList(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/all-courses${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getExamsList(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/exams${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getLessonsList(courseId: string, params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/lessons/course/${courseId}${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getSectionsList(courseId: string, params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/sections/course/${courseId}${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getActionItems(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/action-items${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getExamPublicResults(examId: string, params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/student-results/public/${examId}${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getAssignedExams(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/exams/assigned${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getExamsByCreator(userId: string, params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/exams/created-by/${userId}${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  getStudentResults(params: CursorPaginationParams = {}): Observable<any> {
    const qs = this.buildQueryParams(params);
    return this.http.get(`${environment.LMS_BASE_URL}/student-results${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
  }

  // -------------------------------------------

  postCourse(endpoint: string, data: any): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  postAIApi(endpoint: string, data: any): Observable<any> {
    const url = `${environment?.LMS_Ai_API_URL}/${endpoint}`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  putCourse(endpoint: string, data: any): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    return this.http.put(url, data, { headers: this.getHeaders() });
  }

  getClient(searchKey?: string): Observable<any> {
    return this.getCurrentOrganization().pipe(
      map((res: any) => {
        const organization = res?.data || this.getLocalClient();
        const normalized = this.normalizeLocalOrganization(organization);
        const matches =
          !searchKey ||
          normalized?.name?.toLowerCase()?.includes(searchKey.toLowerCase());
        const clients = normalized && matches ? [normalized] : [];
        return { clients, data: clients };
      }),
    );
  }

  getClasses(endpoint: string) {
    return this.getLocalClasses().pipe(
      map((res: any) => this.mapLocalClassesResponse(res)),
    );
  }
  getUser(endpoint: string) {
    if (endpoint?.includes('/users?')) {
      return this.getLocalStudents().pipe(
        map((res: any) => this.mapLocalStudentsResponse(res)),
      );
    }

    return this.getLocalUserMe().pipe(
      map((res: any) => {
        const user = res?.data || this.getLocalUser();
        return { user, users: user ? [user] : [], data: user };
      }),
    );
  }

  delete(endpoint: string, body?: any): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    const options = body
      ? { body: body, headers: this.getHeaders() }
      : { headers: this.getHeaders() };
    return this.http.delete(url, options);
  }

  uploadCourseImage(endpoint: string, formData: FormData): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    const token = this.str?.getItem(STORAGEENUMS?.AUTH_TOKEN);

    let headers = new HttpHeaders();
    if (token) {
      headers = headers?.set('Authorization', `Bearer ${token}`);
    }

    return this.http?.post(url, formData, {
      headers,
      reportProgress: true,
      observe: 'events',
    });
  }

  getPermissions(endpoint: string) {
    const url = `${environment?.AUTH_BASE_URL}/members/permissions`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getPublicCourse(endpoint: string): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.get(url, { headers });
  }

  private mapLocalStudentsResponse(res: any) {
    const students = (res?.data || []).map((student: any) => ({
      ...student,
      user_id: student?.user_id,
      name: [student?.first_name, student?.last_name]
        .filter(Boolean)
        .join(' '),
    }));

    return {
      success: true,
      data: students,
    };
  }

  private mapLocalClassesResponse(res: any) {
    const classes = (res?.data || []).map((studentClass: any) => ({
      ...studentClass,
      class_name: studentClass?.name,
      name: studentClass?.name,
    }));

    return {
      success: true,
      classrooms: classes,
      classes,
      data: classes,
    };
  }

  private normalizeLocalOrganization(organization: any) {
    if (!organization) return null;
    return {
      ...organization,
      id: organization?.id,
      name: organization?.name || 'Local LMS Organization',
      slug: organization?.slug || 'local-lms-organization',
      orgn_details: organization?.orgn_details || [
        {
          orgn_name: organization?.name || 'Local LMS Organization',
          logo: '',
        },
      ],
    };
  }

  private getLocalClient() {
    const organizationId = this.str?.getItem<string>(
      STORAGEENUMS.ORGANIZATION_ID,
    );
    const storedClient = this.str?.getItem<any>(STORAGEENUMS.CLIENT);

    if (storedClient?.id) {
      return storedClient;
    }

    if (!organizationId) return null;

    return {
      id: organizationId,
      name: 'Local LMS Organization',
      slug: 'local-lms-organization',
      orgn_details: [
        {
          orgn_name: 'Local LMS Organization',
          logo: '',
        },
      ],
    };
  }

  private getLocalUser() {
    const user = this.str?.getItem<any>(STORAGEENUMS.USER) || {};
    const userId = this.str?.getItem<string>(STORAGEENUMS.USER_ID);
    const role = this.str?.getItem<string>(STORAGEENUMS.ROLE) || 'owner';

    if (!userId && !user?.id) return null;

    return {
      ...user,
      id: user?.id || userId,
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      profile_image: user?.profile_image || '',
      user_location_department: user?.user_location_department || [],
      user_mappings: user?.user_mappings || [
        {
          role_id: role,
          role: { id: role, name: role },
        },
      ],
    };
  }
}
