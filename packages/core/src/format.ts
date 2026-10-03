import { APP_LOCALE } from "./time";

/** Format a price stored in paise as rupees, e.g. 30000 -> "₹300", 12550 -> "₹125.50". */
export function formatPricePaise(paise: number, locale: string = APP_LOCALE): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Format a distance in metres, e.g. 450 -> "450 m", 2345 -> "2.3 km". */
export function formatDistance(metres: number, locale: string = APP_LOCALE): string {
  if (metres < 1000) {
    const rounded = Math.max(10, Math.round(metres / 10) * 10);
    return new Intl.NumberFormat(locale, { style: "unit", unit: "meter" }).format(rounded);
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    maximumFractionDigits: metres < 10_000 ? 1 : 0,
  }).format(metres / 1000);
}
