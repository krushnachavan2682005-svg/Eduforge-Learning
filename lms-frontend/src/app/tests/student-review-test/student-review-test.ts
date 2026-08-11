import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { ActivatedRoute } from '@angular/router';
import { STORAGEENUMS } from '../../shared/enum';
import { StorageService } from '../../services/storage-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-review-test',
  imports: [FormsModule, CommonModule],
  templateUrl: './student-review-test.html',
  styleUrl: './student-review-test.scss',
})
export class StudentReviewTest {
  user_id = '';
  client_id = '';
  exam_id: string = '';
  examData = signal<any>({});
  questions = signal<any[]>([]);
  currentQuestionIndex: number = 0;
  private str = inject(StorageService);
  selectedOptions = signal<string[]>([]);
  private route = inject(ActivatedRoute);
  private http = inject(CommonHttpService);
  ngOnInit() {
    this.client_id = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.user_id = this.str?.getItem(STORAGEENUMS?.USER_ID) || '';

    this.route?.params?.subscribe((params: any) => {
      this.exam_id = params['id'];
      this.getStudentSubmissions();
    });
  }

  getStudentSubmissions() {
    this.http
      .getCourse(
        `/exam/${this?.exam_id}/review_student_id/${this.user_id}`,
      )
      .subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.examData.set(res?.data || {});
            this.questions.set(res?.data?.review_details || []);

            const initialOptions = res?.data?.review_details?.map(
              (q: any) => q?.user_answer || '',
            );
            this.selectedOptions.set(initialOptions);
          }
        },
      });
  }

  goToPreviousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  goToNextQuestion() {
    if (this.currentQuestionIndex < this.questions().length - 1) {
      this.currentQuestionIndex++;
    }
  }

  goBack(){
    window.history.back();
  }
}
