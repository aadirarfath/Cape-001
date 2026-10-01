import { getDbErrorCode } from "@cape001/core";
import { en, type Messages } from "./en";

export type { Messages };

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Messages> = { en };

/** Messages for a locale. English only for now; Malayalam will be added as `ml`. */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale];
}

/** Fill {placeholders} in a message: format("Hi {name}", { name: "Anu" }) -> "Hi Anu". */
export function format(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** A user-facing message for a Supabase/PostgREST error, using our database error codes. */
export function errorMessage(m: Messages, error: { message?: string } | null | undefined): string {
  const code = getDbErrorCode(error);
  return code ? m.errors.codes[code] : m.errors.generic;
}
