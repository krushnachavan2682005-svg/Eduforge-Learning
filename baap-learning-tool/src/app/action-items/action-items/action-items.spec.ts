import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActionItems } from './action-items';

describe('ActionItems', () => {
  let component: ActionItems;
  let fixture: ComponentFixture<ActionItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionItems]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActionItems);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
