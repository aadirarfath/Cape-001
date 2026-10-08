import { getDbErrorCode } from '@cape001/core';

import { en, type Messages } from './en';

export type { Messages };

export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Messages> = { en };

/** Messages for a locale. English only for now; Malayalam will be added as `ml`. */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale];
}

/** The app's messages. A single language for now, so a constant rather than a context. */
export const m = getMessages();

/** Fill {placeholders} in a message: format('Hi {name}', { name: 'Anu' }) -> 'Hi Anu'. */
export function format(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** A user-facing message for a Supabase/PostgREST error, using our database error codes. */
export function errorMessage(error: { message?: string } | null | undefined, messages: Messages = m): string {
  const code = getDbErrorCode(error);
  if (code) return messages.errors.codes[code];
  if (error?.message && /network request failed|failed to fetch|timeout/i.test(error.message)) {
    return messages.errors.network;
  }
  return messages.errors.generic;
}

/** "45 min", "1 h", "1 h 30 min". */
export function formatDuration(minutes: number, messages: Messages = m): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return format(messages.common.minutes, { minutes });
  if (rest === 0) return format(messages.common.hours, { hours });
  return format(messages.common.hoursMinutes, { hours, minutes: rest });
}
