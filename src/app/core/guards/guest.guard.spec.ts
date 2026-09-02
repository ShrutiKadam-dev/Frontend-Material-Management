import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let authServiceSpy: { isAuthenticated: ReturnType<typeof vi.fn> };
  let router: Router;

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/auth/login' } as RouterStateSnapshot;

  beforeEach(() => {
    authServiceSpy = {
      isAuthenticated: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow access when user is not authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => guestGuard(dummyRoute, dummyState));

    expect(result).toBe(true);
  });

  it('should redirect to /dashboard when user is already authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      guestGuard(dummyRoute, dummyState),
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });
});
