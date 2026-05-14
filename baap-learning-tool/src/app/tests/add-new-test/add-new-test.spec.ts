import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNewTest } from './add-new-test';

describe('AddNewTest', () => {
  let component: AddNewTest;
  let fixture: ComponentFixture<AddNewTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNewTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddNewTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
