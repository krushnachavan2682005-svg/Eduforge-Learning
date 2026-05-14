import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
} from '@angular/core';
import { PermissionStore } from './permission.service';

@Directive({
  selector: '[authorize]',
  standalone: true,
})
export class PermissionDirective {
  private requiredPermissions: string[] = [];

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionStore: PermissionStore,
  ) {
    effect(() => {
      const hasPermission = this.requiredPermissions?.some((p) =>
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
      this.requiredPermissions = [];
      return;
    }
    if (Array.isArray(value)) {
      this.requiredPermissions = value;
    } else {
      this.requiredPermissions = value?.split(',')?.map((v) => v?.trim());
    }
  }
}
