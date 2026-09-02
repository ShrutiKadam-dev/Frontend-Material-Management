import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { AuthSession, LoginCredentials, User } from '../models/user.model';

const AUTH_SESSION_KEY = 'material-management.auth-session';

interface LoginApiResponse {
  data: {
    access_token: string;
    refresh_token: string;
    email: string;
    first_name: string;
    last_name: string;
    id: number;
    is_active: boolean;
  };
  message: string;
  success: boolean;
}

interface RefreshApiResponse {
  data: {
    access_token: string;
    expires_in: number;
  };
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly sessionState = signal<AuthSession | null>(this.readStoredSession());

  readonly session = this.sessionState.asReadonly();

  accessToken(): string | null {
    return this.sessionState()?.accessToken ?? null;
  }

  refreshTokenValue(): string | null {
    return this.sessionState()?.refreshToken ?? null;
  }

  currentUser(): User | null {
    return this.sessionState()?.user ?? null;
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken());
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.http.post<LoginApiResponse>(`${this.apiBaseUrl}/api/v1/auth/login`, credentials).pipe(
      map((response) => {
        const data = response.data;
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Admin';
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: {
            id: String(data.id),
            name: name,
            email: data.email,
            role: 'admin' as const,
          },
        };
      }),
      tap((session) => this.setSession(session)),
    );
  }

  /**
   * Calls POST /api/v1/auth/refresh using the stored refresh token as Bearer.
   * Updates only the access token in the session — user info stays the same.
   */
  refreshToken(): Observable<string> {
    const currentRefreshToken = this.refreshTokenValue();
    return this.http
      .post<RefreshApiResponse>(
        `${this.apiBaseUrl}/api/v1/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentRefreshToken}`,
          },
        },
      )
      .pipe(
        map((response) => response.data.access_token),
        tap((newAccessToken) => {
          const current = this.sessionState();
          if (current) {
            this.setSession({ ...current, accessToken: newAccessToken });
          }
        }),
      );
  }

  logout(): void {
    this.sessionState.set(null);

    if (this.isBrowser) {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }

  private setSession(session: AuthSession): void {
    this.sessionState.set(session);

    if (this.isBrowser) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }
  }

  private readStoredSession(): AuthSession | null {
    if (!this.isBrowser) {
      return null;
    }

    const rawSession = localStorage.getItem(AUTH_SESSION_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession) as AuthSession;
    } catch {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
  }
}

export { AuthService as Auth };
