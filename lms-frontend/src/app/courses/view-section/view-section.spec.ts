import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewSection } from './view-section';

describe('ViewSection', () => {
  let component: ViewSection;
  let fixture: ComponentFixture<ViewSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
