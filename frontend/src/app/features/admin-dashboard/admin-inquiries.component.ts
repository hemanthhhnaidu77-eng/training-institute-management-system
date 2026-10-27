import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { ApiErrorInfo, Inquiry, PageMeta } from '../../core/models/models';
import { InquiryService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, PaginationComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';

@Component({
  selector: 'app-admin-inquiries',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title"><div><h1>Inquiries</h1><p>Contact form messages with status tracking and internal notes.</p></div></div>
    <form class="toolbar" [formGroup]="filters">
      <input class="input" formControlName="q" placeholder="Search ticket, name, email, text" aria-label="Search inquiries" />
      <select class="select" formControlName="status" aria-label="Status"><option value="">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
      <select class="select" formControlName="category" aria-label="Category"><option value="">All categories</option>@for (c of categories; track c) { <option [value]="c">{{ c }}</option> }</select>
    </form>
    @if (loading()) { <app-loader /> } @else if (error()) { <app-alert type="error" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else {
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Ticket</th><th>From</th><th>Subject</th><th>Category</th><th>Received</th><th>Status</th><th><span class="sr-only">Open</span></th></tr></thead>
        <tbody>@for (i of items(); track i.id) {
          <tr><td class="cell-title">{{ i.ticketNo }}</td><td>{{ i.name }}<div class="muted small">{{ i.email }}</div></td><td>{{ i.subject }}</td><td>{{ i.category }}</td><td>{{ i.createdAt | date: 'short' }}</td>
            <td><app-status-badge [status]="i.status" /></td><td><button type="button" class="btn btn-sm btn-ghost" (click)="open(i)">Open</button></td></tr>
        }</tbody></table></div>
      @if (!items().length) { <app-empty-state icon="inbox" title="No inquiries" message="Messages from the contact form appear here." /> }
      <app-pagination [page]="meta().page || 1" [totalPages]="meta().totalPages || 1" [total]="meta().total" (pageChange)="page.set($event); load()" />
    }
    @if (selected(); as i) {
      <app-modal [title]="i.ticketNo + ' · ' + i.subject" [wide]="true" (close)="selected.set(null)">
        <dl class="kv mb-2"><dt>From</dt><dd>{{ i.name }} &lt;{{ i.email }}&gt;{{ i.mobile ? ' · ' + i.mobile : '' }}</dd><dt>Category</dt><dd>{{ i.category }}</dd><dt>Received</dt><dd>{{ i.createdAt | date: 'medium' }}</dd><dt>Status</dt><dd><app-status-badge [status]="i.status" /></dd></dl>
        <div class="msg">{{ i.message }}</div>
        <div class="flex flex-wrap mt-2">
          <a class="btn btn-sm btn-outline" [href]="'mailto:' + i.email + '?subject=' + encode('Re: ' + i.subject + ' [' + i.ticketNo + ']')">Reply by email</a>
          @for (s of ['in_progress', 'resolved', 'closed']; track s) { <button type="button" class="btn btn-sm" [class.btn-primary]="s === 'resolved'" [class.btn-ghost]="s !== 'resolved'" [disabled]="i.status === s" (click)="setStatus(i, s)">Mark {{ s.replace('_', ' ') }}</button> }
        </div>
        <h4 class="mt-3">Internal notes</h4>
        @for (n of i.notes || []; track n.at) { <div class="note"><p class="mb-0">{{ n.text }}</p><span class="muted small">{{ n.by }} &middot; {{ n.at | date: 'short' }}</span></div> }
        @empty { <p class="muted small">No notes yet.</p> }
        <div class="flex mt-2"><label class="sr-only" for="inote">Add note</label><input id="inote" class="input" [formControl]="note" (keydown.enter)="addNote(i)" placeholder="Add an internal note (not visible to the sender)" maxlength="1000" /><button type="button" class="btn btn-primary btn-sm" [disabled]="note.invalid" (click)="addNote(i)">Add</button></div>
      </app-modal>
    }
  `,
  styles: ['.msg { white-space: pre-line; background: var(--navy-50); border-radius: 12px; padding: 14px 16px; } .note { border-left: 3px solid var(--accent); padding: 6px 12px; margin-bottom: 8px; background: #fffaf2; border-radius: 0 8px 8px 0; }'],
})
export class AdminInquiriesComponent implements OnInit {
  private service = inject(InquiryService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly categories = ['Course Information', 'Fees and Payment', 'Admissions', 'Corporate Training', 'Placement Support', 'Technical Support', 'Feedback', 'Other'];
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  items = signal<Inquiry[]>([]);
  meta = signal<PageMeta>({ total: 0 });
  page = signal(1);
  selected = signal<Inquiry | null>(null);
  filters = this.fb.nonNullable.group({ q: '', status: '', category: '' });
  note = this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(1000)]);
  encode = encodeURIComponent;

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.adminList({ ...this.filters.getRawValue(), page: this.page(), limit: 15 }).subscribe({
      next: (r) => { this.items.set(r.items); this.meta.set(r.meta); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }
  open(i: Inquiry): void {
    this.note.reset();
    this.service.adminGet(i.id).subscribe({ next: (full) => this.selected.set(full), error: (e: ApiErrorInfo) => this.toast.error(e.message) });
  }
  private replace(updated: Inquiry): void {
    this.selected.set(updated);
    this.items.update((l) => l.map((x) => (x.id === updated.id ? updated : x)));
  }
  setStatus(i: Inquiry, status: string): void {
    this.service.setStatus(i.id, status).subscribe({ next: (u) => { this.replace(u); this.toast.success(`Marked ${status.replace('_', ' ')}`); }, error: (e: ApiErrorInfo) => this.toast.error(e.message) });
  }
  addNote(i: Inquiry): void {
    if (this.note.invalid) return;
    this.service.addNote(i.id, this.note.value).subscribe({ next: (u) => { this.replace(u); this.note.reset(); }, error: (e: ApiErrorInfo) => this.toast.error(e.message) });
  }
}
