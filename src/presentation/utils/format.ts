export const formatCurrency = (amount: number, currency?: string) => {
  const symbols: Record<string, string> = {
    'PEN': 'S/',
    'COP': '$',
    'USD': '$',
    'EUR': '€',
    'ARS': '$',
    'BOB': 'Bs',
    'BRL': 'R$',
    'CLP': '$',
    'MXN': '$',
    'PYG': '₲',
    'UYU': '$U',
    'VES': 'Bs.S',
  };
  const symbol = symbols[currency || ''] || '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  return symbol ? `${symbol} ${formatted}` : formatted;
};

// Normalizes what the user typed in an amount field to a plain numeric string ("1,234.5" → "1234.5").
// Keeps a trailing dot and at most two decimals so partial input like "1234." survives while typing.
export const parseAmountInput = (display: string) => {
  const cleaned = display.replace(/[^\d.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join('').slice(0, 2)}`;
};

// Formats a plain numeric string with the same grouping as formatCurrency ("1234.5" → "1,234.5")
export const formatAmountInput = (raw: string) => {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const grouped = (intPart.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
};

// "2026-10-12" → "12 de octubre". Parses the date parts directly so the day doesn't shift with the timezone.
export const formatDayMonth = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
};
