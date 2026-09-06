'use client'

import type { FC } from 'react'
import { Switch } from '@/components/ui/switch'
import type { SyncableSettingKey } from '@/lib/sync/settings'

type Props = {
  settingKey: SyncableSettingKey
  label: string
  description: string
  checked: boolean
  onCheckedChange: (deviceOnly: boolean) => void
}

/**
 * "Only on this device" for one setting.
 *
 * The whole row is the hit target, not just the switch: this is aimed at with a
 * VR controller's laser as often as with a mouse, and a 20px control is not
 * something a laser can reliably land on.
 */
export const DeviceOnlySettingToggle: FC<Props> = ({
  settingKey,
  label,
  description,
  checked,
  onCheckedChange,
}) => {
  const id = `device-only-${settingKey}`

  return (
    <div className="w-full border-t pt-3">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-row items-center justify-between gap-4 rounded-md p-2 hover:bg-accent/50"
      >
        <div className="flex flex-col space-y-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={label}
        />
      </label>
    </div>
  )
}
