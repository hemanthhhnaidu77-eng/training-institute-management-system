import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../shared/components/content.components';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero eyebrow="About us" title="We train people for the work that's actually out there" subtitle="A professional IT and skills training institute built on practical learning, honest guidance and mentor support." />
    <section class="section">
      <div class="container grid grid-2 overview">
        <div>
          <span class="eyebrow">Institute overview</span>
          <h2>Skills first. Projects always.</h2>
          <p class="muted">Navigate Tech Academy (a customisable placeholder name) delivers job-oriented programs in software development, data, cloud, security, testing and digital marketing. Learners attend live sessions, practise in guided labs and build portfolio projects reviewed by mentors.</p>
          <p class="muted">Programs run online, at our campus and in hybrid formats, with weekday, weekend and fast-track batches so learners can fit training around study or work.</p>
        </div>
        <div class="grid grid-2">
          <div class="card mv"><div class="icon-tile accent"><app-icon name="target" /></div><h3 class="mt-2">Mission</h3><p class="muted mb-0">Make industry-relevant skills accessible through practical, mentor-led training and honest career guidance.</p></div>
          <div class="card mv"><div class="icon-tile"><app-icon name="compass" /></div><h3 class="mt-2">Vision</h3><p class="muted mb-0">Be the institute learners trust to move from curiosity to capability, and from capability to career.</p></div>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Core values</span><h2>What we stand for</h2></div>
        <div class="grid grid-4">
          @for (v of values; track v.title) { <div class="card"><div class="icon-tile accent"><app-icon [name]="v.icon" /></div><h4 class="mt-2">{{ v.title }}</h4><p class="muted small mb-0">{{ v.text }}</p></div> }
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Training methodology</span><h2>Learn, practise, build, present</h2></div>
        <ol class="method">
          @for (m of method; track m.title; let i = $index) { <li class="card"><span class="num">{{ i + 1 }}</span><h4>{{ m.title }}</h4><p class="muted small mb-0">{{ m.text }}</p></li> }
        </ol>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container grid grid-3">
        <div class="card"><h3><app-icon name="building" /> Learning facilities</h3><ul class="list-check small"><li>Air-conditioned classrooms and computer labs</li><li>High-speed internet and cloud lab accounts</li><li>Live online classroom with recordings</li><li>Discussion rooms for project teams</li></ul></div>
        <div class="card"><h3><app-icon name="layers" /> Industry partnerships</h3><p class="muted small">We collaborate with companies for guest sessions, project ideas and hiring events where available.</p><div class="logos">@for (l of partnerLogos; track l) { <span class="logo-ph">{{ l }}</span> }</div><span class="sample-note">Placeholder partner logos</span></div>
        <div class="card"><h3><app-icon name="users" /> Trainer expertise</h3><p class="muted small">Our trainers are working practitioners and certified professionals across web, Java, data, AI, cloud, security, QA and marketing.</p><a routerLink="/trainers" class="btn btn-sm btn-outline">Meet the trainers</a></div>
      </div>
    </section>

    <section class="section">
      <div class="container grid grid-2">
        <div>
          <span class="eyebrow">Career development support</span>
          <h2>Guidance beyond the classroom</h2>
          <ul class="list-check"><li>Career counselling and course selection</li><li>Resume, LinkedIn and GitHub reviews</li><li>Mock interviews with detailed feedback</li><li>Interview scheduling support where opportunities are available</li></ul>
          <p class="small muted mt-2">Placement assistance is support, not a guarantee of employment.</p>
        </div>
        <div>
          <span class="eyebrow">Achievements &amp; milestones</span>
          <h2>Our journey</h2>
          <div class="timeline">
            @for (m of milestones; track m.label) { <div class="tl"><strong>{{ m.label }}</strong><span class="muted">{{ m.text }}</span></div> }
          </div>
          <span class="sample-note">Sample milestones; replace with your institute's history</span>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .overview { align-items: center; gap: 48px; }
    .card h3 { display: flex; gap: 10px; align-items: center; }
    .method { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .method li { position: relative; padding-top: 32px; }
    .num { position: absolute; top: -18px; left: 24px; width: 40px; height: 40px; border-radius: 12px; background: var(--navy-900); color: var(--accent); display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; }
    @media (max-width: 900px) { .method { grid-template-columns: 1fr 1fr; row-gap: 36px; } }
    @media (max-width: 560px) { .method { grid-template-columns: 1fr; } }
    .logos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .logo-ph { border: 1.5px dashed var(--line); border-radius: 10px; padding: 10px 4px; text-align: center; font-size: 0.75rem; color: var(--ink-3); font-weight: 600; }
    .timeline { border-left: 3px solid var(--accent); padding-left: 20px; display: grid; gap: 16px; margin-bottom: 12px; }
    .tl { display: flex; flex-direction: column; position: relative; }
    .tl::before { content: ''; position: absolute; left: -28px; top: 6px; width: 13px; height: 13px; border-radius: 50%; background: var(--white); border: 3px solid var(--navy-900); }
  `],
})
export class AboutComponent {
  readonly values = [
    { icon: 'check', title: 'Practical first', text: 'Every concept is followed by hands-on practice.' },
    { icon: 'shield', title: 'Honesty', text: 'Clear guidance on outcomes, fees and expectations.' },
    { icon: 'users', title: 'Learner care', text: 'Small groups, doubt sessions and mentor access.' },
    { icon: 'trending', title: 'Keep improving', text: 'Curriculum reviewed regularly against industry needs.' },
  ];
  readonly method = [
    { title: 'Learn', text: 'Live, interactive sessions that explain the why and the how.' },
    { title: 'Practise', text: 'Guided labs and assignments after each module.' },
    { title: 'Build', text: 'Team and individual projects using real tools and workflows.' },
    { title: 'Present', text: 'Demos, code reviews and mock interviews to prove your skills.' },
  ];
  readonly partnerLogos = ['Partner A', 'Partner B', 'Partner C', 'Partner D', 'Partner E', 'Partner F'];
  readonly milestones = [
    { label: 'Founded', text: 'Started with classroom programs in web development.' },
    { label: 'Expanded', text: 'Added data, cloud and security tracks.' },
    { label: 'Went hybrid', text: 'Launched live online and hybrid batches.' },
    { label: 'Today', text: 'Twelve career programs and full career support services.' },
  ];
}
