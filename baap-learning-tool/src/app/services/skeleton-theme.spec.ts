import { TestBed } from '@angular/core/testing';

import { SkeletonTheme } from './skeleton-theme';

describe('SkeletonTheme', () => {
  let service: SkeletonTheme;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SkeletonTheme);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
