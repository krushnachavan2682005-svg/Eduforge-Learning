import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  today = new Date();

  fixDate(dateString: string): Date {
    const d = new Date(dateString);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d;
  }

  generateDays(year: number, month: number): (number | null)[] {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    return Array(firstDay)
      .fill(null)
      .concat(Array.from({ length: totalDays }, (_, i) => i + 1));
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  validateRequired(control: AbstractControl): ValidationErrors | null {
    return !control.value ? { required: true } : null;
  }

  validateMinDate(
    control: AbstractControl,
    minDate: Date = this.today,
  ): ValidationErrors | null {
    if (!control.value) return null;
    const selected = new Date(control.value);
    return selected < minDate ? { dateTooEarly: true } : null;
  }

  validateMaxDate(
    control: AbstractControl,
    maxDate: Date = new Date(
      this.today.setFullYear(this.today.getFullYear() + 5),
    ),
  ): ValidationErrors | null {
    if (!control.value) return null;
    const selected = new Date(control.value);
    return selected > maxDate ? { dateTooLate: true } : null;
  }
}
