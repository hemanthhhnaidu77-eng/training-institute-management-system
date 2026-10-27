import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../shared/components/content.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-placements',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="Placements & career support" title="Get job-ready with structured career support" subtitle="We help you prepare, present and pursue opportunities. We do not guarantee employment.">
      <div class="flex flex-wrap mt-3"><a routerLink="/appointments" class="btn btn-accent">Book career counselling</a><a routerLink="/courses" class="btn btn-light">Explore courses</a></div>
    </app-page-hero>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Placement assistance process</span><h2>How we support you</h2></div>
        <ol class="process">
          @for (p of process; track p.title; let i = $index) {
            <li class="card"><span class="step">Step {{ i + 1 }}</span><div class="icon-tile accent"><app-icon [name]="p.icon" /></div><h3 class="mt-2">{{ p.title }}</h3><p class="muted small mb-0">{{ p.text }}</p></li>
          }
        </ol>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container grid grid-3">
        @for (s of supports; track s.title) {
          <div class="card card-hover"><div class="icon-tile"><app-icon [name]="s.icon" /></div><h3 class="mt-2">{{ s.title }}</h3><p class="muted">{{ s.text }}</p>
            <a class="btn btn-sm btn-outline" [routerLink]="s.link" [queryParams]="s.query">{{ s.cta }}</a></div>
        }
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Success stories</span><h2>Learner journeys</h2><p><span class="sample-note">Sample content for demonstration; not real outcomes</span></p></div>
        <div class="grid grid-3">
          @for (s of stories; track s.name) {
            <figure class="card story"><blockquote>"{{ s.quote }}"</blockquote><figcaption><strong>{{ s.name }}</strong><span class="muted small">{{ s.path }}</span></figcaption></figure>
          }
        </div>
      </div>
    </section>

    <section class="section-sm section-alt">
      <div class="container text-center">
        <p class="eyebrow">Hiring partners</p>
        <div class="logos">@for (l of logos; track l) { <span class="logo-ph">{{ l }}</span> }</div>
        <p class="muted small mt-2">Company logos are placeholders. Replace them only with logos you are authorised to display.</p>
      </div>
    </section>
  `,
  styles: [`
    .process { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
    .step { font-size: 0.72rem; font-weight: 700; color: var(--accent-600); text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 10px; }
    @media (max-width: 1024px) { .process { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .process { grid-template-columns: 1fr; } }
    .story { margin: 0; display: flex; flex-direction: column; gap: 14px; }
    .story blockquote { margin: 0; color: var(--ink-2); }
    .story figcaption { display: flex; flex-direction: column; }
    .logos { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; max-width: 900px; margin: 0 auto; }
    .logo-ph { border: 1.5px dashed var(--line); border-radius: 12px; padding: 18px 8px; color: var(--ink-3); font-weight: 700; font-size: 0.85rem; background: var(--white); }
    @media (max-width: 720px) { .logos { grid-template-columns: repeat(3, 1fr); } }
  `],
})
export class PlacementsComponent {
  readonly process = [
    { icon: 'compass', title: 'Career guidance', text: 'Understand target roles and the skills each one needs.' },
    { icon: 'file', title: 'Resume preparation', text: 'ATS-friendly resume plus LinkedIn and GitHub polish.' },
    { icon: 'message', title: 'Interview coaching', text: 'Technical concepts, problem solving and communication.' },
    { icon: 'mic', title: 'Mock interviews', text: 'Realistic practice rounds with written feedback.' },
    { icon: 'briefcase', title: 'Opportunities', text: 'Openings and interview scheduling shared when available.' },
  ];
  readonly supports = [
    { icon: 'file', title: 'Resume building', text: 'One-to-one review sessions to present your projects and skills clearly.', cta: 'Book a review', link: '/appointments', query: {} },
    { icon: 'mic', title: 'Mock interviews', text: 'Practise with trainers and get specific, actionable feedback.', cta: 'Schedule a mock', link: '/appointments', query: {} },
    { icon: 'briefcase', title: 'Internship opportunities', text: 'Supervised internship programs on real-world style projects.', cta: 'Ask about internships', link: '/contact', query: { subject: 'Internship programs' } },
  ];
  readonly stories = [
    { name: 'Sample Learner 1', path: 'Non-IT graduate to junior web developer', quote: 'The portfolio projects gave me something concrete to talk about in interviews.' },
    { name: 'Sample Learner 2', path: 'Support engineer to cloud associate', quote: 'Weekly labs made the cloud certification topics finally click.' },
    { name: 'Sample Learner 3', path: 'Manual tester to automation engineer', quote: 'Mock interviews showed me exactly what to improve before the real thing.' },
  ];
  readonly logos = ['Company A', 'Company B', 'Company C', 'Company D', 'Company E', 'Company F'];
}
