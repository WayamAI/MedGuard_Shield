import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Design system Tailwind theme.
 *
 * Colour flows: reference tokens -> semantic tokens -> these utilities -> components.
 * Components consume ONLY the semantic utilities below (bg-page, text-secondary,
 * border-default, ...). Raw reference tokens (--ref-*) are never referenced here.
 *
 * The `colors` block additionally retains the shadcn/ui keys so the ~49 template
 * components in src/components/ui/ keep working; their values are re-derived from
 * the same palette in src/index.css.
 */

const sem = (name: string) => `var(--sem-${name})`;

const feedback = {
  success: {
    DEFAULT: sem("feedback-success-content"),
    content: sem("feedback-success-content"),
    icon: sem("feedback-success-icon"),
    stroke: sem("feedback-success-stroke"),
    background: sem("feedback-success-background"),
  },
  info: {
    DEFAULT: sem("feedback-info-content"),
    content: sem("feedback-info-content"),
    icon: sem("feedback-info-icon"),
    stroke: sem("feedback-info-stroke"),
    background: sem("feedback-info-background"),
  },
  neutral: {
    DEFAULT: sem("feedback-neutral-content"),
    content: sem("feedback-neutral-content"),
    icon: sem("feedback-neutral-icon"),
    stroke: sem("feedback-neutral-stroke"),
    background: sem("feedback-neutral-background"),
  },
  warning: {
    DEFAULT: sem("feedback-warning-content"),
    content: sem("feedback-warning-content"),
    icon: sem("feedback-warning-icon"),
    stroke: sem("feedback-warning-stroke"),
    background: sem("feedback-warning-background"),
  },
  error: {
    DEFAULT: sem("feedback-error-content"),
    content: sem("feedback-error-content"),
    icon: sem("feedback-error-icon"),
    stroke: sem("feedback-error-stroke"),
    background: sem("feedback-error-background"),
  },
};

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    /*
     * Overrides the scale rather than extending it, and that distinction is
     * the whole point: `extend.boxShadow` MERGES with Tailwind's defaults, so
     * shadow-sm/md/lg would survive and the ~20 shadcn primitives under
     * components/ui would keep painting drop shadows. Replacing the scale
     * makes every `shadow-*` class inert in one place, instead of editing
     * twenty vendored files and hoping the next `shadcn add` does not undo it.
     *
     * Elevation here comes from surface steps (page < container < raised <
     * raised-2) plus a stroke. Nothing floats.
     */
    boxShadow: { none: "none" },

    extend: {
      fontFamily: {
        // Geist — every piece of UI text.
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        // Michroma — display/identity/telemetry only. Weight 400 exists; never faux-bold.
        display: ["Michroma", "Geist", "system-ui", "sans-serif"],
      },

      fontSize: {
        // --- Michroma display scale -------------------------------------------
        "display-6xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "400" }],
        "display-5xl": ["3rem", { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "400" }],
        "display-4xl": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "400" }],
        "display-3xl": ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "400" }],
        "display-2xl": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-xl": ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.005em", fontWeight: "400" }],
        "display-lg": ["1.125rem", { lineHeight: "1.3", letterSpacing: "0", fontWeight: "400" }],
        "display-base": ["1rem", { lineHeight: "1.35", letterSpacing: "0", fontWeight: "400" }],

        // --- Semantic type tokens ---------------------------------------------
        // Michroma-bearing (pair with `font-display`)
        "display-page": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-metric": ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "400" }],
        "display-metric-sm": ["1.5rem", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-section": ["0.875rem", { lineHeight: "1.3", letterSpacing: "0.02em", fontWeight: "400" }],

        // Geist-bearing (default family)
        "heading-lg": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "heading-md": ["1rem", { lineHeight: "1.35", letterSpacing: "-0.005em", fontWeight: "600" }],
        "heading-sm": ["0.875rem", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.45", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.45", fontWeight: "400" }],
        "label-md": ["0.8125rem", { lineHeight: "1.3", fontWeight: "500" }],
        "label-sm": ["0.75rem", { lineHeight: "1.3", fontWeight: "500" }],
        caption: ["0.6875rem", { lineHeight: "1.35", letterSpacing: "0.01em", fontWeight: "400" }],
      },

      colors: {
        // --- shadcn/ui compatibility layer (values re-derived in index.css) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", hover: "hsl(var(--primary-hover))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        sidebar: "hsl(var(--sidebar-bg))",
        "sidebar-active": { DEFAULT: "hsl(var(--sidebar-active))", foreground: "hsl(var(--sidebar-active-foreground))" },

        // --- Semantic layer (fill-*, stroke-*, ring-*, divide-*, ...) ---------
        brand: { DEFAULT: "hsl(var(--primary))", hover: "hsl(var(--primary-hover))", foreground: "hsl(var(--primary-foreground))" },
        feedback,
        matrix: {
          low: sem("matrix-low"),
          moderate: sem("matrix-moderate"),
          high: sem("matrix-high"),
          critical: sem("matrix-critical"),
          extreme: sem("matrix-extreme"),
          stroke: sem("matrix-stroke"),
        },
        solid: {
          critical: sem("solid-critical"),
          high: sem("solid-high"),
          medium: sem("solid-medium"),
          low: sem("solid-low"),
          success: sem("solid-success"),
          warning: sem("solid-warning"),
          error: sem("solid-error"),
          info: sem("solid-info"),
          neutral: sem("solid-neutral"),
        },
        "on-solid": {
          critical: sem("solid-critical-content"),
          high: sem("solid-high-content"),
          medium: sem("solid-medium-content"),
          low: sem("solid-low-content"),
          success: sem("solid-success-content"),
          warning: sem("solid-warning-content"),
          error: sem("solid-error-content"),
          info: sem("solid-info-content"),
          neutral: sem("solid-neutral-content"),
        },
        severity: {
          critical: sem("severity-critical"),
          high: sem("severity-high"),
          medium: sem("severity-medium"),
          low: sem("severity-low"),
          info: sem("severity-info"),
        },
        chart: {
          1: sem("chart-1"), 2: sem("chart-2"), 3: sem("chart-3"),
          4: sem("chart-4"), 5: sem("chart-5"),
        },
        surface: {
          page: sem("surface-page-background"),
          container: sem("surface-container"),
          raised: sem("surface-raised"),
          "raised-2": sem("surface-raised-x2"),
          action: sem("surface-action"),
        },
      },

      textColor: {
        // `primary`/`secondary` are objects so text-primary-foreground and
        // text-secondary-foreground (used by existing components) survive.
        primary: {
          DEFAULT: sem("text-primary"),
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: { DEFAULT: sem("text-secondary"), foreground: "hsl(var(--secondary-foreground))" },
        tertiary: sem("text-tertiary"),
        quaternary: sem("text-quaternary"),
        "on-color": sem("text-on-color"),

        icon: {
          primary: sem("icon-primary"),
          secondary: sem("icon-secondary"),
          tertiary: sem("icon-tertiary"),
          quaternary: sem("icon-quaternary"),
          "on-color": sem("icon-on-color"),
        },

        "action-primary": sem("action-surface-primary-content"),
        "action-secondary": sem("action-surface-secondary-content"),
        "action-tertiary": sem("action-surface-tertiary-content"),
      },

      backgroundColor: {
        page: sem("surface-page-background"),
        container: sem("surface-container"),
        raised: sem("surface-raised"),
        "raised-2": sem("surface-raised-x2"),
        action: sem("surface-action"),

        "action-primary": {
          DEFAULT: sem("action-surface-primary-default"),
          hover: sem("action-surface-primary-hover"),
          focused: sem("action-surface-primary-focused"),
          disabled: sem("action-surface-primary-disabled"),
        },
        "action-secondary": {
          DEFAULT: sem("action-surface-secondary-default"),
          hover: sem("action-surface-secondary-hover"),
          focused: sem("action-surface-secondary-focused"),
          disabled: sem("action-surface-secondary-disabled"),
        },
        "action-tertiary": {
          DEFAULT: sem("action-surface-tertiary-default"),
          hover: sem("action-surface-tertiary-hover"),
          focused: sem("action-surface-tertiary-focused"),
          disabled: sem("action-surface-tertiary-disabled"),
        },
      },

      borderColor: {
        default: sem("stroke-default"),
        active: sem("stroke-active"),
        muted: sem("stroke-muted"),
        disabled: sem("stroke-disabled"),
        "on-color": sem("stroke-on-color"),
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",

        /*
         * Two radii carry the whole product, so a card and the control inside
         * it can never disagree. `card` is every container: card, modal,
         * slide-over, login panel. `control` is everything you can click or
         * type into: button, input, select, dropdown, chip.
         *
         * Concentric, not equal: 16px container, 10px control. A control
         * sitting inside a card needs the smaller radius or the corners read
         * as two unrelated curves.
         *
         * 0.625rem is not an arbitrary pick. It is exactly what `rounded-md`
         * already resolves to (--radius 0.75rem minus 2px), so the 80-odd
         * existing `rounded-md` controls are already conformant and this token
         * names the current value rather than silently restyling every button
         * in the product.
         */
        card: "1rem",
        control: "0.625rem",
      },

      transitionDuration: {
        DEFAULT: "180ms",
      },

    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
