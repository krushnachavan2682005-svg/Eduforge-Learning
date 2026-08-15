import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  signal,
} from '@angular/core';
import { PermissionStore } from './permission.service';

@Directive({
  selector: '[authorize]',
  standalone: true,
})
export class PermissionDirective {
  private requiredPermissions = signal<string[]>([]);

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionStore: PermissionStore,
  ) {
    effect(() => {
      const reqPerms = this.requiredPermissions();
      if (!reqPerms || reqPerms.length === 0) {
        this.viewContainer?.clear();
        return;
      }

      const hasPermission = reqPerms.some((p) =>
        this.permissionStore?.hasPermission(p),
      );

      if (hasPermission) {
        this.viewContainer?.clear();
        this.viewContainer?.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer?.clear();
      }
    });
  }

  @Input() set authorize(value: string | string[] | null | undefined) {
    if (!value) {
      this.requiredPermissions.set([]);
      return;
    }
    if (Array.isArray(value)) {
      this.requiredPermissions.set(value);
    } else {
      this.requiredPermissions.set(value?.split(',')?.map((v) => v?.trim()) || []);
    }
  }
}
