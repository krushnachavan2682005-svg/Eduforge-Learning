import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamMenubar } from './exam-menubar';

describe('ExamMenubar', () => {
  let component: ExamMenubar;
  let fixture: ComponentFixture<ExamMenubar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamMenubar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamMenubar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
