/**
 * Writes the getting-started PDFs handed out on BOOTH (#162) from
 * `booth/guide.<lang>.md` into `booth/dist/`.
 *
 * The Markdown holds only what will not go stale -- the outline and the link
 * to `/guide` -- because a PDF someone already downloaded can never be
 * corrected. Everything that changes with the browsers lives on that page.
 *
 * Rendered by the Chromium Playwright already installs for the e2e tests, so
 * the PDF is what a browser prints, Japanese included. The font comes from
 * Google Fonts rather than from whatever this machine has installed, so two
 * machines produce the same file.
 */
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { marked } from 'marked'

const ROOT = path.resolve(import.meta.dirname, '..')
const BOOTH = path.join(ROOT, 'booth')
const DIST = path.join(BOOTH, 'dist')
const ICON = path.join(ROOT, 'public', 'icons', 'icon-384.webp')

const LANGUAGES = ['ja', 'en'] as const

const STYLE = `
  @page { size: A4; margin: 20mm 18mm; }
  body {
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #1f2937;
  }
  .icon { display: block; width: 96px; height: 96px; margin: 0 auto 8px; }
  h1 { font-size: 20pt; text-align: center; margin: 0 0 16px; }
  h2 {
    font-size: 14pt;
    margin: 28px 0 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #e5e7eb;
  }
  ol { padding-left: 1.5em; }
  li { margin: 4px 0; }
  .url { font-size: 24pt; font-weight: 700; text-align: center; margin: 20px 0; }
  a { color: #2563eb; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 12px; }
  hr + p { font-size: 9pt; color: #6b7280; }
`

const toHtml = (
  lang: string,
  body: string,
  iconDataUrl: string,
) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block">
<style>${STYLE}</style>
</head>
<body>
<img class="icon" src="${iconDataUrl}" alt="">
${body}
</body>
</html>`

const main = async () => {
  await mkdir(DIST, { recursive: true })
  const icon = await readFile(ICON)
  const iconDataUrl = `data:image/webp;base64,${icon.toString('base64')}`

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    for (const lang of LANGUAGES) {
      const markdown = await readFile(
        path.join(BOOTH, `guide.${lang}.md`),
        'utf8',
      )
      // A line break in Japanese is not a space, which is what Markdown makes
      // of it. Kept as a break, the PDF also wraps where the source does.
      const body = await marked.parse(markdown, { breaks: true })
      await page.setContent(toHtml(lang, body, iconDataUrl), {
        waitUntil: 'networkidle',
      })
      await page.evaluate(() => document.fonts.ready)

      const out = path.join(DIST, `vrcww-guide-${lang}.pdf`)
      await page.pdf({
        path: out,
        printBackground: true,
        preferCSSPageSize: true,
      })
      console.log(`wrote ${path.relative(ROOT, out)}`)
    }
  } finally {
    await browser.close()
  }
}

await main()
