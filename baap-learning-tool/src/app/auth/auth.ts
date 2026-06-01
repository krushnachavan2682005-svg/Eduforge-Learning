import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environment/env';
import { STORAGEENUMS } from '../shared/enum';
import { StorageService } from '../services/storage-service';
import { PermissionStore } from '../services/permission.service';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private str = inject(StorageService);
  private permissionStore = inject(PermissionStore);
  private loginUrl = `${environment.AUTH_BASE_URL}/login`;
  private meUrl = `${environment.AUTH_BASE_URL}/me`;
  private permissionsUrl = `${environment.AUTH_BASE_URL}/permissions`;

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
      switchMap(() => this.hydratePermissions()),
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
    this.str.setItem(STORAGEENUMS.IS_AUTHENTICATED, 'true');
  }

  hydratePermissions(): Observable<string[]> {
    return this.http.get(this.permissionsUrl).pipe(
      map((response: any) => {
        const codes = response?.data?.permission_codes || [];
        const roleCode = this.pickWorkspaceRole(response?.data?.roles || []);
        if (roleCode) {
          this.str.setItem(STORAGEENUMS.ROLE, roleCode);
        }
        this.permissionStore?.setPermissions(codes);
        console.log('[Auth] permissions hydrated', codes);
        return codes;
      }),
      catchError((error) => {
        console.warn('[Auth] permissions hydration failed', error);
        this.permissionStore?.setPermissions([]);
        return of([]);
      }),
    );
  }

  private pickWorkspaceRole(roles: any[]): string {
    const codes = roles.map((role) => role?.code).filter(Boolean);
    const priority = [
      'super_admin',
      'organization_admin',
      'teacher',
      'student',
      'reviewer',
    ];
    return priority.find((role) => codes.includes(role)) || codes[0] || '';
  }

  logout(): void {
    console.log('[Auth] logout and clear local session');
    this.str?.clear();
  }
}
