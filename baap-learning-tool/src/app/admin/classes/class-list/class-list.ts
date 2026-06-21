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
    <div class="min-h-full bg-slate-50 p-5 md:p-6">
      <app-page-header title="Classes" subtitle="Create classes and manage student membership">
        <a class="rounded-2xl bg-[#116466] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f3554]" routerLink="/admin/classes/create">
          Create Class
        </a>
      </app-page-header>

      @if (isLoading()) {
        <div class="rounded-3xl border border-slate-200/80 bg-white p-8 text-slate-500 shadow-sm">Loading classes...</div>
      } @else if (!classes().length) {
        <app-empty-state title="No classes found" message="Create a class to start grouping students."></app-empty-state>
      } @else {
        <div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[860px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-4">Class</th>
                  <th class="px-5 py-4">Description</th>
                  <th class="px-5 py-4">Created By</th>
                  <th class="px-5 py-4">Students</th>
                  <th class="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (item of classes(); track item.id) {
                  <tr class="transition hover:bg-slate-50/80">
                    <td class="px-5 py-4 font-bold text-slate-900">{{ item.name || item.class_name }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ item.description || '--' }}</td>
                    <td class="px-5 py-4 text-slate-600">{{ item.created_by || '--' }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-700">{{ item.students?.length ?? item.student_count ?? '--' }}</span></td>
                    <td class="px-5 py-4 text-right">
                      <div class="flex justify-end gap-2">
                        <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:text-teal-700" (click)="view(item.id)">
                          View
                        </button>
                        <button class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-[#116466]" (click)="manage(item.id)">
                          Manage Students
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
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
