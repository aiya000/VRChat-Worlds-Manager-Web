# Nearly every E2E spec fails after a Next.js upgrade: the dev server refuses `127.0.0.1`

Seen when Next.js went from 16.1 to 16.4. Almost the whole suite failed at once: `locator.click`
timing out after 30 seconds, and `getByRole` finding nothing for the Japanese labels. The pages
had rendered -- the error context showed them in **English** -- so it did not look like a dead
server, and the browser itself reported `navigator.languages` as `["ja-JP"]`.

The page had never hydrated. `playwright.config.ts` reaches the dev server as
`http://127.0.0.1:3456`, which Next counts as a different origin from `localhost`, and from 16.4
it blocks dev resources to other origins instead of only warning. The run's log says so, once,
among everything else:

```
[WebServer] ⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1".
```

With the client never running, nothing switches the language from the server's default and no
button answers a click.

## The fix

`allowedDevOrigins: ['127.0.0.1']` in `next.config.ts`. It only affects `next dev`; the static
export does not read it.

## A spec that serves the dev server under another hostname

The same version also **does not hydrate until the HMR WebSocket has delivered its first
messages**, and `page.route()` does not see WebSockets. A spec that answers `page.route()` for a
foreign hostname (the pages.dev specs) therefore gets a page that never hydrates even with the
hostname in `allowedDevOrigins`. `drive-sync-origin-notice.spec.ts` relays the socket to the local
dev server with `page.routeWebSocket()`; binary frames have to be passed on as a `Buffer`, or the
client cannot read them.

Two signals that mislead while checking this: `<html lang>` stays `en` even after hydration, so
it says nothing; a `__reactFiber` key on a rendered element does.

## Telling it apart from a stuck dev server

[e2e-dev-server-stuck.md](./e2e-dev-server-stuck.md) also fails nearly everything, but there the
pages never arrive (`page.goto` times out or is aborted). Here the pages arrive and are only
lifeless: an English page under `locale: 'ja-JP'` is the sign.
