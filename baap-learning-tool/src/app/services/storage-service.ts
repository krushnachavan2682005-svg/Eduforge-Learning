import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { STORAGEENUMS } from '../shared/enum';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root', // This makes it available app-wide as a singleton
})
export class StorageService {
  canSwitchOrgChanged: Subject<boolean> = new Subject<boolean>();
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  setItem(key: STORAGEENUMS, value: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage?.setItem(key, data);
    if (key === STORAGEENUMS?.CAN_SWITCH_ORG) {
      this.canSwitchOrgChanged?.next(value === true || value === 'true');
    }
  }

  getItem<T = any>(key: STORAGEENUMS): T | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const item = localStorage.getItem(key);
    try {
      return item ? JSON.parse(item) : null;
    } catch {
      return item as unknown as T;
    }
  }

  // Remove item
  static removeItem(key: STORAGEENUMS): void {
    localStorage.removeItem(key);
  }

  removeItem(key: STORAGEENUMS): void | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.removeItem(key);
    }
    return null;
  }

  // Clear all
  static clear(): void {
    localStorage?.clear();
  }

  clear(): void | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage?.clear();
    }
    return null;
  }
  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage?.clear();
    }
  }
}
