# REX Search Mirror Test Suite

Run with `npm test`. The `pretest` step bundles `tests/src/*.ts` into `tests/extension/js/`, and `npm test` serves the `tests/` directory on port 8080 for the browser specs.

## Fixtures

`tests/src/fixtures/` holds captured Google results pages that the browser specs load instead of searching Google. Each was made from a page saved in a real Chrome session with `tests/scripts/prepare-serp-fixture.mjs`, which removes scripts, frames and link elements, redacts the signed-in account, and adds a Content-Security-Policy so the page loads nothing from the network under test.

```
node tests/scripts/prepare-serp-fixture.mjs <capture.html> tests/src/fixtures/<name>.html --redact "<account holder name>"
```

Check the result for anything personal before committing it: the script redacts email addresses and the account avatar URL on its own, and the names passed with `--redact`.

| Fixture | Query | What it holds |
| --- | --- | --- |
| `google-places-tex-mex-near-me.html` | `tex mex near me` | A Places pack with three organic listings; two carry a review snippet, one carries a menu highlight instead. Rating widgets outside the pack (AI Overview, organic results) for the scoping test. |
| `google-places-hot-dogs-near-me-sponsored.html` | `hot dogs near me` | A Places pack with a sponsored listing first, then three organic listings. |

Both were captured on 2026-09-20 from Oak Park, Illinois. Google's markup changes; when a spec starts failing on a hook, recapture rather than edit the fixture.

## Driving the Google module from a spec

`tests/src/browser.ts` exposes the Google site module as `window.rexSearchMirrorGoogleSite`. A spec stubs `chrome.runtime` with `page.addInitScript` before loading a fixture, adds the browser bundle with `page.addScriptTag`, and calls `extractResults(configuration)` directly. Messages the module sends land in `window.rexMessages`; `getManifest()` in the stub decides whether the module believes it runs in an unpacked build. See `tests/specs/serp-features.spec.ts`.
