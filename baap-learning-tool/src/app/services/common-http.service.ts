import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    let params = new HttpParams();
    if (searchKey) {
      params = params?.set('k', searchKey);
    }

    return this.http.get(`${environment?.ERP_BASE_URL}/auth/api/clients`, {
      headers: this.getHeaders(),
      params: params,
    });
  }

  getClasses(endpoint: string) {
    const url = `${environment?.ERP_BASE_URL}/auth/api${endpoint}`;
    return this.http.get(url, {
      headers: this.getHeaders(),
    });
  }
  getUser(endpoint: string) {
    const url = `${environment?.ERP_BASE_URL}${endpoint}`;
    return this.http.get(url, { headers: this.getHeaders() });
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
    const url = `${environment?.ERP_BASE_URL}${endpoint}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getPublicCourse(endpoint: string): Observable<any> {
    const url = `${environment?.LMS_BASE_URL}${endpoint}`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.get(url, { headers });
  }
}
