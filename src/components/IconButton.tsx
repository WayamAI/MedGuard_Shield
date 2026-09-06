import { forwardRef } from "react";
import { AppIcon, type IconSize } from "@/components/AppIcon";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Variant = "ghost" | "subtle" | "inverse";
type Size = "sm" | "md" | "lg";

/** Each variant's default -> hover -> active states route through action-surface tokens. */
const VARIANT: Record<Variant, string> = {
  ghost:
    "bg-action-tertiary text-action-tertiary hover:bg-action-tertiary-hover hover:text-icon-primary " +
    "active:bg-action-tertiary-focused disabled:text-icon-quaternary",
  subtle:
    "bg-action text-icon-secondary hover:bg-action-secondary-hover hover:text-icon-primary " +
    "active:bg-action-secondary-focused disabled:bg-action-secondary-disabled disabled:text-icon-quaternary",
  inverse:
    "bg-action-primary text-icon-on-color hover:bg-action-primary-hover " +
    "active:bg-action-primary-focused disabled:bg-action-primary-disabled",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const ICON_SIZE: Record<Size, IconSize> = { sm: "sm", md: "md", lg: "lg" };

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Required: an icon-only control is unusable by screen readers without it. */
  "aria-label": string;
  variant?: Variant;
  size?: Size;
  spin?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = "ghost", size = "md", spin, className, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-60",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      <AppIcon name={icon} size={ICON_SIZE[size]} spin={spin} />
    </button>
  ),
);

IconButton.displayName = "IconButton";

export default IconButton;
