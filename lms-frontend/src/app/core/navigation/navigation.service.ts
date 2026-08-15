import { Injectable, inject } from '@angular/core';
import { PermissionStore } from '../../services/permission.service';
import { AuthSessionService } from '../session/auth-session.service';
import {
  adminNavigation,
  platformNavigation,
  studentNavigation,
  teacherNavigation,
} from './navigation.config';
import { NavConfig, NavItem } from './navigation.types';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private session = inject(AuthSessionService);
  private permissions = inject(PermissionStore);

  getNavigationForCurrentRole(): NavConfig {
    const role = this.session.getRole();
    const config = this.pickConfig(role);
    return {
      ...config,
      menuItems: this.filterItems(config.menuItems),
      footerItems: config.footerItems,
    };
  }

  private pickConfig(role: string): NavConfig {
    if (role === 'super_admin') return platformNavigation;
    if (role === 'teacher') return teacherNavigation;
    if (role === 'student') return studentNavigation;
    return adminNavigation;
  }

  private filterItems(items: NavItem[]): NavItem[] {
    return items
      .filter((item) => this.isAllowed(item))
      .map((item) => ({
        ...item,
        subItems: item.subItems ? this.filterItems(item.subItems) : undefined,
      }));
  }

  private isAllowed(item: NavItem) {
    if (item.hide) return false;
    if (item.roles?.length && !this.session.hasRole(item.roles as any)) {
      return false;
    }
    // Let the *authorize directive in the template handle permission checking dynamically
    return true;
  }
}
