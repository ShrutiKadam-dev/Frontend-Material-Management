import { Pipe, PipeTransform } from '@angular/core';
import { formatDisplayDate } from '../utils/date.utils';

@Pipe({
  name: 'appDate',
})
export class AppDatePipe implements PipeTransform {
  transform(
    value: Date | string | number | null | undefined,
    format = 'dd-MM-yyyy',
    fallback = '—',
  ): string {
    return formatDisplayDate(value, format, fallback);
  }
}
