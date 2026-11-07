import type { StoreProduct } from '../../billing/purchaseProvider';

/** Durée d'une période ISO 8601 de boutique (P1M, P3M, P1Y, P12M, P52W…) en mois ; null si inconnue ou non mensuelle. */
export function periodToMonths(period: string | null | undefined): number | null {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(period ?? '');
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const [, y, mo, w, d] = m;
  // Semaines et jours : conversion approximative en mois, acceptée seulement si elle tombe sur un nombre entier (52 sem. = 12 mois).
  const months = Number(y ?? 0) * 12 + Number(mo ?? 0) + (Number(w ?? 0) * 7 + Number(d ?? 0)) / 30.4375;
  const rounded = Math.round(months);
  return rounded > 0 && Math.abs(months - rounded) < 0.15 ? rounded : null;
}

/**
 * Prix par mois d'une offre de plusieurs mois, formaté pour la langue (« 8,33 € » / « €8.33 »), ou null si on ne peut pas le
 * calculer sûrement : montant ou devise absents du store, durée incohérente avec celle de la boutique, formatage indisponible.
 * Calcul en centimes entiers (pas de dérive flottante), arrondi au centime le plus proche. Une offre d'un mois n'a pas de ligne
 * « par mois » (le prix est déjà mensuel).
 */
export function monthlyPrice(product: StoreProduct | undefined, months: number, locale: string): string | null {
  if (!product || !Number.isInteger(months) || months <= 1) return null;
  const { price, currencyCode, subscriptionPeriod } = product;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || !currencyCode) return null;
  if (subscriptionPeriod != null && periodToMonths(subscriptionPeriod) !== months) return null;
  try {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const scale = 10 ** digits;
    const minor = Math.round(price * scale);
    const perMonthMinor = Math.round(minor / months);
    return formatter.format(perMonthMinor / scale);
  } catch {
    return null;
  }
}
