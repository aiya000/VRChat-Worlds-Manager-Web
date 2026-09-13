import { SiDiscord, SiGithub } from '@icons-pack/react-simple-icons'
import { useLocalization } from '@/hooks/use-localization'

export const CONTACT_ISSUES_URL =
  'https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues/new'
export const CONTACT_DISCORD_URL = 'https://discord.gg/g5nq5GuGPJ'

/**
 * The two ways to reach the author, offered together wherever one of them was
 * offered alone.
 *
 * Opening an issue asks for a GitHub account, which plenty of people who use
 * VRChat do not have and have no reason to make; a Discord invite asks for the
 * account most of them are already signed in to. Neither replaces the other --
 * a bug report is worth keeping on the tracker -- so both are shown, in that
 * order.
 */
export function ContactLinks() {
  const { t } = useLocalization()

  return (
    <>
      <a
        href={CONTACT_ISSUES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-blue-500 hover:underline"
      >
        <SiGithub className="h-4 w-4" />
        {t('general:github-issues')}
      </a>
      {t('general:contact-or')}
      <a
        href={CONTACT_DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-blue-500 hover:underline"
      >
        <SiDiscord className="h-4 w-4" />
        {t('general:discord')}
      </a>
    </>
  )
}
