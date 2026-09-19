'use client'

import { useTheme } from 'next-themes'
import type { MouseEvent } from 'react'
import { Toaster as Sonner, toast } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Whether a click landed on something inside a toast that has its own job:
 * an action or cancel button, the close button, a link.
 */
function isOnAControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, [role="button"]') !== null
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  /**
   * A tap anywhere on a toast dismisses it (#211).
   *
   * Sonner's own way out is a swipe, and a swipe is the wrong gesture here
   * twice over: on a phone it is the same movement that opens the sidebar,
   * and in VR a laser has no reliable drag. A tap is the one gesture both
   * can count on. Sonner has no option for it, so the click is caught on the
   * way through and every toast is dismissed -- the one tapped is at the
   * front of whatever pile there is, and clearing the pile is what a tap on
   * it means. A press on a button inside a toast is that button's, not this.
   */
  const dismissOnTap = (event: MouseEvent<HTMLDivElement>) => {
    if (isOnAControl(event.target)) {
      return
    }
    if (
      event.target instanceof Element &&
      event.target.closest('[data-sonner-toast]') !== null
    ) {
      toast.dismiss()
    }
  }

  return (
    <div className="contents" onClick={dismissOnTap}>
      <Sonner
        theme={theme as ToasterProps['theme']}
        // Ensure the toasts render above popups and are clickable
        className="toaster group z-[999999] pointer-events-auto"
        // Vertical only: a horizontal swipe is the sidebar's gesture on a
        // phone, and a toast that also answered it made the two fight.
        swipeDirections={['top', 'bottom']}
        toastOptions={{
          classNames: {
            // A toast is a panel with a control in it: read at the panel scale,
            // and its button drawn at the control scale like every other.
            toast:
              'ui-panel group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg cursor-pointer',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton:
              'ui-control group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton:
              'ui-control group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
        {...props}
      />
    </div>
  )
}

export { Toaster }
