/**
 * What a cell shows when there is nothing to show.
 *
 * One constant rather than a literal in fifteen places, because the whole
 * point of an empty marker is that it looks identical everywhere: the eye
 * scanning a column should read "nothing here" without stopping.
 *
 * It used to be an em dash. That was replaced on a design call to strip em
 * dashes out of the interface, and "n/a" is the replacement rather than a
 * hyphen because a lone "-" reads as a minus sign in a column of numbers,
 * which is exactly the wrong thing for a risk score to appear to say.
 */
export const EMPTY_VALUE = "n/a";
