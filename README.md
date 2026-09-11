<div align="center">

# VRChat Worlds Manager Web (VRCWW)

\- **[bɯi aːɾɯ ɕiː waɾawaɾa]** \-

[![Tests](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml/badge.svg)](https://github.com/aiya000/VRC-Worlds-Manager-Web/actions/workflows/test.yml)
[![Web App](https://img.shields.io/badge/Web%20App-vrchat--worlds--manager--web.pages.dev-blue?logo=cloudflarepages)](https://vrchat-worlds-manager-web.pages.dev)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

[日本語はこちら / 日本語のREADMEはREADME_JP.mdを参照してください。](./README_JP.md)

</div>

**VRChat Worlds Manager Web (VRCWW)** is a Progressive Web App (PWA) that helps VRChat users organize, store, and explore their favorite worlds. It is based on the original [VRC Worlds Manager v2](https://github.com/Raifa21/VRC-Worlds-Manager-v2) desktop application, rewritten to run entirely in modern web browsers, mobile devices, and VR overlays.

🌐 **Live Web App**: [https://vrchat-worlds-manager-web.pages.dev](https://vrchat-worlds-manager-web.pages.dev)

---

## At a Glance

- Keeps your favourite worlds, beyond VRChat's own slots
- Sorts them into folders (one world can be in several)
- Finds anything you have saved by name, author, tag, or folder
- Searches VRChat's public worlds, and files what you find
- Makes an instance from inside the app, and the invite takes you there
- Runs on PC, phones, and VR overlays -- installable as a PWA
- Keeps your data in your own browser

See [Features](#features) for the detail.

---

## Screenshots

### In VR, without taking the headset off

This is what the app is for. The collection is a window inside the headset -- here through SteamVR's
own overlay -- so the folders stay readable while you are in a world, and the next world is entered
from where you already are.

|                                                                                 |                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![The panel resting in the world](docs/screenshots/vr-1-panel-in-the-world.jpg) | ![Folders and worlds](docs/screenshots/vr-2-folders-and-worlds.jpg)       |
| **1.** The panel, resting in the world                                          | **2.** Close enough to read: folders down the side, worlds across         |
| ![Choosing the instance](docs/screenshots/vr-3-choosing-the-instance.jpg)       | ![The invite appears in VRChat](docs/screenshots/vr-4-invite-appears.jpg) |
| **3.** A world's folders, and the instance made from it                         | **4.** The invite arrives in VRChat's own notifications                   |
| ![Traveling to the world](docs/screenshots/vr-5-traveling.jpg)                  | ![Arrived in the world](docs/screenshots/vr-6-arrived.jpg)                |
| **5.** Accepting it travels there                                               | **6.** Arrived, without the headset having come off                       |

### Beside VRChat on a desktop

VRChat in one window and the app in another, so your worlds stay in reach without leaving the one
you are in.

Picking a world makes the instance and sends you an invite of your own, and VRChat's notification is
what takes you there -- the same way the official website's "launch world" works.

|                                                                           |                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![The app beside VRChat](docs/screenshots/pc-1-app-beside-vrchat.jpg)     | ![Choosing the instance](docs/screenshots/pc-2-choosing-the-instance.jpg) |
| **1.** In a world, with the app beside it                                 | **2.** Pick who it is for and where it runs, and the invite is sent       |
| ![The invite appears in VRChat](docs/screenshots/pc-3-invite-appears.jpg) | ![Traveling to the world](docs/screenshots/pc-4-traveling.jpg)            |
| **3.** VRChat says the invite has arrived                                 | **4.** Accepting it travels there                                         |
| ![Connecting](docs/screenshots/pc-5-connecting.jpg)                       | ![Arrived in the world](docs/screenshots/pc-6-arrived.jpg)                |
| **5.** Connecting                                                         | **6.** Arrived, with the app still beside it                              |

### Alongside VRChat on Android

Floated over the game in the device's own floating window, the app stays reachable without leaving
the world you are in -- what the feature is called varies by device; on a Galaxy it is "pop-up view"
(ポップアップ表示).

Picking a world sends you an invite of your own, and the world is entered from VRChat's own
notification. No link opens the Android app straight into an instance, so this is the way in.

|                                                                                   |                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ![The app resting as a bubble](docs/screenshots/android-1-bubble-over-vrchat.jpg) | ![The app open over VRChat](docs/screenshots/android-2-app-open-over-vrchat.jpg)           |
| **1.** In a world, with the app resting in the corner                             | **2.** Opened, your worlds are there, over the game                                        |
| ![Choosing the instance](docs/screenshots/android-3-choosing-the-instance.jpg)    | ![The invite has been sent](docs/screenshots/android-4-invite-sent.jpg)                    |
| **3.** Pick who it is for, and where it runs                                      | **4.** The instance is made, and you are invited to it                                     |
| ![The invite appears in VRChat](docs/screenshots/android-5-invite-appears.jpg)    | ![The invite in the notifications](docs/screenshots/android-6-invite-in-notifications.jpg) |
| **5.** VRChat says the invite has arrived                                         | **6.** It is waiting in the notifications                                                  |
| ![Traveling to the world](docs/screenshots/android-7-traveling.jpg)               | ![Arrived in the world](docs/screenshots/android-8-arrived.jpg)                            |
| **7.** Accepting it travels there                                                 | **8.** Arrived, with the app still in the corner                                           |

---

## Features

- **Web & PWA Ready (VR-First / Responsive Layout)**
  - Runs in any modern web browser on PC, smartphones, and VR overlays (XSOverlay, SteamVR browser, Quest browser, etc.).
  - Responsive layout with a collapsible sidebar and touch/laser-friendly controls.
  - Can be installed to your home screen or desktop as a Progressive Web App (PWA).
  - Usable as a desktop application, just as the original VRC Worlds Manager v2 is.
  - **(Under Google review)** ~~What you edit on the desktop -- adding favourites, sorting them into folders -- syncs to your phone and your other PCs. The same data everywhere, with no export or import step.~~

- **Add & Preserve Favourite Worlds**
  - Automatically fetch worlds marked as Favourites in VRChat via the API and store them in the app.
  - Saved worlds remain preserved even if removed from your VRChat Favourites list or if your slots are full.
  - Add worlds directly using URL links.

- **Organize Worlds into Folders & Customize Views**
  - Organize saved worlds into folders (a single world can belong to multiple folders).
  - Customize world card display with per-field visibility toggles.
  - Attach personal notes and memos to each world.

- **Multi-Account Support & Management Tools**
  - Import favourite worlds from another VRChat account into your folders.
  - Purge all VRChat favorites from an account in one click.

- **Search & Discover**
  - Fast local search by world name, author, tags, and folders.
  - View recently visited worlds.
  - Search public VRChat worlds using tags, text queries, and exclusion filters.

- **Create Instances**
  - Launch instances directly from the app (including group instances). An invite arrives in your running VRChat client, as it does from the official VRChat website.

- **~~Share Folders~~** **(Being fixed)**
  - ~~Share folders via public links (generating a UUID valid for 30 days).~~
  - ~~Shared folders can be viewed directly on the web.~~

- **Client-Side Privacy**
  - World data and your login session are stored locally in your browser's IndexedDB (Dexie.js).
  - Secure Cloudflare Worker CORS proxy handles communication with the VRChat API.

---

## Known Issues

- **On Android, pressing back right after launch closes the app without the "press back again" warning.** This is how Chrome works, not a bug in the app: Chrome's back gesture skips any history entry a page added before you have touched it, so there is nothing the app can put in the way until your first tap. Once you have tapped anything, back asks twice as intended. The same rule applies after the warning itself: if you do not touch the app again, the next press leaves, and a tap puts the warning back.

---

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + Shadcn/UI
- **Service Layer**: Effect-TS
- **Data Storage**: IndexedDB (Dexie.js) + localStorage
- **API Proxy**: Cloudflare Worker (CORS proxy with 2FA, session header relay, and rate limiting)
- **Package Manager**: Bun
- **Deployment**: Cloudflare Pages (Static Export) & Cloudflare Workers

---

## Contributing

Contributions are welcome!

[CONTRIBUTING.md](CONTRIBUTING.md) has the guidelines and everything needed to run this locally -- the prerequisites, the commands, and how the project is built.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

No part of the current release is under a licence other than MIT. [LICENSE_ADDITIONAL](LICENSE_ADDITIONAL) records the components that once were.

---

## Credits

- Original application: [VRC Worlds Manager v2](https://github.com/Raifa21/VRC-Worlds-Manager-v2) by Raifa and siloneco
- Special thanks to VRChat and the VRChat API Community for providing API documentation.
- The former sidebar icons were provided by 黒音キト under CC-BY-NC-4.0. They are no longer in use; the credit is kept here as a special thanks.
- The former application icon used Ciel-chan, with ArmoireLepus's permission. It is no longer in use; the credit is kept here as a special thanks.
- Thank you all.
