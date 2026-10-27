# Custom home screen on a 2024 Samsung TV (Tizen 9): field notes

> **Experimental · field notes (October 2026).** Everything below was observed on **one TV**: a 2024 Samsung Crystal UHD (DU7000 series, Tizen 9.0, armv7), with Tizen Studio 6.1 on Windows 11. The app was built and tested over about a week. Treat each finding as "seen once on this setup", not as Samsung-wide behaviour. Firmware updates can change any of it.

I replaced the Smart Hub home screen on my living-room TV with my own Tizen web app (`.wgt`): favourite apps, HDMI inputs, new releases on the streaming services I pay for, genre browsing, search with an on-screen Thai/English keyboard, and a "where can I watch this" card.

Getting there cost far more time on the TV's quirks than on the app. This repo is the list of those quirks, plus the small code pieces that worked. It is **not** a ready-made launcher: the full app is personal and stays private.

## Contents

1. [Developer Mode would not open (fixed by Reset Smart Hub)](#1-developer-mode-would-not-open)
2. [Install gotchas](#2-install-gotchas)
3. [Deep-linking into a title: Prime Video, and YouTube via cast](#3-deep-linking-into-a-title-prime-video-and-youtube-via-cast)
4. [The Home key](#4-the-home-key)
5. [Making it smooth on a weak TV CPU](#5-making-it-smooth-on-a-weak-tv-cpu)
6. [Remote input: hold-OK and a custom keyboard](#6-remote-input-hold-ok-and-a-custom-keyboard)
7. [Data sources](#7-data-sources)
8. [Code in this repo](#8-code-in-this-repo)

---

## 1. Developer Mode would not open

On the 2024 UI, **Apps** is a top tab of Home (`For You | Live | Apps`) and its settings are at the bottom of that page. The remote has no number keys: use the `123` button or the SmartThings phone app's keypad to type `12345`.

**Symptom:** typing `12345` on the Apps settings page froze the screen for about a second, then bounced back to Apps. No Developer Mode popup, no "Not available" message. The menu-language setting was greyed out too.

**What fixed it (observed 2026-10-21):**

1. Settings → Support → Device Care → Self Diagnosis → **Reset Smart Hub**
2. Re-accept the terms
3. Switch the menu language to **English**
4. `12345` again → the Developer Mode popup appeared. Turn it on and enter the PC's IP.
5. **Unplug the TV for about 60 seconds.** Developer Mode only starts on a cold boot. Turning the TV off with the remote is not enough.

I don't know which step mattered: the stale Smart Hub state, the non-English menu language, or both. Many threads on the Samsung developer forum report "can't enable developer mode", and none I found mentioned Reset Smart Hub. Try it before giving up.

## 2. Install gotchas

| Problem | What was actually going on |
|---|---|
| `tizen install` fails with an empty "Platform log view" and no error | The `.wgt` file name had a **space** in it (Tizen names the package after `<name>` in config.xml, e.g. `My Home.wgt`). Rename it to `MyHome.wgt` before installing. I wasted six attempts and two wrong theories on this. |
| `[target]: null` | `-t` wants the **device name from `sdb devices`** (the model number), not `IP:port`. |
| `There is no connected target` | The `sdb` connection drops between installs. Run `sdb connect <tv-ip>:26101` before every install. |
| Old signature files end up in the new package | Delete `author-signature.xml` and `signature1.xml` from the staging folder before `tizen package`. A clean copy of `src` each build avoids it. |
| Updated app not picked up | Bump `version` in config.xml on every install. Installing over the app while it's open works fine. |
| `package-manager-cli.exe` half-updates and breaks the bundled JDK | It needs an elevated shell. Running its jar directly without admin rights broke the JDK; I had to reinstall Tizen Studio. |
| Certificate Manager exe exits silently | Launch `tools\certificate-manager\CertificateManager.bat` instead. |
| `sdb shell` prints nothing; `sdb shell 0 debug` hangs | Normal on this TV: the shell channel is closed. No on-device profiling (see §5). |
| WebSocket remote API on port 8002 | Never answered, even with IP Remote enabled. Not used. |
| Real CLI errors | `<tizen-studio-data>\cli\logs\cli.log` has them. The console usually doesn't. |

**Keep the author certificate.** Updates must be signed with the same author certificate. If you lose it, you have to uninstall and reinstall the app. Back up the `.p12` and keep its password in a password manager.

## 3. Deep-linking into a title: Prime Video, and YouTube via cast

Goal: press OK on a poster and land on that title inside the streaming app. Tested 2026-10-22 with `tizen.application.launchAppControl`. Before each test, I parked the target app on an unrelated screen. Otherwise "it opened" and "it resumed where I left off" look the same.

| App | Forms tried | Result |
|---|---|---|
| **Prime Video** | data `PAYLOAD = {"values":"<gti>"}` with operation `http://samsung.com/appcontrol/operation/eden_resume` **or** the default operation | ✅ Opens the title |
| Netflix | `eden_resume` + `PAYLOAD` `m=https://www.netflix.com/title/<id>&source_type=4`; `eden_resume` + bare id; URI `…/title/<id>` | ❌ Only opens the app |
| Disney+ (Hotstar-based app) | `eden_resume` + content id; `hotstar://content/<id>`; https content URL; `disneyplus.com/browse/entity-<id>` (4 variants) | ❌ Only opens the app |
| HBO Max | URI; `eden_resume` + uuid | ❌ Only opens the app |
| Monomax (Thai service) | URI; `eden_resume` + id | ❌ Only opens the app |

The Prime `gti` came from JustWatch's `deeplinkURL(platform: TIZENOS)` (see §7).

**DIAL** (`http://<tv-ip>:8080/ws/apps/<Name>`) was also a dead end:

- `GET` returns the app state. `POST` launches the app. `DELETE …/run` stops it.
- Netflix: `POST` launches it (201 on cold start, 200 if it's already running) but **ignores every title body** I sent: `m=…/title/<id>&source_type=4`, `…/watch/<id>`, and the `api.netflix.com/catalog/titles/series/<id>` form, both plain and URL-encoded. A cold start lands on the profile picker.
- `DisneyPlus` and `Monomax`: `POST` returns 200, but the app never starts. The state stays `stopped`, even with Netflix stopped first.
- Netflix search link (observed on 2026-10-27): `m=https://www.netflix.com/search?q=<title>&source_type=4` is ignored too. Cold start lands on the profile picker; sending it again while Netflix is running returns 200 and the screen doesn't change.

### YouTube: DIAL `v=` is ignored, the cast protocol works

Observed on 2026-10-27, tested from a PC first and then from inside the Tizen app.

- DIAL `POST /ws/apps/YouTube` needs an `Origin: https://www.youtube.com` header (without it: 403). The `v=<videoId>` body is **ignored**: if YouTube is running it just resumes the open clip, and on a true cold start (after `DELETE …/YouTube/run`) it lands on YouTube's home.
- What works is the same protocol a phone uses to cast (the YouTube "Lounge" API on `www.youtube.com/api/lounge/…`):
  1. Get the TV's **screen id** (DIAL `GET /ws/apps/YouTube` → `additionalData.screenId`, while YouTube is running).
  2. `pairing/get_lounge_token_batch` with that screen id → a lounge token.
  3. `bc/bind` as a remote (`count=0`) → session ids.
  4. `bc/bind` again with a `setPlaylist` request for the video id → the clip plays on the TV.
- **From inside a Tizen web app**, DIAL `GET` on the TV itself returned **401** (the app's origin is refused), so the app can't read the screen id. I read it once from a PC and baked it into the build. It stayed the same across YouTube restarts; if casting stops working after a YouTube reset or re-pairing, read it again. The `youtube.com` lounge requests from the app worked without CORS problems.
- The YouTube app must be running and online before `setPlaylist` lands. The app launches YouTube, then re-binds every ~1 s (up to ~25 s) until the bind response shows the TV screen is connected, then sends the video.
- Set `background-support="enable"` in config.xml, or your app's JS stops when YouTube comes to the front and the cast never gets sent.

**Result:** on this firmware, a third-party home screen can open a specific title in Prime Video (app-control) and a specific clip in YouTube (cast protocol). For every other service, OK just opens the app.

## 4. The Home key

- When my app is in the foreground, pressing Home sends it **nothing**. I checked with an on-screen event log: no `keydown`, `blur`, `visibilitychange` or `appcontrol`. So "Home again = scroll back to the top" is impossible. I mapped that to Back instead.
- Pressing Home from **another** app brings mine to the foreground and fires `visibilitychange` (visible). That's where I reset to the top row and refresh data.
- Making Home open your app at all means changing which app Smart Hub launches for the Home key. That is undocumented and I used a separate community tool for it; it's out of scope here. If you do it, **save the original value first** and **restore it before you uninstall your app**. Otherwise Home points at an app that no longer exists and you get a blank screen.
- Keep the `tizen:application id` fixed forever once Home points at it.

## 5. Making it smooth on a weak TV CPU

The first full version (~900 DOM nodes, many rows of posters) was "very laggy" on the TV. The TV can't be profiled (§2), so I measured on a PC instead:

- Chromium with DevTools CPU throttling at **6×**
- A performance trace while pressing arrow keys
- A script that measures **keydown → second `requestAnimationFrame`** per keypress

The tab must be in the foreground. Background tabs throttle rAF to ~1 fps and show fake ~1000 ms frames.

What made the difference (moving down into the home rows went from 210–364 ms to 55–96 ms at 6× throttling; on the TV it then felt smooth, which is subjective):

| Cause | Fix |
|---|---|
| Setting CSS custom properties for the focus glow on the root element re-styled every node on each focus move | Set them on the glow element only, and only when the value changes |
| Updating the big hero (title, backdrop, text-fit) on every focus move | Debounce it ~90 ms. Fit the title with canvas `measureText` instead of a `scrollWidth` loop. |
| `element.focus()` auto-scrolled the row container, and my scroll reset forced a reflow | `overflow: clip` on the container + `focus({ preventScroll: true })`. No scroll resets. |
| Rows in normal flow: hiding/adding one shifted everything | Rows are `position: absolute` at a top/height measured once. Rows far from focus get `display: none` (window −2…+5), and far rows drop their tiles. |
| `will-change: transform` on a huge track | Made right-arrow 10× slower until the rows were absolute + hidden. Use it only on small elements. |
| Rotated poster collage inside a rounded `overflow: hidden` tile | Expensive. No rotation. |
| Full-screen glow layer repainting | Render it at 480×270 and scale ×4: 16× fewer pixels to repaint |

Ruled out by testing: dim-overlay opacity, and track transitions themselves.

The 3D poster carousel I started with was too slow on the TV no matter what. I compared 10 flat 2D designs in a PC preview and went with a large centre card. Animate only `transform` and `opacity`. Swap backdrops ~450 ms after focus stops, with the image preloaded.

## 6. Remote input: hold-OK and a custom keyboard

- **Long-press OK works.** The TV sends `keyup` for OK, so you can tell a tap from a hold: start a 650 ms timer on `keydown` and ignore `ev.repeat`; a `keyup` before the timer fires is a normal OK. I use the hold to edit favourites (add/remove, or reorder with ◀▶). See [`examples/hold-ok.js`](examples/hold-ok.js).
- **The built-in IME was not worth it** for search. I replaced the `<input>` with my own on-screen keyboard (Thai Kedmanee and QWERTY, with Shift), with live results debounced 400 ms. Thai vowel/tone mark keys needed to be bigger than other keys to be readable from the sofa.
- Key codes: arrows 37–40, OK 13, Back 10009. You must register any other remote keys with `tizen.tvinputdevice`.

## 7. Data sources

- **TMDB** (free API key, read-only token). The app calls it directly from the TV. Allow-list the hosts with `<access>` in config.xml.
  - Watch-provider ids for **Thailand** (`watch_region=TH`), checked: Netflix `8` · **Disney+ `122`** (not 337, the id used in many other regions) · Prime Video `119` · HBO Max `1899` · Monomax `2283`.
  - For "new on a service", filter TV shows by `first_air_date` (within 90 days). `air_date` pulls in long-running shows that just had a new episode.
- **JustWatch GraphQL** (`https://apis.justwatch.com/graphql`) is **unofficial and undocumented**: no key, introspection off, and it may change or block you. Use it at your own risk. Things I found there:
  - `deeplinkURL(platform: TIZENOS)` (the enum is `TIZENOS`, not `TIZEN`) gave the Prime `gti` used in §3
  - `standardWebURL` gives service title ids
  - Per-offer `audioLanguages` / `subtitleLanguages` were filled for Prime / HBO Max / Disney+ in Thailand and empty for Netflix / Monomax
  - Matching back to TMDB: search by title, then confirm with `externalIds.tmdbId` plus `objectType` (`MOVIE` / `SHOW`)
- **Open-Meteo**: weather and air quality, no key.

## 8. Code in this repo

| File | What it is |
|---|---|
| [`examples/config.xml`](examples/config.xml) | Minimal TV web-app manifest: the privileges actually needed (launch apps, list apps, remote keys, switch HDMI, internet) and the `<access>` allow-list |
| [`examples/platform.js`](examples/platform.js) | Thin wrapper over the Tizen APIs: list the user-facing apps (filters out system/service apps), launch an app, launch with app-control data (the Prime deep link), list/switch HDMI inputs. It also mocks itself in a desktop browser so you can develop with arrow keys. |
| [`examples/hold-ok.js`](examples/hold-ok.js) | Tap vs long-press on OK |
| [`examples/build.ps1`](examples/build.ps1) | Package → rename → connect → install, with the gotchas from §2 baked in |

`platform.js` is adapted in part from [arn0-tv](https://github.com/NelsonEU/arn0-tv) (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

MIT. See [LICENSE](LICENSE).
