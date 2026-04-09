export const formatCurrency = (amount: number, currency?: string) => {
  const symbols: Record<string, string> = {
    'PEN': 'S/',
    'COP': '$',
    'USD': '$',
    'EUR': '€'
  };
  const symbol = symbols[currency || ''] || '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  return symbol ? `${symbol} ${formatted}` : formatted;
};
