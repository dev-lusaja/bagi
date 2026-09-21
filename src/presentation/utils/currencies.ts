export const COUNTRY_CURRENCIES: { country: string; code: string }[] = [
  { country: 'Argentina', code: 'ARS' },
  { country: 'Bolivia', code: 'BOB' },
  { country: 'Brasil', code: 'BRL' },
  { country: 'Chile', code: 'CLP' },
  { country: 'Colombia', code: 'COP' },
  { country: 'Ecuador', code: 'USD' },
  { country: 'México', code: 'MXN' },
  { country: 'Paraguay', code: 'PYG' },
  { country: 'Perú', code: 'PEN' },
  { country: 'Uruguay', code: 'UYU' },
  { country: 'Venezuela', code: 'VES' },
  { country: 'Estados Unidos', code: 'USD' },
  { country: 'Europa', code: 'EUR' },
];

export const CURRENCY_CODES = Array.from(new Set(COUNTRY_CURRENCIES.map(c => c.code))).sort();
