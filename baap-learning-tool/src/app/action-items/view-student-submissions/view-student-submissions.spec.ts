import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewStudentSubmissions } from './view-student-submissions';

describe('ViewStudentSubmissions', () => {
  let component: ViewStudentSubmissions;
  let fixture: ComponentFixture<ViewStudentSubmissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewStudentSubmissions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewStudentSubmissions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
