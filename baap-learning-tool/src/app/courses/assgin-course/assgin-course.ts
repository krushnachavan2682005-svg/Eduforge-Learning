import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import {
  FormGroup,
  Validators,
  FormBuilder,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { CommonHttpService } from '../../services/common-http.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { Tooltip } from '../../shared/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-assgin-course',
  imports: [
    FormsModule,
    CommonModule,
    NgSelectModule,
    ReactiveFormsModule,
    Tooltip,
  ],
  templateUrl: './assgin-course.html',
  styleUrl: './assgin-course.scss',
})
export class AssginCourse {
  limit = 10;
  user_id = '';
  clientId = '';
  showModal = false;
  classes: any[] = [];
  userPage = signal(1);
  @Input() show = false;
  coursePage = signal(1);
  assignForm!: FormGroup;
  SelectData: any = null;
  currentPage = signal(1);
  selectClassData: any = null;
  selectedUsers: any[] = [];
  isLoading = signal(false);
  selectedClass: any[] = [];
  SelectUserData: any = null;
  courses = signal<any[]>([]);
  selectedCourses = signal<any[]>([]);
  hasMoreUsers = signal(true);
  searchUserQuery = signal('');
  hasMoreCourses = signal(true);
  coursesLoaded = signal(false);
  isLoadingUsers = signal(false);
  isSidebarOpen: boolean = false;
  isLoadingCourses = signal(false);
  private fb = inject(FormBuilder);
  private str = inject(StorageService);
  private toastr = inject(ToastrService);
  private commonHttp = inject(CommonHttpService);
  @Output() closePopUp = new EventEmitter<void>();
  usersList = signal<{ id: string; name: string }[]>([]);

  selectCategory = [
    { id: 1, name: 'Class' },
    { id: 2, name: 'Student' },
  ];

  ngOnInit() {
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';
    this.getUsers();
    this.getCourses();
    this.getClasses();
    this.assignForm = this.fb?.group({
      selectedCategory: [null],
      selectedUser: [null],
      selectedClasses: [''],
      selectedCourse: [null],
    });
  }

  getCourseTitle(id: number): string {
    const course = this?.courses()?.find((c) => c?.id === id);
    return course ? course?.title : 'Unknown';
  }

  getClasses() {
    this.commonHttp
      ?.getClasses(
        `/classes/client/${this.clientId}?page=${this.currentPage()}&limit=${this.limit}`,
      )
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
  }

  getCourses() {
    if (!this.hasMoreCourses()) return;

    this.isLoading?.set(true);

    this.commonHttp
      .getCourse(
        `/client/${this.clientId}/all-courses?page=${this.coursePage()}&limit=${this.limit}`,
      )
      .subscribe((res: any) => {
        const coursesData = res?.items || [];
        this.courses?.update((prev) => [...prev, ...coursesData]);
        this.isLoading?.set(false);

        if (this.coursePage() >= res?.pagination?.totalPages) {
          this.hasMoreCourses?.set(false);
        } else {
          this.coursePage?.update((p) => p + 1);
        }
      });
  }

  getUsers(searchTerm: string = '') {
    if (!this.hasMoreUsers() || this.isLoadingUsers()) return;

    this.isLoadingUsers?.set(true);

    const url = `/auth/api/addmissions/client/${this.clientId}?page=${this.currentPage()}&limit=${this.limit}&k=${searchTerm}`;

    this.commonHttp.getUser(url).subscribe({
      next: (res: any) => {
        const users = res?.addmission || [];
        const mappedUsers = users?.map((user: any) => ({
          id: user?.user_id,
          name: `${user?.first_name} ${user?.last_name}`,
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
      error: (err) => {
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

  assignCourseForm() {
    if (this.assignForm?.invalid) return this.assignForm?.markAllAsTouched();
    const isClass = this.assignForm.get('selectedCategory')?.value === 1;
    const payloadKey = isClass ? 'class_id' : 'user_id';
    const targetIds = (isClass ? this.selectedClass : this.selectedUsers).map(
      (i) => i.id,
    );
    const requests = this.selectedCourses().map((course) =>
      this.commonHttp
        .postCourse(`/client/${this.clientId}/assign-course`, {
          course_id: [course.id],
          [payloadKey]: targetIds,
        })
        .pipe(catchError(() => of({ error: true }))),
    );
    forkJoin(requests).subscribe((results) => {
      const hasSuccess = results.some((r: any) => !r?.error);
      if (hasSuccess) {
        this.closeSidebar();
        this.toastr.success('Courses Assigned Successfully');
        } else {
          this.toastr.error('Course already assigned.');
        }
      });
  }

  onScrollToEnd() {
    this.getUsers();
    this.getCourses();
  }
  openSidebar() {
    this.isSidebarOpen = true;
    this.showModal = true;
    this.courses.set([]);
    this.coursePage.set(1);
    this.hasMoreCourses.set(true);
    this.getCourses();
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
    this.selectedCourses.set([]);
    this.SelectUserData = null;
    this.selectClassData = null;
    this.SelectData = null;
  }

  addSelectedUser(user: any) {
    if (!user) return;
    const exists = this.selectedUsers?.some((u) => u?.id === user?.id);
    if (!exists) {
      this.selectedUsers?.push(user);
    }
    setTimeout(() => {
      this.SelectUserData = null;
    });
  }

  removeUser(index: number) {
    this.selectedUsers?.splice(index, 1);
    // Update form control without triggering validation
    this.assignForm.get('selectedUser')?.patchValue(
      this.selectedUsers?.map((u) => u?.id),
      { emitEvent: false },
    );
  }

  addSelectedClass(selected: any) {
    const exists = this.selectedClass?.some((c) => c?.id === selected?.id);
    if (!exists) this.selectedClass?.push(selected);
    setTimeout(() => (this.selectClassData = null));
  }

  removeClass(index: number) {
    this.selectedClass?.splice(index, 1);
    this.assignForm.get('selectedClasses')?.patchValue(
      this.selectedClass?.map((cl) => cl?.id),
      { emitEvent: false },
    );
  }

  addSelectedCourse(course: any) {
    if (!course) return;
    const exists = this.selectedCourses().some((c) => c.id === course.id);
    if (exists) {
      this.toastr?.warning(
        'Course already assigned',
        '',
        // { closeButton: true },
      );
      this.assignForm.get('selectedCourse')?.reset();
      return;
    }
    this.selectedCourses.update((prev) => [...prev, course]);
    this.assignForm.get('selectedCourse')?.reset();
  }

  removeCourse(index: number) {
    this.selectedCourses.update((prev) => prev.filter((_, i) => i !== index));
  }
}
