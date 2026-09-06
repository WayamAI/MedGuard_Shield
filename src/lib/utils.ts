import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's stock class names. Our design system adds
 * custom font-size keys (text-caption, text-body-md, text-display-page, ...) and
 * custom colour keys, and `text-*` is ambiguous between the two groups. Without
 * this registration twMerge classifies e.g. `text-caption` as a text COLOUR and
 * silently drops it when a real colour like `text-feedback-info` is merged in -
 * losing the font size wherever cn() combines the two.
 */
const FONT_SIZES = [
  "display-6xl", "display-5xl", "display-4xl", "display-3xl", "display-2xl",
  "display-xl", "display-lg", "display-base",
  "display-page", "display-metric", "display-metric-sm", "display-section",
  "heading-lg", "heading-md", "heading-sm",
  "body-lg", "body-md", "body-sm",
  "label-md", "label-sm", "caption",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
