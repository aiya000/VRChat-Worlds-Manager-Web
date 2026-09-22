'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { commands } from '@/lib/commands'
import {
  BOT_CHECK_FAILED_ERROR,
  INVALID_TWO_FACTOR_CODE_ERROR,
} from '@/lib/services/vrchat-api'
import { useLocalization } from '@/hooks/use-localization'
import { rememberTermsAccepted } from '@/lib/terms'
import { Loader2 } from 'lucide-react'
export default function Login() {
  const router = useRouter()
  const { t } = useLocalization()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [e, setE] = useState<string | null>(null)
  const [twoFactorCodeType, setTwoFactorCodeType] = useState('emailOtp')
  const [show2FA, setShow2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loading2FA, setLoading2FA] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setE(null)
    try {
      const result = await commands.loginWithCredentials(username, password)

      if (result.status === 'error') {
        if (result.error === '2fa-required') {
          console.info('2FA required, showing 2FA dialog')
          setShow2FA(true)
          setE(null)
          setTwoFactorCodeType('totp')
        } else if (result.error === 'email-2fa-required') {
          console.info('Email 2FA required, showing 2FA dialog')
          setShow2FA(true)
          setE(null)
          setTwoFactorCodeType('emailOtp')
        } else {
          const errorMessage =
            result.error === BOT_CHECK_FAILED_ERROR
              ? t('login-page:error-bot-check')
              : result.error || t('login-page:error-invalid-credentials')
          console.error(`Login failed: ${errorMessage}`)
          setE(errorMessage)
        }
        return
      }

      console.info('Login successful, redirecting to listview')
      rememberTermsAccepted()
      router.push('/listview/folders/special/all')
    } finally {
      setLoading(false)
    }
  }

  const handle2FA = async () => {
    setLoading2FA(true)
    setE(null)
    try {
      const result = await commands.loginWith2fa(
        twoFactorCode,
        twoFactorCodeType,
      )

      if (result.status === 'error') {
        console.error(`2FA verification failed: ${result.error}`)
        // A rejected code is the ordinary case here, and the raw API text is
        // not something to put in front of the person typing it.
        setE(
          result.error === INVALID_TWO_FACTOR_CODE_ERROR
            ? t('login-page:error-invalid-2fa')
            : result.error === BOT_CHECK_FAILED_ERROR
              ? t('login-page:error-bot-check')
              : result.error || t('login-page:error-invalid-2fa'),
        )
        return
      }
      console.info('2FA verification successful, redirecting to listview')
      rememberTermsAccepted()
      router.push('/listview/folders/special/all')
    } catch (e) {
      const errorMessage = (e as string) || t('login-page:error-invalid-2fa')
      console.error(`2FA error: ${errorMessage}`)
      setE(errorMessage)
    } finally {
      setLoading2FA(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-4">
        {/* This is not vrchat.com, and the person about to type a VRChat
            password has to be told so before the fields rather than under
            them. Google Safe Browsing read the earlier layout -- a "Login to
            VRChat" heading sitting over credential fields on a domain that is
            not VRChat's -- as a phishing page, and blocked the site. Who runs
            this site and what becomes of the credentials are the same
            question, so both answers are read in one place. */}
        <div className="space-y-2 rounded-md border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-center text-sm font-bold">
            {t('login-page:unofficial-title')}
          </p>
          <p className="text-center text-xs">
            {t('login-page:unofficial-text')}
          </p>
          <p className="text-center text-xs">
            <span className="font-bold">{t('login-page:notice-title')}</span>{' '}
            {t('login-page:notice-text')}
          </p>
        </div>
        <h2 className="text-2xl font-bold text-center">
          {t('login-page:title')}
        </h2>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder={t('login-page:username-placeholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const passwordInput = document.querySelector(
                  'input[type="password"]',
                ) as HTMLInputElement
                passwordInput?.focus()
              }
            }}
          />
          <Input
            type="password"
            placeholder={t('login-page:password-placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleLogin()
              }
            }}
            // // パスワードが正しくてもペースト時はログインに失敗するためコメントアウト
            // // ペーストした結果が setPassword されるよりも先にログイン試行が走るため？
            // onPaste={handleLogin}
          />
          {e && <p className="text-red-500 text-sm text-center">{e}</p>}
          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={!username || !password || loading}
          >
            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              t('login-page:login-button')
            )}
          </Button>

          {/* Signing in is the act that agrees, so the sentence saying so
              stays beside the button rather than moving up with the rest. */}
          <p className="text-xs text-center text-muted-foreground">
            {t('login-page:terms-text')}
          </p>

          {/* Signing in is what agrees to the terms, and this is the screen
              where a VRChat password gets typed, so both documents are one
              tap away from the button that does it. */}
          <p className="flex justify-center gap-4 text-center">
            <Link
              href="/terms"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t('terms:link-label')}
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t('privacy-policy:link-label')}
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={show2FA} onOpenChange={setShow2FA}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('login-page:2fa-title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder={t('login-page:2fa-placeholder')}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handle2FA()
                }
              }}
            />
            {e && <p className="text-red-500 text-sm text-center">{e}</p>}
            <Button
              className="w-full"
              onClick={handle2FA}
              disabled={!twoFactorCode || loading2FA}
            >
              {loading2FA ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                t('login-page:2fa-button')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
