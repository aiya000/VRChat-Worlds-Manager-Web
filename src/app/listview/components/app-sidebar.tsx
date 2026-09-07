'use client'

import { SaturnIcon } from '../../../components/icons/saturn-icon'
import { GearIcon } from '../../../components/icons/gear-icon'
import { Info, FileQuestion, History, Plus, ArrowUpDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useLocalization } from '@/hooks/use-localization'

import { Separator } from '@/components/ui/separator'

import { Sidebar, SidebarGroup, useSidebar } from '@/components/ui/sidebar'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useFolders } from '@/app/listview/hook/use-folders'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { usePopupStore } from '../hook/usePopups/store'

const sidebarStyles = {
  container:
    'flex flex-col h-full w-full overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  header: 'flex min-h-14 shrink-0 items-center px-4',
  // `min-h-0` lets this shrink below its content so the folder list inside can
  // own the leftover space and scroll; `overflow-y-auto` is the fallback for a
  // viewport too short even for the list's minimum height.
  nav: 'flex min-h-0 flex-1 flex-col space-y-0.5 overflow-y-auto p-1 pb-0',
  link: 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent/50 hover:text-accent-foreground',
  activeLink: 'bg-accent/60 text-accent-foreground',
  footer: 'sticky bottom-0 left-0 mt-auto p-1 pb-2',
}

const SIDEBAR_CLASS = 'app-sidebar'

