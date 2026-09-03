export interface SelectOption<T = string | number | boolean> {
  label: string;
  value: T;
  icon?: string;
  disabled?: boolean;
  description?: string;
}
