/**
 * How much larger the whole interface is drawn, as a percentage.
 *
 * This is one number rather than a separate "VR layout" because CSS `zoom`
 * narrows the effective viewport as it magnifies: at 200% a 1920px window
 * lays out as 960px, so the responsive rules this app already has -- and the
 * widths its tests already cover -- are what appears. A second set of
 * components tuned for VR would have to be kept working alongside the first.
 */
export const UI_SCALES = [100, 125, 150, 175, 200] as const

export type UiScale = (typeof UI_SCALES)[number]

export const DEFAULT_UI_SCALE: UiScale = 100

/**
 * The same scale as a plain multiplier, for CSS that has to reason about it.
 * `zoom` alone cannot be read back from a stylesheet.
 */
export const UI_SCALE_PROPERTY = '--ui-scale'

/** What "make this readable in a headset" means, for the one-press preset. */
export const VR_UI_SCALE: UiScale = 150

export function normalizeUiScale(value: unknown): UiScale {
  const asNumber = typeof value === 'string' ? Number(value) : value
  const known = UI_SCALES.find((scale) => scale === asNumber)
  return known ?? DEFAULT_UI_SCALE
}

/**
 * `zoom` rather than `transform: scale()`: only `zoom` re-runs layout, so the
 * page reflows into its narrower self instead of overflowing, and the sticky
 * headers on the settings and find screens keep working.
 */
export function applyUiScale(scale: UiScale): void {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.style.zoom =
    scale === DEFAULT_UI_SCALE ? '' : `${scale}%`
  // Read by the popover rules in `globals.css`, which have to undo this zoom
  // and put it back on again a level lower -- see the comment there.
  document.documentElement.style.setProperty(
    UI_SCALE_PROPERTY,
    String(scale / 100),
  )
}
