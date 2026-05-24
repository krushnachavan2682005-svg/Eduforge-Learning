import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environment/env';
import { STORAGEENUMS } from '../shared/enum';
import { StorageService } from './storage-service';

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

  getCourse(endpoint: string): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalUserMe(): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/users/me`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getCurrentOrganization(): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/organizations/current`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalDashboardMe(): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/dashboard/me`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getLocalStudents(): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/students`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  createLocalStudent(data: any): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/students`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  getLocalClasses(): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/classes`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  createLocalClass(data: any): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/classes`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

  addLocalStudentToClass(classId: string, studentId: string): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/classes/${classId}/students/${studentId}`;
    return this.http.post(url, {}, { headers: this.getHeaders() });
  }

  createLocalEnrollment(data: any): Observable<any> {
    const url = `${environment.LOCAL_API_BASE_URL}/enrollments`;
    return this.http.post(url, data, { headers: this.getHeaders() });
  }

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
    const url = `${environment?.AUTH_BASE_URL}/permissions`;
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
      id: organization?.id || organization?.client_id,
      client_id: organization?.client_id || organization?.id,
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
    const clientId =
      this.str?.getItem<string>(STORAGEENUMS.CLIENT_ID) || organizationId;
    const storedClient = this.str?.getItem<any>(STORAGEENUMS.CLIENT);

    if (storedClient?.id || storedClient?.client_id) {
      return storedClient;
    }

    if (!clientId) return null;

    return {
      id: clientId,
      client_id: clientId,
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
