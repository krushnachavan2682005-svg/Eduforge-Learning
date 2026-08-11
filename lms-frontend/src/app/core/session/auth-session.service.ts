import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Auth } from '../../auth/auth';
import { STORAGEENUMS } from '../../shared/enum';
import { PermissionStore } from '../../services/permission.service';
import { StorageService } from '../../services/storage-service';

export type WorkspaceRole =
  | 'super_admin'
  | 'organization_admin'
  | 'teacher'
  | 'student'
  | 'reviewer'
  | 'owner'
  | 'admin'
  | 'tutor';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private auth = inject(Auth);
  private storage = inject(StorageService);
  private permissions = inject(PermissionStore);

  private userSignal = signal<any | null>(null);
  private organizationSignal = signal<any | null>(null);
  private roleSignal = signal<string>('');
  private permissionSignal = signal<string[]>([]);

  currentUser = computed(() => this.userSignal());
  currentOrganization = computed(() => this.organizationSignal());
  currentRole = computed(() => this.normalizeRole(this.roleSignal()));
  currentPermissions = computed(() => this.permissionSignal());

  constructor() {
    this.loadFromStorage();
  }

  restoreSession(): Observable<boolean> {
    return this.auth.restoreSession().pipe(
      tap(() => this.loadFromStorage()),
      map((valid) => valid),
    );
  }

  loadFromStorage() {
    const user = this.storage.getItem(STORAGEENUMS.USER);
    const organization =
      this.storage.getItem(STORAGEENUMS.CLIENT) ||
      this.storage.getItem(STORAGEENUMS.ORGANIZATION_ID);
    const role = this.storage.getItem<string>(STORAGEENUMS.ROLE) || '';
    const storedPermissions =
      this.storage.getItem<string[]>(STORAGEENUMS.PERMISSIONS) || [];

    this.userSignal.set(user);
    this.organizationSignal.set(organization);
    this.roleSignal.set(role);
    this.permissionSignal.set(storedPermissions);
  }

  getCurrentUser() {
    return this.currentUser();
  }

  getRole() {
    return this.currentRole();
  }

  getOrganization() {
    return this.currentOrganization();
  }

  hasRole(role: WorkspaceRole | WorkspaceRole[]) {
    const roles = Array.isArray(role) ? role : [role];
    const current = this.getRole();
    return roles.map((r) => this.normalizeRole(r)).includes(current);
  }

  hasPermission(permission: string | string[]) {
    const required = Array.isArray(permission) ? permission : [permission];
    return required.some(
      (item) =>
        this.permissionSignal().includes(item) ||
        this.permissions.hasPermission(item),
    );
  }

  isPlatformAdmin() {
    return this.hasRole('super_admin');
  }

  isOrganizationAdmin() {
    return this.hasRole(['organization_admin', 'owner', 'admin']);
  }

  isTeacher() {
    return this.hasRole(['teacher', 'tutor']);
  }

  isStudent() {
    return this.hasRole('student');
  }

  normalizeRole(role?: string | null) {
    const value = (role || '').trim().toLowerCase();
    if (value === 'owner' || value === 'admin') return 'organization_admin';
    if (value === 'tutor') return 'teacher';
    return value;
  }
}
