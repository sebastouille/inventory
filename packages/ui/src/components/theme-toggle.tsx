"use client";

import { useTheme } from "next-themes";
import { HeaderIconButton } from "./header-icon-button";
import { MoonStarIcon, SunMediumIcon } from "./ui-providers";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <HeaderIconButton
      icon={dark ? <SunMediumIcon className="size-5" /> : <MoonStarIcon className="size-5" />}
      label={dark ? "Activer le theme clair" : "Activer le theme sombre"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    />
  );
}
