/**
 * Relative-day wording.
 *
 * Five call sites across Access and Vendors each interpolated
 * `${days} days ago` directly, which printed "1 days ago" for anything used
 * or assessed yesterday — visible on the Access review for three of its nine
 * grants. The plural is only part of it: "0 days ago" is not how anyone says
 * "today" either.
 *
 * Kept deliberately small. This is wording for a day count the API has
 * already computed, not a general-purpose relative-time library, and it must
 * never be used to derive a day count of its own — the server owns that.
 */

/** "today" / "yesterday" / "3 days ago". Safe to embed mid-sentence. */
export const daysAgo = (days: number): string =>
  days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

/** The same wording, capitalised for a standalone table cell or field. */
export const daysAgoLabel = (days: number): string => {
  const phrase = daysAgo(days);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};