export function AppSidebar() {
  const { t } = useLocalization()
  const { folders, createFolder: _createFolder, renameFolder } = useFolders()
  const setPopup = usePopupStore((state) => state.setPopup)

  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()

  // On a phone the sidebar is a drawer covering the page, so it has to get out
  // of the way once it has been used to go somewhere.
  const navigate = (path: string) => {
    if (isMobile) {
      setOpenMobile(false)
    }
    if (pathname === path) {
      return
    }
    router.push(path)
  }
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleRename = async (folder: string) => {
    const oldName = folder
    const newName = newFolderName
    renameFolder(oldName, newName).then(() => {
      setEditingFolder(null)
      setNewFolderName('')
      // If currently viewing this user folder, update the URL so the page title reflects the rename
      const currentFolder = searchParams?.get('folderName')
      if (
        pathname === '/listview/folders/userFolder' &&
        currentFolder === oldName
      ) {
        router.replace(
          `/listview/folders/userFolder?folderName=${encodeURIComponent(newName)}`,
        )
      }
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F8 key handler - prevent focus loss and text selection
      if (e.key === 'F8' && document.activeElement === inputRef.current) {
        // Save current text length to restore cursor position later
        const textLength = inputRef.current?.value.length || 0

        // Schedule focus restoration after the F8 key event completes
        setTimeout(() => {
          if (inputRef.current) {
            // Restore focus
            inputRef.current.focus()

            // Place cursor at the end of text without selection
            inputRef.current.setSelectionRange(textLength, textLength)
          }
        }, 10)
      }
    }

    // Add global key listener
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Increase the timeout for focusing when editing starts
  useEffect(() => {
    if (editingFolder) {
      // Use a longer timeout to ensure all other events have been processed
      const focusTimer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          // Optionally select all text for convenience
          inputRef.current.select()
        }
      }, 50) // Increased from 10ms to 50ms

      // Clean up timer on component unmount or when editingFolder changes
      return () => clearTimeout(focusTimer)
    }
  }, [editingFolder])

  // Improve the click outside handler to be more precise
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Skip if no active editing or during composition
      if (!editingFolder || isComposing) {
        return
      }

      // Get the clicked element
      const target = event.target as HTMLElement

      // Check if click is inside the input or its parent container
      if (
        inputRef.current &&
        (inputRef.current === target ||
          inputRef.current.contains(target) ||
          target.closest('.folder-edit-container'))
      ) {
        // Add this class to your container
        return
      }

      // If we click anywhere else, cancel editing
      setEditingFolder(null)
      setNewFolderName('')
    }

    // Use mousedown instead of click for better timing
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingFolder, isComposing]) // Add isComposing to deps

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-border/40 bg-transparent"
    >
      <aside className={cn(sidebarStyles.container, SIDEBAR_CLASS)}>
        <header className={sidebarStyles.header}>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <h2 className="text-base font-semibold">VRChat Worlds Manager</h2>
            <h3 className="text-sm text-muted-foreground">Web</h3>
          </div>
        </header>
        <Separator className="" />

        <nav className={sidebarStyles.nav}>
          <SidebarGroup>
            <div
              className={`
              px-3 py-2 text-sm font-medium rounded-lg cursor-pointer
              overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
              ${pathname === '/listview/folders/special/all' ? sidebarStyles.activeLink : 'hover:bg-accent/50 hover:text-accent-foreground'}
            `}
              onClick={() => {
                navigate('/listview/folders/special/all')
              }}
            >
              <SaturnIcon className="h-[18px] w-[18px]" />
              <span className="text-sm font-medium">
                {t('general:all-worlds')}
              </span>
            </div>
          </SidebarGroup>
          <Separator className="my-2" />
          <SidebarGroup>
            <div
              className={`
              px-3 py-2 text-sm font-medium rounded-lg cursor-pointer
              overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
              ${pathname === '/listview/folders/special/find' ? sidebarStyles.activeLink : 'hover:bg-accent/50 hover:text-accent-foreground'}
            `}
              onClick={() => {
                navigate('/listview/folders/special/find')
              }}
            >
              <History className="h-5 w-5" />
              <span className="text-sm font-medium">
                {t('general:find-worlds')}
              </span>
            </div>

            <div
              className={`
              px-3 py-2 text-sm font-medium rounded-lg cursor-pointer
              overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
              ${
                pathname === '/listview/folders/special/unclassified'
                  ? sidebarStyles.activeLink
                  : 'hover:bg-accent/50 hover:text-accent-foreground'
              }
            `}
              onClick={() => {
                navigate('/listview/folders/special/unclassified')
              }}
            >
              <FileQuestion className="h-5 w-5" />
              <span className="text-sm font-medium">
                {t('general:unclassified-worlds')}
              </span>
            </div>
          </SidebarGroup>
          <Separator className="my-2" />
          <SidebarGroup className="min-h-0 flex-1">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground">
              <span className="text-sm font-medium">
                {t('general:folders')}
              </span>
              {folders.length > 1 && (
                <button
                  type="button"
                  title={t('app-sidebar:reorder-folders')}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                  onClick={() => navigate('/listview/folders/reorder')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="sr-only">
                    {t('app-sidebar:reorder-folders')}
                  </span>
                </button>
              )}
            </div>
            <div
              data-folder-list
              className="min-h-24 flex-1 overflow-x-clip overflow-y-auto no-webview-scroll-bar pl-8"
            >
              {folders.map((folder) => (
                <ContextMenu key={folder.name}>
                  <ContextMenuTrigger>
                    <div
                      className={`
                                w-full px-3 py-2 text-sm font-medium rounded-lg cursor-pointer
                                overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
                                ${
                                  pathname ===
                                  `/listview/folders/userFolder?folderName=${folder.name}`
                                    ? sidebarStyles.activeLink
                                    : 'hover:bg-accent/50 hover:text-accent-foreground'
                                }
                              `}
                      onClick={() => {
                        navigate(
                          `/listview/folders/userFolder?folderName=${folder.name}`,
                        )
                      }}
                    >
                      {editingFolder === folder.name ? (
                        <Input
                          ref={inputRef}
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onFocus={() => {
                            // Clear any pending blur actions
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current)
                              blurTimeoutRef.current = null
                            }
                          }}
                          onKeyDown={(e) => {
                            // Prevent event bubbling when typing
                            e.stopPropagation()

                            if (e.key === 'Enter' && !composingRef.current) {
                              e.preventDefault()
                              handleRename(folder.name)
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              setEditingFolder(null)
                              setNewFolderName('')
                            }
                          }}
                          onClick={(e) => {
                            // Prevent click from bubbling to parent
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onCompositionStart={() => {
                            composingRef.current = true
                            setIsComposing(true)
                          }}
                          onCompositionEnd={() => {
                            composingRef.current = false

                            // Use a longer timeout for IME operations
                            setTimeout(() => {
                              if (inputRef.current) {
                                const textLength = inputRef.current.value.length
                                inputRef.current.focus()
                                inputRef.current.setSelectionRange(
                                  textLength,
                                  textLength,
                                )
                              }
                              setIsComposing(false)
                            }, 150)
                          }}
                          className="h-6 py-0 w-full folder-edit-container" // Ensure no horizontal overflow
                          autoFocus={true}
                        />
                      ) : (
                        <span className="flex items-center w-full">
                          <span className="font-mono text-xs text-muted-foreground w-10 text-left flex-shrink-0">
                            ({folder.world_count})
                          </span>
                          <span className="truncate flex-1 pl-1 cursor-default">
                            {folder.name}
                          </span>
                        </span>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        // First set the editing state
                        setEditingFolder(folder.name)
                        setNewFolderName(folder.name)
                        // Use double RAF to ensure DOM has updated and context menu has closed
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            inputRef.current?.focus()
                            inputRef.current?.select() // Also select the text for convenience
                          })
                        })
                      }}
                    >
                      {t('app-sidebar:rename')}
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive"
                      onClick={() => setPopup('showDeleteFolder', folder.name)}
                    >
                      {t('general:delete')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
            <Separator className="my-2" />
            <div
              className={`${sidebarStyles.link} cursor-pointer`}
              onClick={() => {
                setPopup('showCreateFolder', true)
              }}
            >
              <Plus className="h-5 w-5" />
              {t('app-sidebar:add-folder')}
            </div>
          </SidebarGroup>
        </nav>
        <Separator />
        <footer className={sidebarStyles.footer}>
          <SidebarGroup>
            <div
              className={`
              px-3 py-2 cursor-pointer text-sm font-medium rounded-lg overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
              ${
                pathname === `/listview/about`
                  ? sidebarStyles.activeLink
                  : 'hover:bg-accent/50 hover:text-accent-foreground'
              }
            `}
              onClick={() => {
                navigate('/listview/about')
              }}
            >
              <Info className="h-5 w-5" />
              <span>{t('app-sidebar:about')}</span>
            </div>
            <div
              className={`
              px-3 py-2 cursor-pointer text-sm font-medium rounded-lg overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-3
              ${
                pathname === `/listview/settings`
                  ? sidebarStyles.activeLink
                  : 'hover:bg-accent/50 hover:text-accent-foreground'
              }
            `}
              onClick={() => {
                navigate('/listview/settings')
              }}
            >
              <div className="h-5 w-5 flex items-center justify-center">
                <GearIcon className="h-[18px] w-[18px]" />
              </div>
              <span>{t('general:settings')}</span>
            </div>
            {/* Quieter than the entries above it, but deliberately here rather
                than only on the About page: a privacy policy that takes
                looking for reads as one someone would rather you did not find.
                The text is small; the row is not, so a VR laser can still hit
                it. */}
            <div
              className={`
              mt-3 px-3 py-2 cursor-pointer text-xs rounded-lg overflow-hidden text-ellipsis whitespace-nowrap
              ${
                pathname === `/privacy`
                  ? sidebarStyles.activeLink
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              }
            `}
              onClick={() => {
                navigate('/privacy')
              }}
            >
              {t('privacy-policy:link-label')}
            </div>
          </SidebarGroup>
        </footer>
      </aside>
    </Sidebar>
  )
}
