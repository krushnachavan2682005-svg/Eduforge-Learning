import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-exam-menubar',
  imports: [CommonModule],
  templateUrl: './exam-menubar.html',
  styleUrl: './exam-menubar.scss',
})
export class ExamMenubar {
  @Input() questions: any[] = [];
  @Input() answeredStatus: boolean[] = [];
  @Input() currentQuestionIndex: number = 0;
  @Output() questionClicked = new EventEmitter<number>();

  onQuestionClick(index: number) {
    if (index >= 0 && index < this.questions?.length) {
      this.questionClicked?.emit(index);
    }
  }
}
