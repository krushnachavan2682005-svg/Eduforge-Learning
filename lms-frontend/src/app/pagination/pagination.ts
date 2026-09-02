import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarService } from '../services/sidebar.service';

export interface PaginationMetadata {
  limit: number;
  next_cursor: string | null;
  has_next: boolean;
  total?: number;
  totalPages?: number;
  currentPage?: number;
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class PaginationComponent {
  // Legacy inputs
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions = [10, 20, 30, 40, 50];

  // Cursor inputs
  @Input() mode: 'legacy' | 'cursor' = 'legacy';
  @Input() paginationMeta: PaginationMetadata | null = null;

  // Legacy outputs
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  // Cursor outputs
  @Output() cursorChange = new EventEmitter<string | undefined>();

  public sidebarService = inject(SidebarService);
  isDropdownOpen = false;

  // Cursor state
  cursorHistory: (string | undefined)[] = [];

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

  // --- Legacy Methods ---
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  // --- Cursor Methods ---
  goNextCursor() {
    if (this.paginationMeta?.has_next && this.paginationMeta.next_cursor) {
      const currentUsedCursor = this.cursorHistory.length > 0 
        ? this.cursorHistory[this.cursorHistory.length - 1] 
        : undefined;
      
      this.cursorHistory.push(this.paginationMeta.next_cursor);
      this.cursorChange.emit(this.paginationMeta.next_cursor);
    }
  }

  goPrevCursor() {
    if (this.cursorHistory.length > 0) {
      this.cursorHistory.pop(); // remove current cursor
      const prevCursor = this.cursorHistory.length > 0 
        ? this.cursorHistory[this.cursorHistory.length - 1] 
        : undefined;
      this.cursorChange.emit(prevCursor);
    }
  }

  resetCursor() {
    this.cursorHistory = [];
    this.cursorChange.emit(undefined);
  }

  // --- Shared Methods ---
  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  onPageSizeChange(size: number) {
    this.pageSizeChange.emit(size);
    this.isDropdownOpen = false;
  }
}
