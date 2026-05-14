import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarService } from '../services/sidebar.service';
import { Tooltip } from './tooltip';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [Tooltip, CommonModule],
  templateUrl: './header.html',
  styleUrls: [],
})
export class HeaderComponent {
  @Input() title?: string;
  @Input() hasResume: any;
  @Input() userId?: string;
  @Input() resumeForm: any;
  @Input() subTitle?: string;
  @Input() titleName?: string;
  @Input() name?: string = '';
  isResumePage: boolean = false;
  @Input() isLoading: boolean = false;
  @Input() studentClass?: string = '';
  @Input() actionButtonLabel?: string;
  @Input() isEditMode: boolean = false;
  @Input() creditScore?: number | string;
  @Input() showBackButton: boolean = false;
  @Input() showActionButton: boolean = false;
  @Input() showSidebarToggle: boolean = false;
  @Output() createLinkEvent = new EventEmitter<void>();
  @Input() showBackBtnAndTitleSubtitle: boolean = false;

  private sidebarService = inject(SidebarService);
  isSidebarOpen = this.sidebarService?.isOpen;

  constructor(private router: Router) {
    this.isResumePage =
      this.router.url?.includes('/resume') &&
      !this.router.url?.includes('/resume/create');
  }

  private location = inject(Location);
  goBack() {
    this.location?.back();
  }

  goToCreateResume() {
    if (this.hasResume()) {
      this.router?.navigate([`/resume/edit/${this.userId}`]);
    } else {
      this.router?.navigate(['/resume/create']);
    }
  }

  downloadResume() {
    const event = new CustomEvent('downloadResume');
    window?.dispatchEvent(event);
  }

  createLink() {
    this.createLinkEvent.emit();
  }

  toggleSidebar() {
    this.sidebarService?.toggleSidebar();
  }
}
