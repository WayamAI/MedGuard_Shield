/**
 * Tone vocabulary, the bridge between domain meaning and feedback tokens.
 *
 * Lives outside the component layer so it can be imported anywhere (charts,
 * SVG fills, inline styles) without dragging components along.
 */

/** The app's established tone names. `danger`/`muted` map onto the token
 *  layer's feedback.error / feedback.neutral families. */
export type Tone = "success" | "warning" | "danger" | "info" | "muted";

const FAMILY: Record<Tone, string> = {
  success: "success",
  warning: "warning",
  danger: "error",
  info: "info",
  muted: "neutral",
};

/** A tone's icon colour as a CSS value, for SVG fills, charts and inline styles. */
export const toneVar = (tone: Tone) => `var(--sem-feedback-${FAMILY[tone]}-icon)`;

/** 0-100 score where higher is better (compliance, health). */
export const scoreTone = (score: number): Tone =>
  score >= 90 ? "success" : score >= 80 ? "warning" : "danger";

/** 0-100 value where higher is worse (risk). */
export const riskTone = (risk: number): Tone =>
  risk >= 70 ? "danger" : risk >= 40 ? "warning" : "success";
