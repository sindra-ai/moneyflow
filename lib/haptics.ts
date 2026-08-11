/** Best-effort tactile feedback. Silently absent on iOS Safari. */
export function tap(pattern: number | number[] = 8) {
  if (typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no-op */
  }
}

export const HAPTIC = {
  light: () => tap(8),
  select: () => tap(12),
  success: () => tap([10, 40, 18]),
};
