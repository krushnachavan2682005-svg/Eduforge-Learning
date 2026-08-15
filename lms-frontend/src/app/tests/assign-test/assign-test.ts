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
  selector: 'app-assign-test',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, Tooltip],
  templateUrl: './assign-test.html',
  styleUrls: ['./assign-test.scss'],
})
export class AssignTest implements OnInit {
  limit = 10;
  userId: any;
  clientId: any;
  showModal = false;
  @Input() open = false;
  assignForm: FormGroup;
  isSidebarOpen = false;
  currentPage = signal(1);
  selectedUsers: any[] = [];
  selectedTests: any[] = [];
  selectedClass: any[] = [];
  hasMoreUsers = signal(true);
  isLoadingUsers = signal(false);
  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);
  usersList = signal<{ id: string; name: string }[]>([]);

  selectCategory = [
    { id: 1, name: 'Class' },
    { id: 2, name: 'Student' },
  ];

  constructor() {
    this.assignForm = this.fb.group({
      selectedCategory: [null, Validators.required],
      selectedUser: [null],
      selectedClasses: [''],
      selectedTest: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.getClasses();
    this.loadTests();
  }

  testsList = signal<{ id: string; title: string }[]>([]);

  classes: any[] = [];

  isExamExpired(exam: any): boolean {
  if (!exam?.exam_date) return false;

  const examDate = new Date(exam.exam_date);
  examDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return examDate < today;
  }

  loadTests() {
    const endpoint = `/all-exams`;
    this.commonHttp.getCourse(endpoint).subscribe({
      next: (res: any) => {
        const exams = res?.exams || res?.data || [];
        const activeExams = exams.filter((e: any) => !this.isExamExpired(e));
        const mapped = activeExams.map((e: any) => ({
          id: e?.id || e?.exam_id || '',
          title: e?.title || e?.name || e?.exam_name || 'Untitled',
        }));
        this.testsList.set(mapped);
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
    this.assignForm.patchValue({
      selectedUser: null,
      selectedClasses: null,
    });
    if (event?.id === 2) {
      this.currentPage.set(1);
      this.hasMoreUsers.set(true);
      this.usersList.set([]);
      this.getUsers();
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
    this.selectedTests = [];
    this.usersList.set([]);
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

  addSelectedTest(test: any) {
    if (!test) return;
    const exists = this.selectedTests?.some((t) => t?.id === test?.id);
    if (exists) {
      this.toastr?.warning(
        'Test already selected. Duplicate entries are not allowed.',
        '',
        {
          closeButton: true,
        },
      );
      return;
    }
    this.selectedTests?.push(test);
    this.assignForm.get('selectedTest')?.patchValue(null, { emitEvent: false });
  }

  removeTest(index: number) {
    this.selectedTests?.splice(index, 1);
  }

  assignTestForm() {
    if (!this.assignForm) return;

    const category = Number(this.assignForm.get('selectedCategory')?.value);

    const tests = this.selectedTests?.map((t) => t.id) || [];
    const classes = this.selectedClass?.map((c) => c.id) || [];
    const users = this.selectedUsers?.map((u) => u.id) || [];

    if (tests.length === 0) {
      this.toastr.error('Please select at least one test.', '', {
        // closeButton: true,
      });
      return;
    }

    const payload: any = { exam_id: tests };

    if (category === 1) {
      if (classes.length === 0) {
        this.toastr.error('Please select at least one class.', '', {
          // closeButton: true,
        });
        return;
      }
      payload.class_id = classes;
    }

    if (category === 2) {
      if (users.length === 0) {
        this.toastr.error('Please select at least one student.', '', {
          // closeButton: true,
        });
        return;
      }
      payload.user_id = users;
    }

    if (!payload.class_id && !payload.user_id) {
      this.toastr.error('Please select a valid category.', '', {
        // closeButton: true,
      });
      return;
    }

    this.commonHttp
      .postCourse(`/exams/assign`, payload)
      .subscribe({
        next: () => {
          this.isSidebarOpen = false;
          this.showModal = false;
          this.assignForm.reset();
          this.selectedClass = [];
          this.selectedUsers = [];
          this.selectedTests = [];
          this.toastr.success('Test Assigned Successfully', '', {
            // closeButton: true,
          });
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            'Test already assigned. Duplicate entries are not allowed.';
          this.toastr.error(msg, '', 
            // { closeButton: true }
          );
        },
      });
  }
}
