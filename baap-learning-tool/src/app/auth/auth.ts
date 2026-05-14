import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/env';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private loginUrl = `${environment.ERP_BASE_URL}/auth/api/auth/login`;
  private checkPasswordUrl = `${environment.ERP_BASE_URL}/auth/api/auth/check-password`;
  private requestOtpUrl = `${environment.ERP_BASE_URL}/auth/api/auth/request-otp`;
  private verifyOtpUrl = `${environment.ERP_BASE_URL}/auth/api/auth/verify-otp`;

  constructor(private http: HttpClient) {}

  login(payload: any): Observable<any> {
    return this.http.post(this.loginUrl, payload);
  }

  checkPassword(payload: any): Observable<any> {
    return this.http.post(this.checkPasswordUrl, payload);
  }

  requestOtp(payload: any): Observable<any> {
    return this.http.post(this.requestOtpUrl, payload);
  }

  verifyOtp(payload: any): Observable<any> {
    return this.http.post(this.verifyOtpUrl, payload);
  }
}
