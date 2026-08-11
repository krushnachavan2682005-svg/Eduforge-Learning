
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StudentResult } from './student-result';

describe('StudentResult', () => {
  let component: StudentResult;
  let fixture: ComponentFixture<StudentResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentResult]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StudentResult);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
