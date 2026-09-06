import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <IconButton
      icon={theme === "dark" ? "themeLight" : "themeDark"}
      aria-label={label}
      title={label}
      size="sm"
      onClick={toggleTheme}
    />
  );
}
