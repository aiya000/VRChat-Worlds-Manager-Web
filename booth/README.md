# BOOTH

What this app hands out on BOOTH, kept here so it can be edited like the rest of the repository (#162).

The app itself is a web app, so the BOOTH item is only a way in: the item page points at `https://vrcww.com`, and the
downloadable files are getting-started PDFs.

| File                         | What it is                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `guide.ja.md`, `guide.en.md` | The source of the PDFs                                                  |
| `description.md`             | The item's name, price and description, ready to paste into BOOTH       |
| `assets.md`                  | Which images to upload and what to set when listing the item (Japanese) |
| `images/`                    | The images uploaded to the BOOTH item, as they were uploaded            |
| `images-source/`             | What `images/` was made from, kept so an image can be made again        |
| `dist/` (not tracked)        | The PDFs, written by `bun run booth:pdf`                                |

## The item images

`images/` holds exactly what is on the BOOTH item page, so it is the thing to compare against when the page is edited.

- `booth-thumbnail.png` is `images-source/thumbnail.html` rendered at 2400 x 2400 (the page is 1200px at `zoom: 2`). It
  draws the app icon from `public/icons/` and `images/desktop.png`, so render it from where it sits
- The screenshots show demo worlds, not anyone's real collection. `images-source/worlds/` holds the thumbnails those
  demo worlds were given
- `images-source/thumbnail.en.html` is the same thumbnail with its words in English, for the English README. Only the
  words differ; the screenshot inside is still the Japanese UI. It is not on BOOTH, so its render is not in `images/`

The READMEs show the thumbnail from `docs/thumbnail.ja.webp` and `docs/thumbnail.en.webp`: each render scaled to 960px
and encoded as WebP (about 100KB, against 2.8MB for the PNG), shown at 480px. Change a thumbnail's HTML, and those two
are made again from the new render:

```sh
bunx playwright screenshot --viewport-size=2400,2400 file://$PWD/booth/images-source/thumbnail.en.html en.png
convert en.png -resize 960x960 en-960.png
cwebp -q 88 en-960.png -o docs/thumbnail.en.webp
```

## The PDF holds only what does not go stale

A PDF someone has already downloaded cannot be corrected. So the PDF carries the outline of getting started and a link
to `https://vrcww.com/guide`, and everything that changes with the browsers -- where the install button is, what the
menu item is called -- lives on that page (`src/app/guide/page.tsx`).

Change the PDF only when the outline or a URL changes. Anything more detailed belongs on `/guide`.

## Writing the PDFs

```sh
bun run booth:pdf
```

It renders each `guide.<lang>.md` with the Chromium that Playwright installs for the e2e tests (`bunx playwright
install chromium` once, if it is missing) and writes `dist/vrcww-guide-<lang>.pdf`. It needs a network connection: the
font is fetched from Google Fonts, so every machine produces the same file.
