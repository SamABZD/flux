import { categories, statuses } from './types';
import type { TransactionFilters } from './types';

export const defaultFilters: TransactionFilters = {
  account: '',
  category: '',
  status: '',
  direction: '',
  search: '',
  merchant: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 20,
};
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function readFilters(params: URLSearchParams): TransactionFilters {
  const category = params.get('category') ?? '';
  const status = params.get('status') ?? '';
  const direction = params.get('direction') ?? '';
  const dateFrom = params.get('dateFrom') ?? '';
  const dateTo = params.get('dateTo') ?? '';
  const page = Number(params.get('page') ?? '1');
  return {
    ...defaultFilters,
    account: (params.get('account') ?? '').slice(0, 64),
    merchant: (params.get('merchant') ?? '').slice(0, 100),
    search: (params.get('search') ?? '').slice(0, 160),
    category: categories.find((item) => item === category) ?? '',
    status: statuses.find((item) => item === status) ?? '',
    direction: direction === 'credit' || direction === 'debit' ? direction : '',
    dateFrom: validDate(dateFrom) ? dateFrom : '',
    dateTo: validDate(dateTo) ? dateTo : '',
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
  };
}
export function filterParams(filters: TransactionFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== '' && key !== 'limit' && !(key === 'page' && value === 1))
      params.set(key, String(value));
  return params;
}
export function activeFilterCount(filters: TransactionFilters) {
  return ['account', 'category', 'status', 'direction', 'merchant', 'dateFrom', 'dateTo'].filter(
    (key) => filters[key as keyof TransactionFilters] !== '',
  ).length;
}
