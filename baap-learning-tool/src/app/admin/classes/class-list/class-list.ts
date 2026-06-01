import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonHttpService } from '../../../services/common-http.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

@Component({
  selector: 'app-class-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeader, EmptyState],
  template: `
    <div class="p-4">
      <app-page-header title="Classes" subtitle="Create classes and manage student membership">
        <a class="px-3 py-2 rounded theme-bg-secondary theme-border font-semibold" routerLink="/admin/classes/create">
          Create Class
        </a>
      </app-page-header>

      @if (isLoading()) {
        <div class="p-6 theme-bg-secondary theme-border rounded">Loading classes...</div>
      } @else if (!classes().length) {
        <app-empty-state title="No classes found" message="Create a class to start grouping students."></app-empty-state>
      } @else {
        <div class="overflow-x-auto theme-border rounded">
          <table class="w-full text-left">
            <thead class="theme-bg-secondary">
              <tr>
                <th class="p-3">Class</th>
                <th class="p-3">Description</th>
                <th class="p-3">Created By</th>
                <th class="p-3">Students</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (item of classes(); track item.id) {
                <tr class="border-t theme-border">
                  <td class="p-3 font-medium">{{ item.name || item.class_name }}</td>
                  <td class="p-3">{{ item.description || '--' }}</td>
                  <td class="p-3">{{ item.created_by || '--' }}</td>
                  <td class="p-3">{{ item.students?.length ?? item.student_count ?? '--' }}</td>
                  <td class="p-3 text-right">
                    <button class="px-3 py-1 mr-2 rounded theme-bg-secondary theme-border" (click)="view(item.id)">
                      View
                    </button>
                    <button class="px-3 py-1 rounded theme-bg-secondary theme-border" (click)="manage(item.id)">
                      Manage Students
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ClassList {
  classes = signal<any[]>([]);
  isLoading = signal(false);
  private router = inject(Router);
  private commonHttp = inject(CommonHttpService);

  ngOnInit() {
    this.loadClasses();
  }

  loadClasses() {
    this.isLoading.set(true);
    this.commonHttp.getClassesList().subscribe({
      next: (res: any) => {
        this.classes.set(res?.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.classes.set([]);
        this.isLoading.set(false);
      },
    });
  }

  view(id: string) {
    this.router.navigate(['/admin/classes', id]);
  }

  manage(id: string) {
    this.router.navigate(['/admin/classes', id, 'students']);
  }
}
