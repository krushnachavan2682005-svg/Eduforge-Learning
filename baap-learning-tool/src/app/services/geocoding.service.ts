import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface GeocodingResult {
  city: string;
  region: string;
  country: string;
  formatted_address: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeocodingService {
  private http = inject(HttpClient);
  private readonly GEOCODING_URL = 'https://nominatim.openstreetmap.org/search';

  geocodeAddress(address: string): Observable<GeocodingResult | null> {
    if (!address || address.trim().length < 3) {
      return of(null);
    }

    const searchQueries = [
      address,
      address + ' Maharashtra',
      address + ' India',
      address.replace(/gaon$/, 'gav'),
      address.replace(/gav$/, 'gaon'),
      address + ' village',
      address + ' taluka',
      address + ' tehsil',
    ];

    const searchQuery = searchQueries[0];

    const params = {
      q: searchQuery,
      format: 'json',
      limit: '15',
      addressdetails: '1',
      'accept-language': 'en',
    };

    return this.http?.get<any[]>(this.GEOCODING_URL, { params }).pipe(
      map((response) => {
        if (response && response?.length > 0) {
          let bestResult = response[0];
          for (const result of response) {
            const addr = result?.address || {};
            const displayName = result?.display_name || '';
            if (
              addr?.state &&
              addr?.state?.toLowerCase()?.includes('maharashtra')
            ) {
              bestResult = result;
              break;
            }
            const originalName = searchQuery?.toLowerCase();
            const resultName = displayName?.toLowerCase();
            if (
              resultName?.includes(originalName) ||
              resultName?.includes(originalName?.replace('gaon', 'gav')) ||
              resultName?.includes(originalName?.replace('gav', 'gaon'))
            ) {
              bestResult = result;
            }
          }

          if (
            !bestResult?.address?.state?.toLowerCase()?.includes('maharashtra')
          ) {
            for (const result of response) {
              const addr = result?.address || {};
              if (
                addr?.country &&
                addr?.country?.toLowerCase()?.includes('india')
              ) {
                bestResult = result;
                break;
              }
            }
          }

          const address = bestResult?.address || {};
          const taluka =
            address?.county ||
            address?.state_district ||
            address?.suburb ||
            address?.city_district ||
            address?.municipality ||
            address?.town ||
            '';

          const state =
            address?.state || address?.region || address?.province || '';

          const properCase = (str: string) => {
            if (!str) return '';
            return str
              ?.toLowerCase()
              ?.replace(/\b\w/g, (l) => l?.toUpperCase());
          };

          return {
            city: properCase(taluka),
            region: properCase(state),
            country: properCase(address?.country || ''),
            formatted_address: bestResult?.display_name || '',
          };
        }
        return null;
      }),
      catchError(() => of(null)),
    );
  }

  geocodeWithGoogle(address: string): Observable<GeocodingResult | null> {
    return of(null);
  }
}
