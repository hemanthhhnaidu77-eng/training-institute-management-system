import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiErrorInfo } from '../../core/models/models';
import { AdminService } from '../../core/services/domain.services';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { AlertComponent, EmptyStateComponent, LoaderComponent, ModalComponent, StatusBadgeComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { applyServerErrors } from '../../shared/utils/form-utils';
import { CrudColumn, CrudConfig, CrudField, CrudOption } from './crud-configs';

type Row = Record<string, unknown> & { id: string };

/** Generic, config-driven CRUD screen used for courses, trainers, batches, services, testimonials, FAQs and events. */
@Component({
  selector: 'app-admin-crud',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, InrPipe, LoaderComponent, AlertComponent, EmptyStateComponent, StatusBadgeComponent, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-title">
      <div><h1>{{ config.title }}</h1><p>{{ config.subtitle }}</p></div>
      <button type="button" class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" [size]="18" /> Add {{ config.singular.toLowerCase() }}</button>
    </div>
    <div class="toolbar">
      <label class="sr-only" for="crud-q">Search</label>
      <input id="crud-q" class="input" [formControl]="search" [placeholder]="'Search ' + config.title.toLowerCase()" />
      <button type="button" class="btn btn-ghost btn-sm" (click)="load()"><app-icon name="refresh" [size]="16" /> Refresh</button>
      <span class="muted small">{{ filtered().length }} of {{ rows().length }}</span>
    </div>
    @if (loading()) { <app-loader /> }
    @else if (error()) { <app-alert type="error" title="Could not load records" (retry)="load()">{{ error()?.message }}</app-alert> }
    @else if (!rows().length) {
      <app-empty-state icon="inbox" [title]="'No ' + config.title.toLowerCase() + ' yet'" message="Create the first record to get started."><button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">Add {{ config.singular.toLowerCase() }}</button></app-empty-state>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr>@for (c of config.columns; track c.key) { <th>{{ c.label }}</th> }<th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @for (row of filtered(); track row.id) {
              <tr>
                @for (c of config.columns; track c.key; let first = $first) {
                  <td>
                    @switch (c.type) {
                      @case ('currency') { {{ num(row[c.key]) | inr }} }
                      @case ('status') { <app-status-badge [status]="str(row[c.key])" /> }
                      @case ('bool') { <span class="badge" [class.badge-success]="!!row[c.key]" [class.badge-muted]="!row[c.key]">{{ row[c.key] ? 'Yes' : 'No' }}</span> }
                      @case ('list') { {{ list(row[c.key]) }} }
                      @case ('seats') { {{ row['seatsTaken'] }}/{{ row['capacity'] }} }
                      @default {
                        @if (first) { <span class="cell-title">{{ str(row[c.key]) }}</span> } @else { {{ str(row[c.key]) || '-' }} }
                      }
                    }
                    @if (c.secondary) { <div class="muted small">{{ str(row[c.secondary]) }}</div> }
                  </td>
                }
                <td><div class="actions">
                  <button type="button" class="btn btn-sm btn-ghost" (click)="openEdit(row)" [attr.aria-label]="'Edit ' + label(row)"><app-icon name="edit" [size]="15" /> Edit</button>
                  <button type="button" class="btn btn-sm btn-ghost danger" (click)="remove(row)" [attr.aria-label]="config.deleteLabel + ' ' + label(row)"><app-icon name="trash" [size]="15" /> {{ config.deleteLabel }}</button>
                </div></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (editing() !== null) {
      <app-modal [title]="(editing() ? 'Edit ' : 'Add ') + config.singular.toLowerCase()" [wide]="true" (close)="editing.set(null)">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate class="form-grid">
          @for (f of config.fields; track f.key) {
            <div class="field" [class.full]="f.full || f.type === 'multiselect'">
              @switch (f.type) {
                @case ('checkbox') { <label class="check"><input type="checkbox" [formControlName]="f.key" /> <span>{{ f.label }}</span></label> }
                @case ('multiselect') {
                  <span class="label">{{ f.label }}@if (f.required) { <span class="req">*</span> }</span>
                  <div class="multi">
                    @for (o of optionsFor(f); track o.value) {
                      <label class="chip-check" [class.on]="isChecked(f.key, o.value)"><input type="checkbox" [checked]="isChecked(f.key, o.value)" (change)="toggle(f.key, o.value)" /> {{ o.label }}</label>
                    } @empty { <span class="muted small">No options available</span> }
                  </div>
                }
                @default {
                  <label [for]="'f-' + f.key">{{ f.label }}@if (f.required) { <span class="req">*</span> }</label>
                  @switch (f.type) {
                    @case ('textarea') { <textarea class="textarea" [id]="'f-' + f.key" [formControlName]="f.key"></textarea> }
                    @case ('lines') { <textarea class="textarea" [id]="'f-' + f.key" [formControlName]="f.key" placeholder="One item per line"></textarea> }
                    @case ('select') {
                      <select class="select" [id]="'f-' + f.key" [formControlName]="f.key">
                        @if (!f.required || f.optionsSource) { <option value="">{{ f.required ? 'Select...' : 'None' }}</option> }
                        @for (o of optionsFor(f); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                      </select>
                    }
                    @case ('number') { <input class="input" type="number" [id]="'f-' + f.key" [formControlName]="f.key" [attr.min]="f.min ?? null" [attr.max]="f.max ?? null" /> }
                    @case ('date') { <input class="input" type="date" [id]="'f-' + f.key" [formControlName]="f.key" /> }
                    @case ('time') { <input class="input" type="time" [id]="'f-' + f.key" [formControlName]="f.key" /> }
                    @case ('email') { <input class="input" type="email" [id]="'f-' + f.key" [formControlName]="f.key" /> }
                    @case ('url') { <input class="input" type="url" [id]="'f-' + f.key" [formControlName]="f.key" placeholder="https://..." /> }
                    @default { <input class="input" type="text" [id]="'f-' + f.key" [formControlName]="f.key" [placeholder]="f.placeholder || ''" /> }
                  }
                }
              }
              @if (f.hint) { <span class="hint">{{ f.hint }}</span> }
              <app-field-error [control]="form.get(f.key)" [label]="f.label" />
            </div>
          }
          @if (saveError()) { <div class="full"><app-alert type="error">{{ saveError() }}</app-alert></div> }
          <div class="full form-actions">
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save ' + config.singular.toLowerCase() }}</button>
          </div>
        </form>
      </app-modal>
    }
  `,
  styles: [`
    .danger { color: var(--danger); }
    .multi { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip-check { display: inline-flex; gap: 6px; align-items: center; border: 1.5px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; font-size: 0.88rem; }
    .chip-check.on { border-color: var(--navy-900); background: var(--navy-50); }
    .chip-check input { accent-color: var(--navy-900); }
  `],
})
export class AdminCrudComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private admin = inject(AdminService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  config: CrudConfig = this.route.snapshot.data['crud'];
  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  rows = signal<Row[]>([]);
  editing = signal<Row | false | null>(null); // null = closed, false = creating
  saving = signal(false);
  saveError = signal('');
  courseOptions = signal<CrudOption[]>([]);
  trainerOptions = signal<CrudOption[]>([]);
  search = new FormControl('', { nonNullable: true });
  private term = signal('');
  form = new FormGroup<Record<string, AbstractControl>>({});

  filtered = computed(() => {
    const t = this.term().toLowerCase().trim();
    if (!t) return this.rows();
    return this.rows().filter((r) => this.config.searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(t)));
  });

  ngOnInit(): void {
    this.search.valueChanges.subscribe((v) => this.term.set(v));
    this.load();
    const sources = new Set(this.config.fields.map((f) => f.optionsSource).filter(Boolean));
    if (sources.has('courses')) this.admin.list<Row>('/courses', { all: 'true', sort: 'title' }).subscribe({ next: (r) => this.courseOptions.set(r.map((c) => ({ value: c.id, label: String(c['title']) }))), error: () => undefined });
    if (sources.has('trainers')) this.admin.list<Row>('/trainers', { includeInactive: 'true' }).subscribe({ next: (r) => this.trainerOptions.set(r.map((t) => ({ value: t.id, label: `${t['name']}${t['isActive'] === false ? ' (inactive)' : ''}` }))), error: () => undefined });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.list<Row>(this.config.endpoint, this.config.listParams).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e: ApiErrorInfo) => { this.error.set(e); this.loading.set(false); },
    });
  }

  str(v: unknown): string { return v === null || v === undefined ? '' : String(v); }
  num(v: unknown): number | null { return typeof v === 'number' ? v : null; }
  list(v: unknown): string { return Array.isArray(v) ? v.join(', ') : this.str(v); }
  label(row: Row): string { return this.str(row['title'] ?? row['name'] ?? row['question']); }

  optionsFor(f: CrudField): CrudOption[] {
    if (f.optionsSource === 'courses') return this.courseOptions();
    if (f.optionsSource === 'trainers') return this.trainerOptions();
    return f.options || [];
  }

  private buildForm(source: Record<string, unknown>): void {
    const controls: Record<string, AbstractControl> = {};
    for (const f of this.config.fields) {
      const validators: ValidatorFn[] = [];
      if (f.required && f.type !== 'checkbox') validators.push(f.type === 'multiselect' ? (c) => (Array.isArray(c.value) && c.value.length ? null : { required: true }) : Validators.required);
      if (f.type === 'email') validators.push(Validators.email);
      if (f.min !== undefined) validators.push(Validators.min(f.min));
      if (f.max !== undefined) validators.push(Validators.max(f.max));
      let value = source[f.key];
      if (f.type === 'lines') value = Array.isArray(value) ? value.join('\n') : '';
      else if (f.type === 'multiselect') value = Array.isArray(value) ? [...value] : [];
      else if (f.type === 'checkbox') value = Boolean(value);
      else if (value === null || value === undefined) value = '';
      controls[f.key] = new FormControl(value, validators);
    }
    this.form = new FormGroup(controls);
  }

  openCreate(): void { this.saveError.set(''); this.buildForm({ ...this.config.defaults }); this.editing.set(false); }
  openEdit(row: Row): void { this.saveError.set(''); this.buildForm(row); this.editing.set(row); }

  isChecked(key: string, value: string): boolean { const v = this.form.get(key)?.value; return Array.isArray(v) && v.includes(value); }
  toggle(key: string, value: string): void {
    const control = this.form.get(key);
    if (!control) return;
    const current: string[] = Array.isArray(control.value) ? control.value : [];
    control.setValue(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    control.markAsTouched();
  }

  private payload(): Record<string, unknown> {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of this.config.fields) {
      const v = raw[f.key];
      if (f.type === 'lines') out[f.key] = String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'number') out[f.key] = v === '' || v === null ? null : Number(v);
      else if (f.type === 'checkbox' || f.type === 'multiselect') out[f.key] = v;
      else out[f.key] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v;
    }
    return out;
  }

  save(): void {
    this.saveError.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); this.saveError.set('Please correct the highlighted fields.'); return; }
    const current = this.editing();
    const body = this.payload();
    this.saving.set(true);
    const request = current ? this.admin.update<Row>(this.config.endpoint, current.id, body) : this.admin.create<Row>(this.config.endpoint, body);
    request.subscribe({
      next: () => { this.saving.set(false); this.editing.set(null); this.toast.success(`${this.config.singular} ${current ? 'updated' : 'created'}`); this.load(); },
      error: (e: ApiErrorInfo) => { this.saving.set(false); applyServerErrors(this.form, e); this.saveError.set(e.message); },
    });
  }

  async remove(row: Row): Promise<void> {
    const name = this.label(row);
    const ok = await this.confirm.ask({ title: `${this.config.deleteLabel} "${name}"?`, message: this.config.deleteMessage, confirmText: this.config.deleteLabel, danger: true });
    if (!ok) return;
    let hard = this.config.deleteMode === 'hard';
    if (!hard && this.config.hardDeleteOption) {
      hard = await this.confirm.ask({ title: 'Delete permanently instead?', message: `Choose "Delete permanently" to remove "${name}" entirely (only allowed when nothing references it), or "${this.config.deleteLabel} only" to keep the record.`, confirmText: 'Delete permanently', cancelText: `${this.config.deleteLabel} only`, danger: true });
    }
    this.admin.remove(this.config.endpoint, row.id, hard && this.config.deleteMode === 'soft' ? { hard: 'true' } : {}).subscribe({
      next: () => { this.toast.success(`${this.config.singular} ${hard ? 'deleted' : this.config.deleteLabel.toLowerCase() + 'd'}`); this.load(); },
      error: (e: ApiErrorInfo) => this.toast.error(e.message),
    });
  }
}
