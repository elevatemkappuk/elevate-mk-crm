import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';

interface FilterOption { id: number; name: string; }
let nextMultiselectId = 0;

@Component({
  selector: 'app-filter-multiselect',
  template: `
    <fieldset>
      <legend>{{ label() }}</legend>
      <div class="search-control">
      <input [id]="searchId" type="search" class="crm-control" autocomplete="off"
        [attr.aria-label]="searchLabel()" [placeholder]="searchLabel() + '...'"
        [attr.aria-controls]="searchId + '-options'" (focus)="expanded.set(true)" (click)="expanded.set(true)"
        [value]="search()" (input)="search.set($any($event.target).value); expanded.set(true)" />
      <button type="button" class="disclosure" [attr.aria-label]="'Show or hide ' + label().toLowerCase() + ' options'"
        [attr.aria-expanded]="expanded()" [attr.aria-controls]="searchId + '-options'" (click)="expanded.set(!expanded())"><span aria-hidden="true">&#8964;</span></button>
      </div>
      @if (selected().length) {
        <div class="chips" [attr.aria-label]="'Selected ' + label().toLowerCase()">
          @for (id of selected(); track id) {
            <button type="button" class="crm-chip" [attr.aria-label]="'Remove ' + nameFor(id)" (click)="toggle(id)">
              {{ nameFor(id) }} <span aria-hidden="true">&times;</span>
            </button>
          }
        </div>
      }
      <div class="options" [id]="searchId + '-options'" [hidden]="!expanded()">
        @for (option of matching(); track option.id) {
          <label class="option"><input type="checkbox" class="crm-check" [checked]="selected().includes(option.id)" (change)="toggle(option.id)" />{{ option.name }}</label>
        } @empty { <p>No matching options.</p> }
      </div>
      @if (expanded()) { <small aria-live="polite">{{ matching().length }} options</small> }
    </fieldset>
  `,
  styles: `
    :host { display:block; min-width:0; }
    fieldset { display:grid; gap:.65rem; min-width:0; margin:0; padding:0; border:0; }
    legend { margin-bottom:.65rem; padding:0; font-weight:600; }
    small { font-size:var(--crm-font-sm); color:var(--crm-text-secondary); }
    .search-control { position:relative; }
    .search-control input { padding-right:3rem; }
    .disclosure { position:absolute; right:1px; top:1px; bottom:1px; width:2.5rem; border:0; border-radius:var(--crm-radius-md); background:transparent; color:var(--crm-text-secondary); cursor:pointer; }
    .chips { display:flex; gap:.4rem; flex-wrap:wrap; }
    .crm-chip { max-width:100%; overflow-wrap:anywhere; text-align:left; cursor:pointer; }
    .options { max-height:10rem; overflow-y:auto; overscroll-behavior:contain; }
    .option { display:flex; align-items:center; gap:.65rem; min-height:2.5rem; padding:.4rem; overflow-wrap:anywhere; cursor:pointer; }
    input[type=checkbox] { flex:none; }
    p { margin:.5rem; font-size:var(--crm-font-sm); color:var(--crm-text-muted); }
    :is(input,button):focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:2px; }
  `,
})
export class FilterMultiselectComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly expanded = signal(false);
  readonly label = input.required<string>();
  readonly fallbackLabel = input.required<string>();
  readonly options = input.required<readonly FilterOption[]>();
  readonly selected = input.required<number[]>();
  readonly selectionChanged = output<number[]>();
  readonly search = signal('');
  readonly searchLabel = computed(() => 'Search ' + (this.label() === 'Industry' ? 'industries' : this.label().toLowerCase()));
  readonly searchId = 'filter-option-search-' + nextMultiselectId++;
  readonly matching = computed(() => {
    const term = this.search().trim().toLocaleLowerCase();
    return this.options().filter(option => option.name.toLocaleLowerCase().includes(term));
  });

  nameFor(id: number): string {
    return this.options().find(option => option.id === id)?.name ?? `${this.fallbackLabel()} #${id}`;
  }

  toggle(id: number): void {
    if (this.selected().includes(id)) this.selectionChanged.emit(this.selected().filter(value => value !== id));
    else if (this.options().some(option => option.id === id)) this.selectionChanged.emit([...this.selected(), id]);
  }

  @HostListener('focusout', ['$event'])
  closeOnLeave(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) this.expanded.set(false);
  }

  @HostListener('keydown.escape', ['$event'])
  closeOptions(event: Event): void {
    if (!this.expanded()) return;
    event.preventDefault();
    event.stopPropagation();
    this.host.nativeElement.querySelector<HTMLInputElement>('input[type=search]')?.focus();
    this.expanded.set(false);
  }
}
