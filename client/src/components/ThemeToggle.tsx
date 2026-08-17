import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Chuyển sang nền sáng" : "Chuyển sang nền tối";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-[1.125rem]" /> : <Moon className="size-[1.125rem]" />}
    </button>
  );
}
