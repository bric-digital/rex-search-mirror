# rex-search-mirror

REX module that records search results as participants see them, and mirrors the same query on other engines in hidden frames.

## SERP features

Google renders local results in blocks whose class names rotate. The `serp_features` section of `search_mirror` turns on detection of those blocks on Google results pages: the module finds each configured feature, marks it with data attributes, and reports it, so downstream modules and analysis select on attributes REX owns rather than on Google's markup.

```json
"search_mirror": {
  "enabled": true,
  "primary_sites": ["google"],
  "serp_features": {
    "enabled": true,
    "features": ["local_pack_places"],
    "outline": false,
    "substitute": false,
    "settle_ms": 1500
  }
}
```

| Key | Meaning |
| --- | --- |
| `enabled` | Detect and tag features. Off by default. |
| `features` | Which detectors run. Every detector ships in the module; the list decides which run, so one can be switched off in server config when Google changes. Currently `local_pack_places`, the "Places" local pack. Omit to run all. |
| `outline` | Draw a red outline around each tagged feature and part. A development aid: it only acts on an unpacked build (no `update_url` in the manifest). |
| `substitute` | Replace review content in tagged features with placeholder text. A proof of concept for the intervention, under the same unpacked-build guard. |
| `settle_ms` | Quiet period after the last page mutation before the per-page summary event is sent. |

### The tag contract

Three attributes on the page are the contract between this module and anything acting on the feature:

| Attribute | On | Values |
| --- | --- | --- |
| `data-rex-serp-feature` | the block's root | `local_pack_places` |
| `data-rex-serp-listing` | each business listing in the block | `organic`, `sponsored` |
| `data-rex-serp-part` | review content inside a listing | `review_rating` (stars, number and count together), `review_count`, `review_snippet` |

A rule that targets the review widgets in the pack selects `[data-rex-serp-feature="local_pack_places"] [data-rex-serp-part="review_rating"]`.

### Events

`search-mirror-serp-feature`, once per feature per results page: `serp_id`, `feature`, `query`, `search_url`, `engine`, `foreground`, `listings` (business names in order, each with `sponsored`), `date`.

`search-mirror-serp-summary`, once per results page after `settle_ms` of quiet: `serp_id`, `query`, `search_url`, `engine`, `features_checked`, `features_found`, `substituted` (which parts the substitution flag changed), `settled_after_ms`, `date`. `features_checked` makes an empty `features_found` mean "looked and found nothing" rather than "detector was off".

`search-mirror-result` carries the same `serp_id`, so all events about one results page join on it. The id is minted per query in the page.

### What substitution does

For the demo only, on an unpacked build with `substitute` on: the rating number reads `0.0`, the count reads `(lorem)`, the stars lose their fill, the widget's `aria-label` reads `Rating replaced for study`, and each review snippet reads `"Lorem ipsum dolor sit amet."`. Business names, addresses, hours and the map are untouched. Substitution re-applies when Google re-renders a listing or the whole pack.

## Tests

See `tests/README.md`. Specs run against captured pages, never against Google.
