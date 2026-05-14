import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentReviewTest } from './student-review-test';

describe('StudentReviewTest', () => {
  let component: StudentReviewTest;
  let fixture: ComponentFixture<StudentReviewTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentReviewTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentReviewTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
