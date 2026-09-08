/**
 * How much larger the controls are drawn, as a percentage.
 *
 * This used to zoom the whole document, which made the world grid show fewer
 * cards the larger it got. What a headset needs is bigger things to aim at
 * and read from a distance -- the sidebar, the buttons, the dialogs -- while
 * the grid stays as dense as it is, so the scale applies to those regions and
 * not to the page. See `.ui-control` and `.ui-panel` in `globals.css`.
 */
export const UI_SCALES = [100, 125, 150, 175, 200] as const

export type UiScale = (typeof UI_SCALES)[number]

export const DEFAULT_UI_SCALE: UiScale = 100

/**
 * The scale of what is pressed -- buttons, rows, inputs -- as a multiplier.
 */
export const CONTROL_SCALE_PROPERTY = '--control-scale'

/**
 * The scale of what surrounds the controls -- a dialog's text and spacing --
 * as a multiplier. Half the growth of the controls: enough that the words
 * beside a large button are not tiny, without the box eating the screen.
 */
export const PANEL_SCALE_PROPERTY = '--panel-scale'

/** What "make this readable in a headset" means, for the one-press preset. */
export const VR_UI_SCALE: UiScale = 150

export function normalizeUiScale(value: unknown): UiScale {
  const asNumber = typeof value === 'string' ? Number(value) : value
  const known = UI_SCALES.find((scale) => scale === asNumber)
  return known ?? DEFAULT_UI_SCALE
}

export function controlScaleFor(scale: UiScale): number {
  return scale / 100
}

export function panelScaleFor(scale: UiScale): number {
  return 1 + (controlScaleFor(scale) - 1) / 2
}

/**
 * Puts the two multipliers on the document for the stylesheet to read.
 *
 * `zoom` rather than `transform: scale()` on the regions: only `zoom` re-runs
 * layout, so a row of buttons wraps into its narrower self instead of
 * overflowing, and sticky headers keep working.
 */
export function applyUiScale(scale: UiScale): void {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  // The whole-document zoom of earlier builds. Cleared rather than assumed
  // absent: a tab that stayed open across an update still carries it.
  root.style.zoom = ''
  root.style.setProperty(CONTROL_SCALE_PROPERTY, String(controlScaleFor(scale)))
  root.style.setProperty(PANEL_SCALE_PROPERTY, String(panelScaleFor(scale)))
}
