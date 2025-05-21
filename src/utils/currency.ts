import { currencyKeccak256 } from './keccak';

export const Currency = {
  AED: 'AED',
  ARS: 'ARS',
  AUD: 'AUD',
  CAD: 'CAD',
  CHF: 'CHF',
  CNY: 'CNY',
  EUR: 'EUR',
  GBP: 'GBP',
  HKD: 'HKD',
  IDR: 'IDR',
  ILS: 'ILS',
  JPY: 'JPY',
  KES: 'KES',
  MXN: 'MXN',
  MYR: 'MYR',
  NZD: 'NZD',
  PLN: 'PLN',
  SAR: 'SAR',
  SGD: 'SGD',
  THB: 'THB',
  TRY: 'TRY',
  UGX: 'UGX',
  USD: 'USD',
  VND: 'VND',
  ZAR: 'ZAR',
};

export type CurrencyType = (typeof Currency)[keyof typeof Currency];

function getCurrencies(): string[] {
  return Object.values(Currency);
}

export function getCurrencyInfoFromHash(
  currencyCodeHash: string
): CurrencyData | null {
  return (
    Object.values(currencyInfo).find(
      (currency) => currency.currencyCodeHash === currencyCodeHash
    ) ?? null
  );
}

export function getCurrencyInfoFromCountryCode(
  countryCode: string
): CurrencyData | null {
  return (
    Object.values(currencyInfo).find(
      (currency) => currency.countryCode === countryCode
    ) ?? null
  );
}

export function isSupportedCurrency(currencyCode: string): boolean {
  return Object.values(currencyInfo).some(
    (currency) => currency.currencyCode === currencyCode
  );
}

export const currencies = getCurrencies();

interface CurrencyData {
  currency: CurrencyType;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  currencyCodeHash: string;
  countryCode: string;
}

