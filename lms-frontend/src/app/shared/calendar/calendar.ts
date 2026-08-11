import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CalendarService } from '../../services/calender-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnChanges {
  @ViewChild('calendarBox') calendarBox!: ElementRef;
  @Input() value: string | null = null;
  @Input() min: string | null = null;
  @Output() dateSelected = new EventEmitter<string>();

  calendarOpen = false;
  days: (number | null)[] = [];
  selectedDate: Date | null = null;
  currentMonth = new Date()?.getMonth();
  currentYear = new Date()?.getFullYear();

  months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  private calService = inject(CalendarService);

  ngOnInit() {
    this.updateCalendar();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && !changes['value']?.firstChange) {
      this.updateCalendar();
    }
  }

  private updateCalendar() {
    const date = this.value ? new Date(this.value) : null;

    if (date && !isNaN(date?.getTime())) {
      this.selectedDate = date;
      this.currentMonth = date?.getMonth();
      this.currentYear = date?.getFullYear();
    } else {
      this.selectedDate = null;
    }

    this.generateCalendar();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (
      this?.calendarOpen &&
      this?.calendarBox &&
      !this?.calendarBox?.nativeElement?.contains(event?.target)
    ) {
      this.calendarOpen = false;
    }
  }

  toggleCalendar() {
    this.calendarOpen = !this?.calendarOpen;
  }
  clearSelection() {
    this.selectedDate = null;
  }
  generateCalendar() {
    this.days = this?.calService?.generateDays(
      this?.currentYear,
      this?.currentMonth,
    );
  }

  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this?.generateCalendar();
  }

  selectDate(day: number | null) {
    if (!day || this.isDisabled(day)) return;

    this.selectedDate = new Date(this?.currentYear, this?.currentMonth, day);
    const formatted = this?.calService?.formatDate(this?.selectedDate);
    this?.dateSelected?.emit(formatted);
    this.calendarOpen = false;
  }

  isSelected(day: number | null) {
    if (!this?.selectedDate || !day) return false;
    return (
      this?.selectedDate?.getDate() === day &&
      this?.selectedDate?.getMonth() === this?.currentMonth &&
      this?.selectedDate?.getFullYear() === this?.currentYear
    );
  }
  isDisabled(day: number | null): boolean {
    if (!day || !this.min) return false;
    const dateToCheck = new Date(this.currentYear, this.currentMonth, day);
    dateToCheck.setHours(0, 0, 0, 0);
    const minDate = new Date(this.min);
    minDate.setHours(0, 0, 0, 0);
    return dateToCheck < minDate;
  }
}
