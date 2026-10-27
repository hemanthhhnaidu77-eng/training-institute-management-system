import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/models';
import { AuthService } from '../services/auth.service';

/** Requires a logged-in user. NOTE: UX only; the API enforces authorisation on every request. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Restricts a route to roles listed in route data: { roles: ['admin'] }. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] as Role[]) || [];
  const role = auth.role();
  if (role && roles.includes(role)) return true;
  return inject(Router).createUrlTree([role ? auth.dashboardUrl(role) : '/login']);
};

/** Keeps logged-in users away from login/register pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree([auth.dashboardUrl()]) : true;
};
