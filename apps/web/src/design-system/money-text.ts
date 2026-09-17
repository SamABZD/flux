export function pastedMoney(text: string): string | null {
  let value = text
    .trim()
    .replace(/^(?:USD|EUR|GBP|AED|[$€£])\s*/i, '')
    .replace(/[\u00a0\u202f ]/g, '');
  if (value.includes(',') && value.includes('.')) {
    if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(value)) value = value.replaceAll(',', '');
    else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value))
      value = value.replaceAll('.', '').replace(',', '.');
    else return null;
  } else if (value.includes(',')) {
    if (/^\d+,\d{1,2}$/.test(value)) value = value.replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+$/.test(value)) value = value.replaceAll(',', '');
    else return null;
  }
  if (value.startsWith('.')) value = `0${value}`;
  return /^\d{1,7}(\.\d{0,2})?$/.test(value) ? value : null;
}
