import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubmittedActionItems } from './submitted-action-items';
import { CommonHttpService } from '../../services/common-http.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';
import { StorageService } from '../../services/storage-service';
import { SkeletonTheme } from '../../services/skeleton-theme';
import { of } from 'rxjs';

describe('SubmittedActionItems', () => {
    let component: SubmittedActionItems;
    let fixture: ComponentFixture<SubmittedActionItems>;

    const mockCommonHttpService = {
        getCourse: jasmine.createSpy('getCourse').and.returnValue(of({ success: true, data: [] })),
    };

    const mockToastrService = {
        error: jasmine.createSpy('error'),
        success: jasmine.createSpy('success'),
    };

    const mockStorageService = {
        getItem: jasmine.createSpy('getItem').and.returnValue('mock-id'),
    };

    const mockActivatedRoute = {
        params: of({}),
    };

    const mockSkeletonTheme = {
        expanded: {},
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SubmittedActionItems],
            providers: [
                { provide: CommonHttpService, useValue: mockCommonHttpService },
                { provide: ToastrService, useValue: mockToastrService },
                { provide: StorageService, useValue: mockStorageService },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
                { provide: SkeletonTheme, useValue: mockSkeletonTheme },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SubmittedActionItems);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
