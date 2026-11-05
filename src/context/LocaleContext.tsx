import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import {
  AppLocale,
  DEFAULT_LOCALE,
  formatAmount,
  formatDate,
  formatNumber,
  isAppLocale,
} from '../utils/locale';

const LOCALE_STORAGE_KEY = 'app_locale';

interface LocaleContextType {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  formatDate: (value: string | Date, options?: { withYear?: boolean }) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatAmount: (value: number) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

// Storage can be unavailable (private mode, blocked site data): fall back to the default.
const loadLocale = (): AppLocale => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
};

const saveLocale = (locale: AppLocale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The choice still applies for this session.
  }
};

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<AppLocale>(loadLocale);

  const value = useMemo<LocaleContextType>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        saveLocale(next);
      },
      formatDate: (date, options) => formatDate(date, locale, options),
      formatNumber: (number, options) => formatNumber(number, locale, options),
      formatAmount: (amount) => formatAmount(amount, locale),
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
