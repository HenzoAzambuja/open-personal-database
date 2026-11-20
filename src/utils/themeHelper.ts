import React from "react";

/**
 * Converte um valor hexadecimal (#RRGGBB ou #RGB) em valores numéricos RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 99, g: 102, b: 241 }; // Padrão Indigo #6366f1
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Escurece ou clareia uma cor RGB por um fator (-1.0 a 1.0)
 */
function adjustBrightness(rgb: { r: number; g: number; b: number }, factor: number): string {
  const adjust = (val: number) => {
    if (factor > 0) {
      return Math.min(255, Math.round(val + (255 - val) * factor));
    } else {
      return Math.max(0, Math.round(val * (1 + factor)));
    }
  };
  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Gera as variáveis CSS completas da paleta temática da Wiki
 */
export function getThemeStyleVariables(themeColor?: string | null): React.CSSProperties {
  const baseColor = themeColor || "#6366f1";
  const rgb = hexToRgb(baseColor);
  const darkColor = adjustBrightness(rgb, -0.35); // Para gradientes
  const lightColor = adjustBrightness(rgb, 0.35); // Para textos e highlights

  return {
    "--wiki-theme-color": baseColor,
    "--wiki-theme-rgb": `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    "--wiki-theme-subtle": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    "--wiki-theme-border": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    "--wiki-theme-glow": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
    "--wiki-theme-dark": darkColor,
    "--wiki-theme-light": lightColor,
  } as React.CSSProperties;
}
