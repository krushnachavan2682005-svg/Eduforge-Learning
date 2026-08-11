import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarService } from '../services/sidebar.service';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class PaginationComponent {
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions = [10, 20, 30, 40, 50];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  public sidebarService = inject(SidebarService);
  isDropdownOpen = false;

  get pages(): number[] {
    const maxVisiblePages = 7;
    let startPage: number;
    let endPage: number;

    const total = this.totalPages || 1;

    if (total <= maxVisiblePages) {
      startPage = 1;
      endPage = total;
    } else {
      let maxPagesBeforeCurrentPage = Math.floor(maxVisiblePages / 2);
      let maxPagesAfterCurrentPage = Math.ceil(maxVisiblePages / 2) - 1;

      if (this.currentPage <= maxPagesBeforeCurrentPage) {
        startPage = 1;
        endPage = maxVisiblePages;
      } else if (this.currentPage + maxPagesAfterCurrentPage >= total) {
        startPage = total - maxVisiblePages + 1;
        endPage = total;
      } else {
        startPage = this.currentPage - maxPagesBeforeCurrentPage;
        endPage = this.currentPage + maxPagesAfterCurrentPage;
      }
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  onPageSizeChange(size: number) {
    this.pageSizeChange.emit(size);
    this.isDropdownOpen = false;
  }
}
