import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonHttpService } from '../services/common-http.service';
import { StorageService } from '../services/storage-service';
import { STORAGEENUMS } from '../shared/enum';
import { Tooltip } from '../shared/tooltip';
import { ToastrService } from 'ngx-toastr';
import { PermissionStore } from '../services/permission.service';

@Component({
  selector: 'app-select-client',
  standalone: true,
  imports: [FormsModule],
  providers: [StorageService],
  templateUrl: './select-client.html',
  styleUrls: ['./select-client.scss'],
})
export class SelectClient {
  private _searchTerm = signal<string>('');
  clientData = signal<any[]>([]);
  get searchTerm(): string {
    return this._searchTerm();
  }
  set searchTerm(val: string) {
    this._searchTerm?.set(val);
    this.onSearch();
  }

  private commonHttpService = inject(CommonHttpService);
  private route = inject(Router);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  ngOnInit() {
    this.onSearch();
  }

  onSearch() {
    const term = this._searchTerm();
    this.commonHttpService?.getClient(term)?.subscribe((res) => {
      const clients = res?.clients || [];
      this.clientData?.set(clients);
      this.str?.setItem(STORAGEENUMS?.CAN_SWITCH_ORG, clients?.length > 1);
    });
  }

   goBack() {
    const nav = window?.history?.state as any;
    const fromLogin = !!nav?.fromLogin;
    if (fromLogin) {
      this.route?.navigate(['/auth/login'], {
        replaceUrl: true,
        queryParams: { noRedirect: '1' },
      });
    } else if (window?.history?.length > 1) {
      window?.history?.back();
    } else {
      this.route?.navigate(['/']);
    }
  }

  restSearchData() {
    this.searchTerm = '';
  }

  onClickClient(data: any) {
    const clientId = data?.id ?? data?.client_id ?? data?.clientId;
    const userId = this.str?.getItem(STORAGEENUMS?.USER_ID);

    if (!clientId || !userId) {
      this.toastr.error('Invalid client or user id', 'Error');
      return;
    }

    this.str?.setItem(STORAGEENUMS?.CLIENT, JSON?.stringify(data));
    this.str?.setItem(STORAGEENUMS?.CLIENT_ID, clientId);

    this.commonHttpService
      .getPermissions('')
      .subscribe({
        next: (permRes: any) => {
          const directCodes =
            permRes?.data?.permission_codes ?? permRes?.permission_codes;
          const raw = directCodes ?? permRes?.permissions ?? permRes?.data ?? [];
          const list = Array?.isArray(raw) ? raw : (raw?.permissions ?? []);

          const normalized = (list as any[])?.flatMap((item: any) => {
            if (typeof item === 'string') return [item];
            const moduleName = item?.module?.name || '';
            const code = item?.permission?.code || '';
            const localCode = item?.code || '';
            const actions = item?.actions ?? [];

            const pairs = actions?.map((a: string) => `${moduleName}:${a}`);
            return [...pairs, code, localCode]?.filter(Boolean);
          });

          const finalList = Array?.from(new Set(normalized));

          this.str?.setItem(
            STORAGEENUMS?.PERMISSIONS,
            JSON?.stringify(finalList),
          );
          this.permissionStore?.setPermissions(
            Array?.from(new Set(normalized)),
          );
          this.route.navigate(['/dashboard']).then(() => {});
        },
        error: () => {
          this.toastr?.error('Failed to update permissions', 'Error');
        },
      });
  }
  private permissionStore = inject(PermissionStore);

  updatePermissions(list: string[]) {
    this.permissionStore?.setPermissions(list);
  }
}
