import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyState } from '../ui/empty-state/empty-state';
import { PageHeader } from '../ui/page-header/page-header';

@Component({
  selector: 'app-workspace-placeholder',
  standalone: true,
  imports: [EmptyState, PageHeader, RouterLink],
  template: `
    <div class="p-4">
      <app-page-header [title]="title" [subtitle]="subtitle"></app-page-header>
      <app-empty-state
        [title]="title"
        message="This workspace route is ready. Existing LMS modules remain available through the current navigation links."
      ></app-empty-state>
      <a class="inline-block mt-4 px-3 py-2 rounded theme-bg-secondary theme-border" routerLink="/dashboard">
        Back to dashboard
      </a>
    </div>
  `,
})
export class WorkspacePlaceholder {
  title = 'Workspace';
  subtitle = '';

  constructor(private route: ActivatedRoute) {
    this.title = this.route.snapshot.data['title'] || 'Workspace';
    this.subtitle = this.route.snapshot.data['subtitle'] || '';
  }
}
