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
import { INVALID_TWO_FACTOR_CODE_ERROR } from '@/lib/services/vrchat-api'
import { useLocalization } from '@/hooks/use-localization'
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
            result.error || t('login-page:error-invalid-credentials')
          console.error(`Login failed: ${errorMessage}`)
          setE(errorMessage)
        }
        return
      }

      console.info('Login successful, redirecting to listview')
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
            : result.error || t('login-page:error-invalid-2fa'),
        )
        return
      }
      console.info('2FA verification successful, redirecting to listview')
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

          <div className="mt-4 p-4 border-2 border-red-500 rounded-md">
            <p className="text-sm text-center">
              <span className="font-bold">{t('login-page:notice-title')}</span>{' '}
              {t('login-page:notice-text')}
            </p>
            <p className="text-xs text-center mt-2">
              {t('login-page:terms-text')}
            </p>
          </div>

          {/* This is the screen where a VRChat password gets typed, so what
              happens to it is worth being one tap away. */}
          <p className="text-center">
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
