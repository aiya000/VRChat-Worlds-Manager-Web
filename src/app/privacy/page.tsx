'use client'

import { useLocalization } from '@/hooks/use-localization'
import {
  LegalBullets,
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/components/legal-page'

export default function PrivacyPolicyPage() {
  const { t } = useLocalization()

  return (
    <LegalPage
      title={t('privacy-policy:title')}
      lastUpdated={t('privacy-policy:last-updated')}
      backLabel={t('privacy-policy:back')}
      intro={t('privacy-policy:intro')}
    >
      <LegalSection title={t('privacy-policy:local-data-title')}>
        <p>{t('privacy-policy:local-data-body')}</p>
        <LegalBullets
          items={[
            t('privacy-policy:local-data-item-worlds'),
            t('privacy-policy:local-data-item-settings'),
            t('privacy-policy:local-data-item-credentials'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('privacy-policy:vrchat-title')}>
        <p>{t('privacy-policy:vrchat-body')}</p>
        <LegalBullets
          items={[
            t('privacy-policy:vrchat-item-relay'),
            t('privacy-policy:vrchat-item-no-store'),
            t('privacy-policy:vrchat-item-ip'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('privacy-policy:google-drive-title')}>
        <p>{t('privacy-policy:google-drive-body')}</p>
        <LegalBullets
          items={[
            t('privacy-policy:google-drive-item-scope'),
            t('privacy-policy:google-drive-item-location'),
            t('privacy-policy:google-drive-item-token'),
            t('privacy-policy:google-drive-item-never'),
          ]}
        />
      </LegalSection>

      <LegalSection title={t('privacy-policy:analytics-title')}>
        <p>{t('privacy-policy:analytics-body')}</p>
      </LegalSection>

      <LegalSection title={t('privacy-policy:third-party-title')}>
        <p>{t('privacy-policy:third-party-body')}</p>
      </LegalSection>

      <LegalSection title={t('privacy-policy:deletion-title')}>
        <LegalBullets
          items={[
            t('privacy-policy:deletion-item-local'),
            t('privacy-policy:deletion-item-drive'),
          ]}
        />
        <p>
          {t('privacy-policy:deletion-item-revoke')}{' '}
          <LegalLink href="https://myaccount.google.com/permissions" />
        </p>
      </LegalSection>

      <LegalSection title={t('privacy-policy:contact-title')}>
        <p>{t('privacy-policy:contact-body')}</p>
        <p>
          <LegalLink href="https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues" />
        </p>
      </LegalSection>
    </LegalPage>
  )
}
