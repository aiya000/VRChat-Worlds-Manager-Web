'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      // Ensure the toasts render above popups and are clickable
      className="toaster group z-[999999] pointer-events-auto"
      toastOptions={{
        classNames: {
          // A toast is a panel with a control in it: read at the panel scale,
          // and its button drawn at the control scale like every other.
          toast:
            'ui-panel group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'ui-control group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'ui-control group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
