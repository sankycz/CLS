/** Krátká vibrace jako potvrzení stisku v rukavicích. Na iOS Safari se tiše ignoruje. */
export const haptic = (pattern: number | number[] = 25): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibrace nejsou podporovány.
  }
};