export const currencyInfo: Record<CurrencyType, CurrencyData> = {
  [Currency.AED]: {
    currency: Currency.AED,
    currencyCode: 'AED',
    currencyName: 'United Arab Emirates Dirham',
    currencyCodeHash: currencyKeccak256('AED'),
    currencySymbol: 'د.إ',
    countryCode: 'ae',
  },
  [Currency.ARS]: {
    currency: Currency.ARS,
    currencyCode: 'ARS',
    currencyName: 'Argentine Peso',
    currencyCodeHash: currencyKeccak256('ARS'),
    currencySymbol: '$',
    countryCode: 'ar',
  },
  [Currency.AUD]: {
    currency: Currency.AUD,
    currencyCode: 'AUD',
    currencyName: 'Australian Dollar',
    currencyCodeHash: currencyKeccak256('AUD'),
    currencySymbol: 'A$',
    countryCode: 'au',
  },
  [Currency.CAD]: {
    currency: Currency.CAD,
    currencyCode: 'CAD',
    currencyName: 'Canadian Dollar',
    currencyCodeHash: currencyKeccak256('CAD'),
    currencySymbol: 'C$',
    countryCode: 'ca',
  },
  [Currency.CHF]: {
    currency: Currency.CHF,
    currencyCode: 'CHF',
    currencyName: 'Swiss Franc',
    currencyCodeHash: currencyKeccak256('CHF'),
    currencySymbol: 'Fr',
    countryCode: 'ch',
  },
  [Currency.CNY]: {
    currency: Currency.CNY,
    currencyCode: 'CNY',
    currencyName: 'Chinese Yuan',
    currencyCodeHash: currencyKeccak256('CNY'),
    currencySymbol: '¥',
    countryCode: 'cn',
  },
  [Currency.EUR]: {
    currency: Currency.EUR,
    currencyCode: 'EUR',
    currencyName: 'Euro',
    currencyCodeHash: currencyKeccak256('EUR'),
    currencySymbol: '€',
    countryCode: 'eu',
  },
  [Currency.GBP]: {
    currency: Currency.GBP,
    currencyCode: 'GBP',
    currencyName: 'British Pound',
    currencyCodeHash: currencyKeccak256('GBP'),
    currencySymbol: '£',
    countryCode: 'gb',
  },
  [Currency.HKD]: {
    currency: Currency.HKD,
    currencyCode: 'HKD',
    currencyName: 'Hong Kong Dollar',
    currencyCodeHash: currencyKeccak256('HKD'),
    currencySymbol: 'HK$',
    countryCode: 'hk',
  },
  [Currency.IDR]: {
    currency: Currency.IDR,
    currencyCode: 'IDR',
    currencyName: 'Indonesian Rupiah',
    currencyCodeHash: currencyKeccak256('IDR'),
    currencySymbol: 'Rp',
    countryCode: 'id',
  },
  [Currency.ILS]: {
    currency: Currency.ILS,
    currencyCode: 'ILS',
    currencyName: 'Israeli New Shekel',
    currencyCodeHash: currencyKeccak256('ILS'),
    currencySymbol: '₪',
    countryCode: 'il',
  },
  [Currency.JPY]: {
    currency: Currency.JPY,
    currencyCode: 'JPY',
    currencyName: 'Japanese Yen',
    currencyCodeHash: currencyKeccak256('JPY'),
    currencySymbol: '¥',
    countryCode: 'jp',
  },
  [Currency.KES]: {
    currency: Currency.KES,
    currencyCode: 'KES',
    currencyName: 'Kenyan Shilling',
    currencyCodeHash: currencyKeccak256('KES'),
    currencySymbol: 'KSh',
    countryCode: 'ke',
  },
  [Currency.MXN]: {
    currency: Currency.MXN,
    currencyCode: 'MXN',
    currencyName: 'Mexican Peso',
    currencyCodeHash: currencyKeccak256('MXN'),
    currencySymbol: '$',
    countryCode: 'mx',
  },
  [Currency.MYR]: {
    currency: Currency.MYR,
    currencyCode: 'MYR',
    currencyName: 'Malaysian Ringgit',
    currencyCodeHash: currencyKeccak256('MYR'),
    currencySymbol: 'RM',
    countryCode: 'my',
  },
  [Currency.NZD]: {
    currency: Currency.NZD,
    currencyCode: 'NZD',
    currencyName: 'New Zealand Dollar',
    currencyCodeHash: currencyKeccak256('NZD'),
    currencySymbol: 'NZ$',
    countryCode: 'nz',
  },
  [Currency.PLN]: {
    currency: Currency.PLN,
    currencyCode: 'PLN',
    currencyName: 'Polish Złoty',
    currencyCodeHash: currencyKeccak256('PLN'),
    currencySymbol: 'zł',
    countryCode: 'pl',
  },
  [Currency.SAR]: {
    currency: Currency.SAR,
    currencyCode: 'SAR',
    currencyName: 'Saudi Riyal',
    currencyCodeHash: currencyKeccak256('SAR'),
    currencySymbol: '﷼',
    countryCode: 'sa',
  },
  [Currency.SGD]: {
    currency: Currency.SGD,
    currencyCode: 'SGD',
    currencyName: 'Singapore Dollar',
    currencyCodeHash: currencyKeccak256('SGD'),
    currencySymbol: 'S$',
    countryCode: 'sg',
  },
  [Currency.THB]: {
    currency: Currency.THB,
    currencyCode: 'THB',
    currencyName: 'Thai Baht',
    currencyCodeHash: currencyKeccak256('THB'),
    currencySymbol: '฿',
    countryCode: 'th',
  },
  [Currency.TRY]: {
    currency: Currency.TRY,
    currencyCode: 'TRY',
    currencyName: 'Turkish Lira',
    currencyCodeHash: currencyKeccak256('TRY'),
    currencySymbol: '₺',
    countryCode: 'tr',
  },
  [Currency.UGX]: {
    currency: Currency.UGX,
    currencyCode: 'UGX',
    currencyName: 'Ugandan Shilling',
    currencyCodeHash: currencyKeccak256('UGX'),
    currencySymbol: 'USh',
    countryCode: 'ug',
  },
  [Currency.USD]: {
    currency: Currency.USD,
    currencyCode: 'USD',
    currencyName: 'United States Dollar',
    currencyCodeHash: currencyKeccak256('USD'),
    currencySymbol: '$',
    countryCode: 'us',
  },
  [Currency.VND]: {
    currency: Currency.VND,
    currencyCode: 'VND',
    currencyName: 'Vietnamese Dong',
    currencyCodeHash: currencyKeccak256('VND'),
    currencySymbol: '₫',
    countryCode: 'vn',
  },
  [Currency.ZAR]: {
    currency: Currency.ZAR,
    currencyCode: 'ZAR',
    currencyName: 'South African Rand',
    currencyCodeHash: currencyKeccak256('ZAR'),
    currencySymbol: 'R',
    countryCode: 'za',
  },
};
