import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddActionItems } from './add-action-items';

describe('AddActionItems', () => {
  let component: AddActionItems;
  let fixture: ComponentFixture<AddActionItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddActionItems]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddActionItems);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
