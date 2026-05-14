import { Injectable, signal } from '@angular/core';
import { STORAGEENUMS } from '../shared/enum';

@Injectable({ providedIn: 'root' })
export class PermissionStore {
  private _permissions = signal<string[]>([]);
  readonly permissions = this._permissions?.asReadonly();

  loadFromStorage() {
    const raw = localStorage?.getItem(STORAGEENUMS?.PERMISSIONS);
    this._permissions?.set(raw ? JSON?.parse(raw) : []);
  }

  setPermissions(perms: string[]) {
    localStorage?.setItem(STORAGEENUMS?.PERMISSIONS, JSON?.stringify(perms));
    this._permissions?.set(perms);
  }

  clear() {
    localStorage?.removeItem(STORAGEENUMS?.PERMISSIONS);
    this._permissions?.set([]);
  }

  hasPermission(permission: string): boolean {
    if (!permission) return false;
    const perms = permission?.split(',')?.map((p) => p?.trim());
    return perms?.some((p) => this._permissions()?.includes(p));
  }
}
