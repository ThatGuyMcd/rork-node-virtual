export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function calculateAverageColor(colors: string[]): string {
  if (colors.length === 0) return '#3b82f6';

  const rgbColors = colors
    .map(hexToRgb)
    .filter((rgb): rgb is { r: number; g: number; b: number } => rgb !== null);

  if (rgbColors.length === 0) return '#3b82f6';

  const avgR = rgbColors.reduce((sum, rgb) => sum + rgb.r, 0) / rgbColors.length;
  const avgG = rgbColors.reduce((sum, rgb) => sum + rgb.g, 0) / rgbColors.length;
  const avgB = rgbColors.reduce((sum, rgb) => sum + rgb.b, 0) / rgbColors.length;

  return rgbToHex(avgR, avgG, avgB);
}

export function getMostCommonColor(colors: string[]): string {
  if (colors.length === 0) return '#3b82f6';

  const colorCounts = new Map<string, number>();
  
  colors.forEach(color => {
    const normalizedColor = color.toLowerCase();
    colorCounts.set(normalizedColor, (colorCounts.get(normalizedColor) || 0) + 1);
  });

  let mostCommonColor = '#3b82f6';
  let maxCount = 0;

  colorCounts.forEach((count, color) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonColor = color;
    }
  });

  return mostCommonColor;
}
