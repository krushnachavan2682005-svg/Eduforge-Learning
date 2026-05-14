import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Sidebar } from './shared/sidebar/sidebar';
import { filter } from 'rxjs/operators';
import { StorageService } from './services/storage-service';
import { STORAGEENUMS } from './shared/enum';
import { PermissionStore } from './services/permission.service';
import { SidebarService } from './services/sidebar.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  isUser: any;
  private router = inject(Router);
  protected title = 'Credit Portal';
  private str = inject(StorageService);
  private sidebarService = inject(SidebarService);
  isOpen = this.sidebarService?.isOpen;
  private permissionStore = inject(PermissionStore);
  private readonly hiddenSidebarRoutes = [
    '/auth',
    '/login',
    '/start-exam',
    '/organizations',
    '/student-view',
    '/resume/shared',
  ];
  ngOnInit(): void {
    this.setupRouteListener();
    this.permissionStore?.loadFromStorage();
  }

  get user() {
    return this.str?.getItem(STORAGEENUMS?.USER_ID);
  }

  isSidebarAllowed(): boolean {
    const currentUrl = this.router?.url || '';
    return !!this.user && !this.shouldHideSidebar(currentUrl);
  }

  isSharedResumeRoute(): boolean {
    return this.router?.url?.includes('/resume/shared');
  }
  private shouldHideSidebar(url: string): boolean {
    return this.hiddenSidebarRoutes.some((route) => url?.includes(route));
  }
  private setupRouteListener(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const shouldShowSidebar = !this.shouldHideSidebar(event?.url);
        if (this.user && shouldShowSidebar) {
          this.sidebarService?.isOpen?.set(true);
        } else if (shouldShowSidebar) {
          this.sidebarService?.isOpen?.set(false);
        } else {
          this.sidebarService?.isOpen?.set(false);
        }
      });

    const currentUrl = this.router?.url || '';
    const shouldShowSidebar = !this.shouldHideSidebar(currentUrl);
    this.sidebarService?.isOpen?.set(this.user && shouldShowSidebar);
  }
}
