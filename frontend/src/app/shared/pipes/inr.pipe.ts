import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Formats a number as Indian Rupees, e.g. 55000 -> "₹55,000". */
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined || Number.isNaN(value) ? '-' : formatter.format(value);
  }
}
