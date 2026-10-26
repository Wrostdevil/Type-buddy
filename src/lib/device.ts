/**
 * Touch-device sniffing. "Touch only" means no precise pointer at all —
 * phones and most tablets; touch-capable laptops keep the hardware path.
 */
export function isTouchOnly(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches &&
    !window.matchMedia('(any-pointer: fine)').matches
  )
}
