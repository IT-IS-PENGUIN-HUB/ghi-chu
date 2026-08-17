import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = {
  system: "Theo hệ thống",
  light: "Nền sáng",
  dark: "Nền tối",
} as const;

export function ThemeToggle() {
  const { mode, cycle } = useTheme();
  const Icon = ICON[mode];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Giao diện: ${LABEL[mode]}`}
      title={`Giao diện: ${LABEL[mode]}`}
      className="tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
