import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  isOpen = signal<boolean>(false);
  courseId = signal<string>('');

  openSidebar(courseId: string) {
    this.courseId?.set(courseId);
    this.isOpen?.set(true);
  }

  closeSidebar() {
    this.isOpen?.set(false);
    this.courseId?.set('');
  }
  toggleSidebar() {
    this.isOpen?.update((current) => !current);
    if (!this.isOpen()) {
      this.courseId?.set('');
    }
  }
}
