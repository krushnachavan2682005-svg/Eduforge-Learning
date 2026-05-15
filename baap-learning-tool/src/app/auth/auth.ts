import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environment/env';
import { STORAGEENUMS } from '../shared/enum';
import { StorageService } from '../services/storage-service';
import { PermissionStore } from '../services/permission.service';
import { TEMP_LOCAL_PERMISSIONS } from '../services/common-http.service';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private str = inject(StorageService);
  private permissionStore = inject(PermissionStore);
  private loginUrl = `${environment.AUTH_BASE_URL}/login`;
  private meUrl = `${environment.AUTH_BASE_URL}/me`;

  // Legacy ERP auth endpoints retained temporarily for rollback/OTP compatibility.
  private legacyLoginUrl = `${environment.ERP_BASE_URL}/auth/api/auth/login`;
  private checkPasswordUrl = `${environment.ERP_BASE_URL}/auth/api/auth/check-password`;
  private requestOtpUrl = `${environment.ERP_BASE_URL}/auth/api/auth/request-otp`;
  private verifyOtpUrl = `${environment.ERP_BASE_URL}/auth/api/auth/verify-otp`;

  login(payload: any): Observable<any> {
    return this.http.post(this.loginUrl, payload);
  }

  restoreSession(): Observable<boolean> {
    const token = this.str?.getItem(STORAGEENUMS.AUTH_TOKEN);
    if (!token) {
      return of(false);
    }

    console.log('[Auth] restoring session with /auth/me');
    return this.http.get(this.meUrl).pipe(
      tap((response: any) => {
        this.persistSession(response?.data);
        console.log('[Auth] token restore success');
      }),
      map(() => true),
      catchError((error) => {
        console.warn('[Auth] token restore failed', error);
        this.logout();
        return of(false);
      }),
    );
  }

  persistSession(data: any): void {
    const user = data?.user;
    const organization = data?.organization;
    const role = data?.membership?.role;

    if (data?.access_token) {
      this.str.setItem(STORAGEENUMS.AUTH_TOKEN, data.access_token);
    }
    if (data?.refresh_token) {
      this.str.setItem(STORAGEENUMS.REFRESH_TOKEN, data.refresh_token);
    }
    if (user?.id) {
      this.str.setItem(STORAGEENUMS.USER_ID, user.id);
    }
    if (user) {
      this.str.setItem(STORAGEENUMS.USER, user);
    }
    if (organization?.id) {
      this.str.setItem(STORAGEENUMS.ORGANIZATION_ID, organization.id);
      // Temporary compatibility: existing LMS modules still read client_id.
      this.str.setItem(STORAGEENUMS.CLIENT_ID, organization.id);
      this.str.setItem(STORAGEENUMS.CLIENT, organization);
    }
    if (role) {
      this.str.setItem(STORAGEENUMS.ROLE, role);
    }
    if (!this.str?.getItem(STORAGEENUMS.PERMISSIONS)) {
      console.warn('[AuthFallback] injecting temporary LMS permissions');
      this.str.setItem(STORAGEENUMS.PERMISSIONS, TEMP_LOCAL_PERMISSIONS);
      this.permissionStore?.setPermissions(TEMP_LOCAL_PERMISSIONS);
    }
    this.str.setItem(STORAGEENUMS.IS_AUTHENTICATED, 'true');
  }

  logout(): void {
    console.log('[Auth] logout and clear local session');
    this.str?.clear();
  }

  legacyLogin(payload: any): Observable<any> {
    return this.http.post(this.legacyLoginUrl, payload);
  }

  checkPassword(payload: any): Observable<any> {
    return this.http.post(this.checkPasswordUrl, payload);
  }

  requestOtp(payload: any): Observable<any> {
    return this.http.post(this.requestOtpUrl, payload);
  }

  verifyOtp(payload: any): Observable<any> {
    return this.http.post(this.verifyOtpUrl, payload);
  }
}
