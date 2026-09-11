'use client'

import { useLocalization } from '@/hooks/use-localization'
import {
  LegalBullets,
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/components/legal-page'

const ISSUES_URL = 'https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues'

export default function TermsOfUsePage() {
  const { t } = useLocalization()

  return (
    <LegalPage
      title={t('terms:title')}
      lastUpdated={t('terms:last-updated')}
      backLabel={t('terms:back')}
      intro={t('terms:intro')}
    >
      <LegalSection title={t('terms:app-title')}>
        <LegalBullets
          items={[
            t('terms:app-item-free'),
            t('terms:app-item-oss'),
            t('terms:app-item-change'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('terms:vrchat-title')}>
        <LegalBullets
          items={[
            t('terms:vrchat-item-unofficial'),
            t('terms:vrchat-item-api'),
            t('terms:vrchat-item-rules'),
          ]}
        />
        <p>{t('terms:vrchat-links-lead')}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <LegalLink href="https://hello.vrchat.com/legal" />
          </li>
          <li>
            <LegalLink href="https://hello.vrchat.com/community-guidelines" />
          </li>
          <li>
            <LegalLink href="https://hello.vrchat.com/creator-guidelines" />
          </li>
        </ul>
      </LegalSection>

      <LegalSection title={t('terms:account-title')}>
        <LegalBullets
          items={[t('terms:account-item-own'), t('terms:account-item-manage')]}
        />
      </LegalSection>

      <LegalSection title={t('terms:prohibited-title')}>
        <p>{t('terms:prohibited-body')}</p>
        <LegalBullets
          items={[
            t('terms:prohibited-item-others'),
            t('terms:prohibited-item-load'),
            t('terms:prohibited-item-relay'),
            t('terms:prohibited-item-law'),
            t('terms:prohibited-item-disrupt'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('terms:disclaimer-title')}>
        <LegalBullets
          items={[
            t('terms:disclaimer-item-asis'),
            t('terms:disclaimer-item-ban'),
            t('terms:disclaimer-item-direct'),
            t('terms:disclaimer-item-damages'),
            t('terms:disclaimer-item-third-party'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('terms:data-title')}>
        <LegalBullets
          items={[t('terms:data-item-local'), t('terms:data-item-drive')]}
        />
      </LegalSection>

      <LegalSection title={t('terms:ip-title')}>
        <LegalBullets
          items={[t('terms:ip-item-worlds'), t('terms:ip-item-app')]}
        />
      </LegalSection>

      <LegalSection title={t('terms:changes-title')}>
        <LegalBullets
          items={[
            t('terms:changes-item-effective'),
            t('terms:changes-item-notice'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('terms:law-title')}>
        <p>{t('terms:law-body')}</p>
      </LegalSection>

      <LegalSection title={t('terms:contact-title')}>
        <p>{t('terms:contact-body')}</p>
        <p>
          <LegalLink href={ISSUES_URL} />
        </p>
      </LegalSection>
    </LegalPage>
  )
}
