import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectClient } from './select-client';

describe('SelectClient', () => {
  let component: SelectClient;
  let fixture: ComponentFixture<SelectClient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectClient]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectClient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
