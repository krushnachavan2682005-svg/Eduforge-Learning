import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/header.component';
import { CommonHttpService } from '../../services/common-http.service';
import { StorageService } from '../../services/storage-service';
import { STORAGEENUMS } from '../../shared/enum';
import { Tooltip } from '../../shared/tooltip';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { WorkspaceNavigationService } from '../../core/navigation/workspace-navigation.service';

@Component({
  selector: 'app-resume',
  imports: [CommonModule, FormsModule, HeaderComponent, Tooltip],
  templateUrl: './resume.html',
  styleUrl: './resume.scss',
})
export class Resume implements OnInit, OnDestroy {
  @ViewChild('resumeContent', { static: false }) resumeContent!: ElementRef;
  userId: any;
  clientId = '';
  skills = signal<any[]>([]);
  profile = signal<any>(null);
  contact = signal<any>(null);
  projects = signal<any[]>([]);
  education = signal<any[]>([]);
  experience = signal<any[]>([]);
  private router = inject(Router);
  hasResume = signal<boolean>(false);
  private str = inject(StorageService);
  private downloadEventListener?: () => void;
  private commoHttp = inject(CommonHttpService);
  private toastr = inject(ToastrService);
  private workspaceNav = inject(WorkspaceNavigationService);

  ngOnInit() {
    this.userId = this.str?.getItem(STORAGEENUMS?.USER_ID);
    this.clientId = this.str?.getItem(STORAGEENUMS?.CLIENT_ID) || '';
    this.getResume();
    this.setupDownloadListener();
  }

  ngOnDestroy() {
    if (this.downloadEventListener) {
      window?.removeEventListener('downloadResume', this.downloadEventListener);
    }
  }

  setupDownloadListener() {
    this.downloadEventListener = () => {
      this.downloadResumeAsPDF();
    };
    window?.addEventListener('downloadResume', this.downloadEventListener);
  }

  createShareableLink() {
    if (!this.userId) {
      alert('User ID not found');
      return;
    }

    const token = this.generateUniqueToken();
    const shareableUrl = this.buildShareableUrl(token);

    this.copyLinkToClipboard(shareableUrl);
  }

  private generateUniqueToken(): string {
    return `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
  }

  private buildShareableUrl(token: string): string {
    const baseUrl = `${window.location.origin}/resume/shared/${this.userId}/${token}`;
    return this.clientId ? `${baseUrl}?clientId=${this.clientId}` : baseUrl;
  }

  private async copyLinkToClipboard(shareableUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      this.toastr.success('Link copied to clipboard');
    } catch {
      this.toastr.error('Failed to copy link');
    }
  }

  getResume() {
    this.commoHttp
      .getCourse(`/client/${this.clientId}/resume/user/${this.userId}`)
      .subscribe(
        (res: any) => {
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
            this.hasResume?.set(true);
          } else {
            // this.getUser();
            this.router?.navigate([this.workspaceNav.getResumeCreateRoute()]);
          }
        },
        (error) => {
          console.error('Resume API failed, fallback to User API:', error);
          // this.getUser();
          this.router?.navigate([this.workspaceNav.getResumeCreateRoute()]);
        },
      );
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
