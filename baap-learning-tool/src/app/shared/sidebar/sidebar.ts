import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  HostListener,
  Signal,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService, Theme } from '../../services/theme.service';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonHttpService } from '../../services/common-http.service';
import { PermissionDirective } from '../../services/permission-directive';
import { Tooltip } from '../tooltip';
interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: string;
  active: boolean;
  hide?: boolean;
  badge?: {
    text: string;
    class: string;
  } | null;
  permissions?: string;
  subItems?: MenuItem[];
}

interface SidebarConfig {
  title: string;
  logo: string;
  menuItems: MenuItem[];
  footerItems: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, Tooltip, PermissionDirective],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  user_id: any;
  clientId: any;
  clientData: any;
  isCollapsed = false;
  showThemeSelector = false;
  isOpened: boolean = false;
  isPermitted = signal(false);
  canSwitchOrg = signal(false);
  currentTheme: Theme = 'dark';
  logoUrl: string | null = null;
  users = signal<any | null>(null);
  openMenuId: string | null = null;
  private hasFetchedClients = false;
  showLogoutConfirm: boolean = false;
  legalOrgName: string | null = null;
  activeSubMenuId: string | null = null;
  sidebarConfig: SidebarConfig | null = null;

  private router = inject(Router);
  private http = inject(HttpClient);
  private str = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private commonHttp = inject(CommonHttpService);
  availableThemes = this.themeService?.getAvailableThemes();

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.loadSidebarConfig();
    this.subscribeToTheme();
    this.refreshSwitchFlag();
    // Ensure flag is computed even if not set yet
    this.fetchAndSetOrgFlag();
    this.fetchAndSetUser();


    this.router?.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.setActiveMenuItem();
        this.cdr?.detectChanges();
      }
    });
    this.str?.canSwitchOrgChanged.subscribe((canSwitch) => {
      this.canSwitchOrg?.set(canSwitch);
      this.cdr?.detectChanges();
    });
    const intervalId = setInterval(() => {
      const userPermission = localStorage?.getItem('permissions');
      const user: any = userPermission ? JSON?.parse(userPermission) : null;
      if (user) {
        this.isPermitted.set(true);
        clearInterval(intervalId);
      }
    }, 100);
    // Only access localStorage in browser
    if (typeof window !== 'undefined' && window?.localStorage) {
      const storedClient = window?.localStorage?.getItem('client');
      if (storedClient) {
        const clientObj = JSON?.parse(storedClient);
        this.logoUrl = clientObj?.orgn_details?.[0]?.logo || '';
        this.legalOrgName = clientObj?.orgn_details?.[0]?.orgn_name || '';
      }
    }
  }

  private fetchAndSetOrgFlag() {
    if (this.hasFetchedClients) {
      this.refreshSwitchFlag();
      return;
    }
    this.commonHttp.getClient()?.subscribe({
      next: (res: any) => {
        const clients = res?.clients || [];
        const can = clients?.length > 1;
        this.canSwitchOrg?.set(can);
        this.str?.setItem(STORAGEENUMS?.CAN_SWITCH_ORG, can);
        this.hasFetchedClients = true;
        this.cdr?.detectChanges();
      },
      error: () => {
        // keep existing flag on error
      },
    });
  }
  private fetchAndSetUser() {
    this.commonHttp
      .getUser(`/auth/api/users/client/${this.clientId}/user/${this.user_id}`)
      .subscribe({
        next: (res: any) => {
          const user = res?.user || res;
          this.users.set(user);
        },
      });
  }

  private refreshSwitchFlag() {
    const raw = this.str?.getItem(STORAGEENUMS?.CAN_SWITCH_ORG) as any;
    // raw may be boolean true/false or string "true"/"false"
    this.canSwitchOrg?.set(raw === true || raw === 'true');
  }

  subscribeToTheme() {
    this.themeService?.currentTheme$?.subscribe((theme) => {
      this.currentTheme = theme;
    });
  }

  loadSidebarConfig() {
    this.http.get<SidebarConfig>('/assets/sidebar-config.json').subscribe({
      next: (config) => {
        this.sidebarConfig = config;
        this.setActiveMenuItem();
        this.cdr?.detectChanges();
      },
      error: (error) => {
        console.error('Error loading sidebar configuration:', error);
      },
    });
  }

  setActiveMenuItem() {
    if (!this.sidebarConfig) return;
    const currentRoute = this.router.url;
    this.activeSubMenuId = null;
    this.sidebarConfig.menuItems = this.sidebarConfig.menuItems.map((item) => {
      let isSubActive = false;

      if (item.subItems && item.subItems.length) {
        item.subItems = item.subItems.map((sub) => {
          const active = sub.route === currentRoute;
          if (active) {
            isSubActive = true;
            this.activeSubMenuId = sub.id;
            this.openMenuId = item.id; 
          }
          return { ...sub, active };
        });
      }

      return {
        ...item,
        active: !isSubActive && item.route === currentRoute,
      };
    });
  }

  
  //  setActiveMenuItem() {
  //   if (!this.sidebarConfig) return;

  //   const currentRoute = this.router?.url;

  //   // Create new objects to avoid mutation issues
  //   this.sidebarConfig = {
  //     ...this.sidebarConfig,
  //     menuItems: this.sidebarConfig?.menuItems?.map((item) => ({
  //       ...item,
  //       active: item?.route === currentRoute,
  //     })),
  //     footerItems: this.sidebarConfig?.footerItems?.map((item) => ({
  //       ...item,
  //       active: item?.route === currentRoute,
  //     })),
  //   };
  // }

  // onMenuLabelClick(item: MenuItem) {
  //   if (item?.route) {
  //     this.router?.navigate([item?.route]);
  //   }
  // }

  // toggleSubmenu(event: Event, item: MenuItem) {
  //   event.stopPropagation();
  //   if (item?.subItems && item?.subItems?.length > 0) {
  //     this.openMenuId = this.openMenuId === item?.id ? null : item?.id;
  //   }
  // }

  toggleSubmenu(item: any) {
    if (this.openMenuId === item?.id) {
      this.openMenuId = null;
    } else {
      this.openMenuId = item?.id;
    }
    // this.activeSubMenuId = null;
  }

  onMenuLabelClick(item: any) {
    if (item.subItems?.length > 0) {
      this.toggleSubmenu(item);
    } else {
      this.router?.navigate([item?.route]);
    }
  }

  onMenuItemClick(item: MenuItem) {
    if (item?.action === 'logout') {
      this.showLogoutConfirm = true;
      return;
    }
    if (item?.action === 'theme-selector') {
      this.toggleThemeSelector();
      this.isOpened = true;
      return;
    }
    if (item?.subItems && item?.subItems?.length > 0) {
      this.openMenuId = this.openMenuId === item?.id ? null : item?.id;
      return;
    }

    if (item?.route) {
      this.router?.navigate([item?.route])?.then(() => {
        // Optional: close sidebar on mobile after navigation
        // if (this.isMobile()) {
        //   this.isCollapsed = true;
        //   localStorage?.setItem('userCollapsed', 'true');
        // }
      });
    }
  }
  reviewList() {
    this.router?.navigate(['/review/list']);
  }
  handleLogout() {
    this.str?.logout();
    this.router?.navigate(['/login'])?.then(() => {});
  }

  // toggleSidebar() {
  //   this.isCollapsed = !this.isCollapsed;
  //   if (this.isMobile())
  //     localStorage.setItem('userCollapsed', this.isCollapsed?.toString());
  // }

  // @HostListener('window:resize')
  // onResize() {
  //   if (this.isMobile()) {
  //     const savedState = localStorage?.getItem('userCollapsed');
  //     this.isCollapsed = savedState === 'true' ? true : false;
  //   } else {
  //     this.isCollapsed = false; // Desktop always open
  //   }
  // }

  toggleThemeSelector() {
    this.showThemeSelector = !this.showThemeSelector;
  }

  selectTheme(theme: Theme) {
    this.themeService?.setTheme(theme);
    this.showThemeSelector = false;
  }
  opensetting() {
    this.isOpened = true;
  }
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event?.target as HTMLElement | null;
    const clickedInside = !!(target && target?.closest('.sidebar-footer'));
    if (!clickedInside) {
      if (this.showThemeSelector) this.showThemeSelector = false;
      this.isOpened = false;
    }
  }
  confirmLogout() {
    this.showLogoutConfirm = false;
    this.handleLogout();
  }
  cancelLogout() {
    this.showLogoutConfirm = false;
  }
  navigateCliet() {
    this.router?.navigate(['/organizations']);
  }
}
