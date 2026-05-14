import {
  Component,
  inject,
  signal,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonHttpService } from '../../services/common-http.service';
import { ActivatedRoute } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-shared-resume',
  imports: [CommonModule, FormsModule],
  templateUrl: './shared-resume.html',
  styleUrl: './shared-resume.scss',
})
export class SharedResume implements OnInit {
  @ViewChild('resumeContent', { static: false }) resumeContent!: ElementRef;
  userId: any;
  token: any;
  clientId = '';
  skills = signal<any[]>([]);
  profile = signal<any>(null);
  contact = signal<any>(null);
  projects = signal<any[]>([]);
  education = signal<any[]>([]);
  experience = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  private route = inject(ActivatedRoute);
  private commoHttp = inject(CommonHttpService);

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.userId = params['userId'];
      this.token = params['token'];
      // Try to get clientId from query params
      this.clientId = this.route.snapshot.queryParams['clientId'] || '';
      this.getResume();
    });
  }

  getResume() {
    if (!this.userId) {
      this.isLoading.set(false);
      return;
    }

    // If no clientId, try to get it from the API without client prefix
    const endpoint = this.clientId
      ? `/client/${this.clientId}/resume/user/${this.userId}`
      : `/resume/user/${this.userId}`;

    // Use public method that doesn't require authentication
    this.commoHttp
      .getPublicCourse(endpoint)
      .subscribe({
        next: (res: any) => {
          const data = res?.data;

          if (data) {
            this.profile?.set({
              name: data?.name,
              title: data?.label,
              creditScore: '',
              description: data?.summary,
            });

            this.contact?.set({
              email: data?.email,
              phone: data?.phone,
              url: data?.url,
              address: `${data?.location?.address || ''},  ${data?.location?.city || ''},  ${data?.location?.region || ''},  ${data?.location?.country || ''}`,
            });

            this.education?.set(
              (data?.education || [])?.map((edu: any) => ({
                degree: edu?.study_type,
                marks: edu?.score,
                institution: edu?.institution,
                startDate: edu?.start_date,
                endDate: edu?.end_date,
              })),
            );

            this.skills?.set(data?.skills || []);

            this.experience?.set(
              (data?.work || [])?.map((exp: any) => ({
                startDate: exp?.start_date,
                endDate: exp?.end_date,
                position: exp?.name,
                company: exp?.position,
                description: exp?.summary,
              })),
            );

            this.projects?.set(
              (data?.projects || [])?.map((proj: any) => ({
                startDate: proj?.start_date,
                endDate: proj?.end_date,
                name: proj?.name,
                client: proj?.entity,
                description: proj?.summary,
              })),
            );
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load resume:', error);
          // Try fallback with regular method if public fails
          if (error?.status === 401 || error?.status === 403) {
            // If public endpoint doesn't work, try with auth token if available
            this.commoHttp.getCourse(endpoint).subscribe({
              next: (res: any) => {
                const data = res?.data;
                if (data) {
                  this.profile?.set({
                    name: data?.name,
                    title: data?.label,
                    creditScore: '',
                    description: data?.summary,
                  });
                  this.contact?.set({
                    email: data?.email,
                    phone: data?.phone,
                    url: data?.url,
                    address: `${data?.location?.address || ''},  ${data?.location?.city || ''},  ${data?.location?.region || ''},  ${data?.location?.country || ''}`,
                  });
                  this.education?.set(
                    (data?.education || [])?.map((edu: any) => ({
                      degree: edu?.study_type,
                      marks: edu?.score,
                      institution: edu?.institution,
                      startDate: edu?.start_date,
                      endDate: edu?.end_date,
                    })),
                  );
                  this.skills?.set(data?.skills || []);
                  this.experience?.set(
                    (data?.work || [])?.map((exp: any) => ({
                      startDate: exp?.start_date,
                      endDate: exp?.end_date,
                      position: exp?.name,
                      company: exp?.position,
                      description: exp?.summary,
                    })),
                  );
                  this.projects?.set(
                    (data?.projects || [])?.map((proj: any) => ({
                      startDate: proj?.start_date,
                      endDate: proj?.end_date,
                      name: proj?.name,
                      client: proj?.entity,
                      description: proj?.summary,
                    })),
                  );
                }
                this.isLoading.set(false);
              },
              error: () => {
                this.isLoading.set(false);
              },
            });
          } else {
            this.isLoading.set(false);
          }
        },
      });
  }

  async downloadResumeAsPDF() {
    if (!this.resumeContent) return;
    const element = this.resumeContent.nativeElement;

    const originalOverflow = element.style.overflow;
    const originalHeight = element.style.height;
    const originalWidth = element.style.width;

    const noPrintElements = element.querySelectorAll('.no-print');
    noPrintElements?.forEach((el: any) => (el.style.display = 'none'));

    element.style.overflow = 'visible';
    element.style.height = 'auto';
    element.style.width = '210mm';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      windowWidth: 794
    });

    noPrintElements?.forEach((el: any) => (el.style.display = ''));
    element.style.overflow = originalOverflow;
    element.style.height = originalHeight;
    element.style.width = originalWidth;

    const imgWidth = 210;
    const pxToMm = 210 / canvas.width;
    const imgHeight = canvas.height * pxToMm;

    const pdf = new jsPDF('p', 'mm', [210, imgHeight]);

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    pdf.save(
      `${this.profile()?.name || 'Resume'}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }
}

