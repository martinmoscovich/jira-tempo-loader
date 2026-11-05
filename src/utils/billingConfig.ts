/**
 * Billing settings for "Generate Invoice". They describe how a company tags billable epics,
 * so they are entered in the app and kept in localStorage instead of being hardcoded.
 */
export interface BillingConfig {
  /** Prefix of the billing code in epic titles (e.g. "PRJ" for "PRJ01234"). Empty disables codes. */
  codePrefix: string;
  /** Number of digits after the prefix. */
  codeDigits: number;
  /** Project or epic names grouped as "Internal Time", one per entry (matched case-insensitively). */
  internalProjects: string[];
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  codePrefix: '',
  codeDigits: 5,
  internalProjects: [],
};

export const INTERNAL_TIME_LABEL = 'Internal Time';

const STORAGE_KEY = 'billing_config';

export function loadBillingConfig(): BillingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BILLING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BillingConfig>;
    return {
      codePrefix: typeof parsed.codePrefix === 'string' ? parsed.codePrefix : '',
      codeDigits: isValidDigits(parsed.codeDigits) ? parsed.codeDigits : DEFAULT_BILLING_CONFIG.codeDigits,
      internalProjects: Array.isArray(parsed.internalProjects)
        ? parsed.internalProjects.filter((name): name is string => typeof name === 'string')
        : [],
    };
  } catch {
    return DEFAULT_BILLING_CONFIG;
  }
}

export function saveBillingConfig(config: BillingConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable (private mode, quota): the settings just are not remembered.
  }
}

export function isValidDigits(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Capitalizes each word, keeping the billing prefix (e.g. a company acronym) uppercase. */
export function capitalizeProject(text: string, config: BillingConfig): string {
  const prefix = config.codePrefix.trim().toUpperCase();
  return text
    .split(' ')
    .map((word) => {
      if (prefix && word.toUpperCase() === prefix) return prefix;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export interface EpicClassification {
  /** Invoice group name. */
  project: string;
  /** Billing code, a placeholder such as "PRJ?????" when missing, or empty when codes are off or internal. */
  code: string;
  /** True when codes are enabled and this billable epic has none (shown as a warning). */
  missingCode: boolean;
}

export function classifyEpic(
  epicText: string,
  projectRaw: string,
  config: BillingConfig,
): EpicClassification {
  const prefix = config.codePrefix.trim().toUpperCase();
  const internalNames = config.internalProjects
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const isInternal = (text: string) => internalNames.includes(text.toLowerCase().trim());

  const codeMatch = prefix
    ? epicText.match(new RegExp(`${escapeRegExp(prefix)}(\\d{${config.codeDigits}})`, 'i'))
    : null;

  if (codeMatch) {
    return { project: capitalizeProject(projectRaw, config), code: `${prefix}${codeMatch[1]}`, missingCode: false };
  }
  if (isInternal(epicText) || isInternal(projectRaw)) {
    return { project: INTERNAL_TIME_LABEL, code: '', missingCode: false };
  }
  return {
    project: capitalizeProject(projectRaw, config),
    code: prefix ? `${prefix}${'?'.repeat(config.codeDigits)}` : '',
    missingCode: Boolean(prefix),
  };
}
