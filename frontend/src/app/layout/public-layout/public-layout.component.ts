import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Course, ServiceItem, Settings } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { CourseService, ServiceCatalogService, SettingsService } from '../../core/services/domain.services';
import { IconComponent } from '../../shared/components/icon.component';
import { initials } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="nav" [class.scrolled]="scrolled()">
      <div class="container nav-inner">
        <a routerLink="/" class="brand" aria-label="Home">
          <span class="mark">{{ settings()?.branding?.logoText || 'NTA' }}</span>
          <span class="name">{{ settings()?.instituteName || 'Navigate Tech Academy' }}</span>
        </a>
        <button type="button" class="btn btn-icon btn-ghost toggle" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-controls="main-nav" aria-label="Toggle navigation">
          <app-icon [name]="menuOpen() ? 'x' : 'menu'" />
        </button>
        <nav id="main-nav" class="links" [class.open]="menuOpen()" aria-label="Main">
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: l.path === '/' }">{{ l.label }}</a>
          }
          <div class="auth">
            @if (auth.user(); as u) {
              <a class="btn btn-sm btn-accent" [routerLink]="auth.dashboardUrl()">Dashboard</a>
              <div class="profile">
                <button type="button" class="avatar-btn" (click)="profileOpen.set(!profileOpen())" [attr.aria-expanded]="profileOpen()" aria-haspopup="menu" aria-label="Account menu">
                  <span class="avatar sm">{{ initials(u.fullName) }}</span>
                </button>
                @if (profileOpen()) {
                  <div class="menu" role="menu">
                    <div class="menu-head"><strong>{{ u.fullName }}</strong><span class="muted small">{{ u.email }}</span></div>
                    <a role="menuitem" [routerLink]="auth.dashboardUrl()">Dashboard</a>
                    <a role="menuitem" [routerLink]="auth.dashboardUrl() + '/profile'">My profile</a>
                    <button type="button" role="menuitem" (click)="auth.logout()">Log out</button>
                  </div>
                }
              </div>
            } @else {
              <a routerLink="/login" class="btn btn-sm btn-ghost">Login</a>
              <a routerLink="/register" class="btn btn-sm btn-primary">Register</a>
            }
          </div>
        </nav>
      </div>
    </header>

    <main id="main" tabindex="-1"><router-outlet /></main>

    <footer class="footer">
      <div class="container">
        <div class="cols">
          <div class="about">
            <a routerLink="/" class="brand light"><span class="mark">{{ settings()?.branding?.logoText || 'NTA' }}</span><span class="name">{{ settings()?.instituteName || 'Navigate Tech Academy' }}</span></a>
            <p>Industry-oriented IT and skills training with expert mentors, practical projects and career-focused learning.</p>
            <div class="socials">
              @for (s of socialLinks(); track s.key) {
                <a [href]="s.url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="s.label"><app-icon [name]="s.icon" [size]="18" /></a>
              }
            </div>
          </div>
          <div>
            <h4>Courses</h4>
            @for (c of footerCourses(); track c.id) { <a [routerLink]="['/courses', c.slug]">{{ c.title }}</a> }
            <a routerLink="/courses">All courses</a>
          </div>
          <div>
            <h4>Services</h4>
            @for (s of footerServices(); track s.id) { <a routerLink="/services">{{ s.title }}</a> }
            <a routerLink="/placements">Placement support</a>
          </div>
          <div>
            <h4>Contact</h4>
            <p class="line"><app-icon name="map-pin" [size]="16" /> <span>{{ settings()?.address }}</span></p>
            <p class="line"><app-icon name="phone" [size]="16" /> <span>{{ settings()?.phone }}</span></p>
            <p class="line"><app-icon name="mail" [size]="16" /> <a [href]="'mailto:' + (settings()?.email || '')">{{ settings()?.email }}</a></p>
            <p class="line"><app-icon name="clock" [size]="16" /> <span>{{ settings()?.workingHours }}</span></p>
          </div>
        </div>
        <div class="bottom">
          <span>&copy; {{ year }} {{ settings()?.instituteName || 'Navigate Tech Academy' }}. All rights reserved.</span>
          <span class="bottom-links"><a routerLink="/faq">FAQ</a><a routerLink="/terms">Terms &amp; privacy</a><a routerLink="/contact">Contact</a></span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.92); backdrop-filter: saturate(160%) blur(10px); border-bottom: 1px solid transparent; transition: border-color .2s, box-shadow .2s; }
    .nav.scrolled { border-color: var(--line); box-shadow: var(--shadow-sm); }
    .nav-inner { height: var(--nav-h); display: flex; align-items: center; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--navy-900); font-family: var(--font-display); font-weight: 800; }
    .mark { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--navy-900); color: var(--accent); font-size: 0.8rem; letter-spacing: 0.04em; }
    .name { font-size: 1.05rem; line-height: 1.1; max-width: 170px; }
    .links { margin-left: auto; display: flex; align-items: center; gap: 2px; }
    .links > a { padding: 8px 10px; border-radius: 8px; color: var(--ink-2); font-weight: 500; font-size: 0.93rem; }
    .links > a:hover { color: var(--navy-900); background: var(--navy-50); }
    .links > a.active { color: var(--navy-900); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); border-radius: 0; }
    .auth { display: flex; gap: 8px; align-items: center; margin-left: 10px; }
    .toggle { display: none; margin-left: auto; }
    .profile { position: relative; }
    .avatar-btn { background: none; border: none; padding: 0; cursor: pointer; border-radius: 50%; }
    .avatar.sm { width: 38px; height: 38px; font-size: 0.85rem; }
    .menu { position: absolute; right: 0; top: calc(100% + 10px); min-width: 230px; background: var(--white); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 8px; display: flex; flex-direction: column; animation: fade-up .15s ease; }
    .menu-head { display: flex; flex-direction: column; padding: 8px 12px 10px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
    .menu a, .menu button { text-align: left; padding: 9px 12px; border-radius: 8px; background: none; border: none; color: var(--ink); cursor: pointer; font-size: 0.93rem; }
    .menu a:hover, .menu button:hover { background: var(--navy-50); }
    @media (max-width: 1180px) {
      .toggle { display: inline-flex; }
      .links { display: none; position: absolute; top: var(--nav-h); left: 0; right: 0; flex-direction: column; align-items: stretch; background: var(--white); padding: 12px 20px 20px; border-bottom: 1px solid var(--line); box-shadow: var(--shadow); max-height: calc(100vh - var(--nav-h)); overflow: auto; }
      .links.open { display: flex; }
      .links > a { padding: 12px; }
      .links > a.active { box-shadow: inset 3px 0 0 var(--accent); }
      .auth { margin: 12px 0 0; }
      .menu { left: 0; right: auto; }
    }
    .footer { background: var(--navy-950); color: #9fb0c8; padding: 64px 0 24px; font-size: 0.93rem; }
    .cols { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.3fr; gap: 40px; }
    .footer h4 { color: var(--white); margin-bottom: 14px; }
    .footer a { color: #c4d1e3; display: block; padding: 3px 0; }
    .footer a:hover { color: var(--accent); }
    .brand.light { color: var(--white); margin-bottom: 14px; display: inline-flex; }
    .brand.light .mark { background: var(--accent); color: var(--navy-950); }
    .socials { display: flex; gap: 10px; margin-top: 8px; }
    .socials a { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: rgba(255,255,255,0.07); padding: 0; }
    .line { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
    .line app-icon { margin-top: 3px; color: var(--accent); }
    .line a { display: inline; padding: 0; }
    .bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 48px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); }
    .bottom-links { display: flex; gap: 18px; } .bottom-links a { display: inline; }
    @media (max-width: 900px) { .cols { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { .cols { grid-template-columns: 1fr; } }
  `],
})
export class PublicLayoutComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  private settingsService = inject(SettingsService);
  private courseService = inject(CourseService);
  private catalog = inject(ServiceCatalogService);

  readonly links = [
    { path: '/', label: 'Home' }, { path: '/about', label: 'About Us' }, { path: '/courses', label: 'Courses' },
    { path: '/services', label: 'Services' }, { path: '/trainers', label: 'Trainers' }, { path: '/batches', label: 'Batches' },
    { path: '/placements', label: 'Placements' }, { path: '/appointments', label: 'Appointments' }, { path: '/contact', label: 'Contact Us' },
  ];
  readonly year = new Date().getFullYear();
  menuOpen = signal(false);
  profileOpen = signal(false);
  scrolled = signal(false);
  settings = signal<Settings | null>(null);
  footerCourses = signal<Course[]>([]);
  footerServices = signal<ServiceItem[]>([]);
  socialLinks = signal<{ key: string; url: string; icon: string; label: string }[]>([]);
  initials = initials;

  ngOnInit(): void {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.profileOpen.set(false);
    });
    this.settingsService.get().subscribe({
      next: (s) => {
        this.settings.set(s);
        const icons: Record<string, string> = { facebook: 'facebook', instagram: 'instagram', linkedin: 'linkedin', youtube: 'youtube', x: 'twitter' };
        this.socialLinks.set(Object.entries(s.socials || {}).filter(([, url]) => !!url).map(([key, url]) => ({ key, url: url as string, icon: icons[key] || 'globe', label: key })));
      },
      error: () => undefined,
    });
    this.courseService.list({ featured: 'true' }).subscribe({ next: (r) => this.footerCourses.set(r.items.slice(0, 5)), error: () => undefined });
    this.catalog.list().subscribe({ next: (s) => this.footerServices.set(s.slice(0, 5)), error: () => undefined });
  }

  @HostListener('window:scroll')
  onScroll(): void { this.scrolled.set(window.scrollY > 8); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.profileOpen.set(false); this.menuOpen.set(false); }
}
