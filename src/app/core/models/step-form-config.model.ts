import { SelectOption } from './select-option.model';

export type { SelectOption };

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'currency-amount'
  | 'validity-unit'
  | 'textarea'
  | 'checkbox'
  | 'readonly';

export interface StepFormFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  colSpan?: 1 | 2;
  defaultValue?: any;
  options?: SelectOption[];
  currencyKey?: string;
  currencyOptions?: SelectOption[];
  unitKey?: string;
  unitOptions?: SelectOption[];
  readonlyValueFn?: () => string;
}
