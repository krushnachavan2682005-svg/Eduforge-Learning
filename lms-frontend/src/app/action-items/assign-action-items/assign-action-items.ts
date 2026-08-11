import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { CommonHttpService } from '../../services/common-http.service';
import { ToastrService } from 'ngx-toastr';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { Tooltip } from '../../shared/tooltip';

@Component({
  selector: 'app-assign-action-items',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, Tooltip],
  templateUrl: './assign-action-items.html',
  styleUrls: ['./assign-action-items.scss'],
})
export class AssignActionItems implements OnInit {
  limit = 10;
  userId: any;
  clientId: any;
  showModal = false;
  @Input() open = false;
  assignForm: FormGroup;
  isSidebarOpen = false;
  currentPage = signal(1);
  selectedUsers: any[] = [];
  selectedActionItems: any[] = [];
  selectedClass: any[] = [];
  selectedRoles: any[] = [];
  hasMoreUsers = signal(true);
  isLoadingUsers = signal(false);
  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);
  usersList = signal<{ id: string; name: string }[]>([]);
  rolesList = signal<{ id: string; name: string }[]>([]);

  selectCategory = [
    { id: 1, name: 'Class' },
    { id: 2, name: 'Student' },
    { id: 3, name: 'Role' },
    { id: 4, name: 'Organization' },
  ];

  constructor() {
    this.assignForm = this.fb.group({
      selectedCategory: [null, Validators.required],
      selectedUser: [null],
      selectedClasses: [''],
      selectedRole: [null],
      selectedActionItem: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.getClasses();
    this.loadActionItems();
  }

  actionItemsList = signal<{ id: string; task_name: string }[]>([]);

  classes: any[] = [];

  loadActionItems() {
    if (!this.clientId) return;
    const endpoint = `/action-items`;
    this.commonHttp.getCourse(endpoint).subscribe({
      next: (res: any) => {
        const actionItems = res?.data?.items || [];
        const mapped = actionItems.map((item: any) => ({
          id: item?.id || '',
          task_name: item?.task_name || '',
        }));
        this.actionItemsList.set(mapped);
      },
      error: (err) => {
        console.error('Error loading action items:', err);
      },
    });
  }

  getClasses() {
    this.commonHttp
      ?.getClasses('')
      .subscribe((res: any) => {
        this.classes = res?.classrooms ?? [];
      });
  }

  onCategoryChange(event: any) {
    this.selectedUsers = [];
    this.selectedClass = [];
    this.selectedRoles = [];
    this.assignForm.patchValue({
      selectedUser: null,
      selectedClasses: null,
      selectedRole: null,
    });
    if (event?.id === 2) {
      this.currentPage.set(1);
      this.hasMoreUsers.set(true);
      this.usersList.set([]);
      this.getUsers();
    }
    if (event?.id === 3) {
      this.getRoles();
    }
  }

  getUsers(searchTerm: string = '') {
    if (!this.hasMoreUsers() || this.isLoadingUsers()) return;
    this.isLoadingUsers.set(true);

    this.commonHttp.getLocalStudents().subscribe({
      next: (res: any) => {
        const users = res?.data || [];
        const mappedUsers = users?.map((u: any) => ({
          id: u?.user_id,
          name: `${u?.first_name} ${u?.last_name}`,
        }));

        if (searchTerm) {
          this.usersList?.set(mappedUsers);
        } else {
          this.usersList?.update((prev) => [...prev, ...mappedUsers]);
        }

        if (users.length < this.limit) {
          this.hasMoreUsers?.set(false);
        } else {
          this.currentPage?.update((p) => p + 1);
        }

        this.isLoadingUsers?.set(false);
      },
      error: () => {
        this.isLoadingUsers?.set(false);
      },
    });
  }

  onSearchUsers(term: string) {
    this.currentPage?.set(1);
    this.hasMoreUsers?.set(true);
    this.usersList?.set([]);
    this.getUsers(term);
  }

  onScrollToEnd() {
    const selectedCategory = this.assignForm.get('selectedCategory')?.value;
    if (selectedCategory === 2) this.getUsers();
  }

  openSidebar() {
    this.isSidebarOpen = true;
    this.showModal = true;
    this.loadActionItems();
  }
  closeSidebar() {
    this.showModal = false;
    this.isSidebarOpen = false;
    this.clearFormData();
  }

  clearFormData() {
    this.assignForm?.reset();
    this.selectedUsers = [];
    this.selectedClass = [];
    this.selectedRoles = [];
    this.selectedActionItems = [];
    this.usersList.set([]);
    this.rolesList.set([]);
    this.currentPage.set(1);
    this.hasMoreUsers.set(true);
  }

  addSelectedUser(user: any) {
    if (!user) return;
    const exists = this.selectedUsers?.some((u) => u?.id === user?.id);
    if (!exists) {
      this.selectedUsers?.push(user);
    }
    this.assignForm.get('selectedUser')?.patchValue(null, { emitEvent: false });
  }

  removeUser(index: number) {
    this.selectedUsers?.splice(index, 1);
  }

  addSelectedClass(selected: any) {
    if (!selected) return;
    const exists = this.selectedClass?.some((c) => c?.id === selected?.id);
    if (!exists) this.selectedClass?.push(selected);
    this.assignForm
      .get('selectedClasses')
      ?.patchValue(null, { emitEvent: false });
  }

  removeClass(index: number) {
    this.selectedClass?.splice(index, 1);
  }

  getRoles() {
    this.commonHttp.getLocalUserMe().subscribe({
      next: (res: any) => {
        const users = [res?.data].filter(Boolean);
        const rolesMap = new Map<string, string>();
        
        users.forEach((user: any) => {
          if (user?.role) {
            // Check if role is an object with name property or just a string
            const roleId = typeof user.role === 'object' ? (user.role?.id || user.role?.name) : user.role;
            const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
            
            if (roleId && roleName && !rolesMap.has(roleId)) {
              rolesMap.set(roleId, roleName);
            }
          }
        });
        
        const mappedRoles = Array.from(rolesMap.entries()).map(([id, name]) => ({
          id: id,
          name: name,
        }));
        
        this.rolesList.set(mappedRoles);
      },
      error: () => {
        this.toastr.error('Failed to load roles', '', { closeButton: true });
      },
    });
  }

  addSelectedRole(role: any) {
    if (!role) return;
    const exists = this.selectedRoles?.some((r) => r?.id === role?.id);
    if (!exists) this.selectedRoles?.push(role);
    this.assignForm.get('selectedRole')?.patchValue(null, { emitEvent: false });
  }

  removeRole(index: number) {
    this.selectedRoles?.splice(index, 1);
  }

  addSelectedActionItem(actionItem: any) {
    if (!actionItem) return;
    const exists = this.selectedActionItems?.some((t) => t?.id === actionItem?.id);
    if (exists) {
      this.toastr?.warning(
        'Action Item already selected. Duplicate entries are not allowed.',
        '',
        // {
        //   closeButton: true,
        // },
      );
      return;
    }
    this.selectedActionItems?.push(actionItem);
    this.assignForm.get('selectedActionItem')?.patchValue(null, { emitEvent: false });
  }

  removeActionItem(index: number) {
    this.selectedActionItems?.splice(index, 1);
  }

  assignActionItemForm() {
    if (!this.assignForm) return;

    const category = Number(this.assignForm.get('selectedCategory')?.value);

    const actionItems = this.selectedActionItems?.map((t) => t.id) || [];
    const classes = this.selectedClass?.map((c) => c.id) || [];
    const users = this.selectedUsers?.map((u) => u.id) || [];
    const roles = this.selectedRoles?.map((r) => r.id) || [];

    if (actionItems.length === 0) {
      this.toastr.error('Please select at least one action item', '', {
        // closeButton: true,
      });
      return;
    }

    const payload: any = { action_item_id: actionItems };

    if (category === 1) {
      if (classes.length === 0) {
        this.toastr.error('Please select at least one class', '', {
          // closeButton: true,
        });
        return;
      }
      payload.class_id = classes;
    }

    if (category === 2) {
      if (users.length === 0) {
        this.toastr.error('Please select at least one student', '', {
          // closeButton: true,
        });
        return;
      }
      payload.user_id = users;
    }

    if (category === 3) {
      if (roles.length === 0) {
        this.toastr.error('Please select at least one role', '', {
          // closeButton: true,
        });
        return;
      }
      payload.role = roles;
    }
    if (category === 4) {
      payload.client = this.clientId;
    }

    if (!payload.class_id && !payload.user_id && !payload.role && !payload.client) {
      this.toastr.error('Please select a valid category', '', {
        // closeButton: true,
      });
      return;
    }

    this.commonHttp
      .postCourse(`/assign-action-items`, payload)
      .subscribe({
        next: () => {
          this.isSidebarOpen = false;
          this.showModal = false;
          this.assignForm.reset();
          this.selectedClass = [];
          this.selectedUsers = [];
          this.selectedRoles = [];
          this.selectedActionItems = [];
          this.toastr.success('Action Item Assigned Successfully', '', {
            // closeButton: true,
          });
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            'Action Item already assigned. Duplicate entries are not allowed.';
          this.toastr.error(msg, '', 
            // { closeButton: true }
          );
        },
      });
  }
}
