// Finds the local result features Google renders on a results page and marks
// them with data attributes REX owns, so downstream modules select on those
// rather than on Google's rotating class names. Every hook here is an
// accessibility attribute, a stable id pattern or a long-lived semantic class.
// Pure DOM code: no Chrome APIs, so it runs against a saved page in a test.

export type SerpFeatureKey = 'local_pack_places'
export type ReviewPart = 'review_rating' | 'review_count' | 'review_snippet'

export const FEATURE_ATTRIBUTE = 'data-rex-serp-feature'
export const LISTING_ATTRIBUTE = 'data-rex-serp-listing'
export const PART_ATTRIBUTE = 'data-rex-serp-part'

export interface SerpListing {
  root: Element
  name: string
  sponsored: boolean
  parts: Partial<Record<ReviewPart, Element>>
}

export interface SerpFeature {
  key: SerpFeatureKey
  root: Element
  listings: SerpListing[]
}

export type SerpFeatureDetector = (document: Document) => SerpFeature | null

const PLACES_HEADING_SELECTOR = '[role="heading"][aria-level="2"][aria-label^="Places:"]'
const MAP_SELECTOR = '[role="region"][aria-label="Map"]'
const LISTING_SELECTOR = 'div[id^="pv-"]'
const LISTING_BODY_SELECTOR = '.rllt__details'
const LISTING_NAME_SELECTOR = '[role="heading"][aria-level="3"]'
// A widget already tagged still counts once substitution has rewritten its label.
const RATING_SELECTOR = `[role="img"][aria-label*="out of 5"], [role="img"][${PART_ATTRIBUTE}="review_rating"]`
const SPONSORED_LISTING_ID = 'pv-'

const RATING_NUMBER = /^\d+([.,]\d+)?$/
const RATING_COUNT = /^\(.+\)$/
const OPENING_QUOTES = ['"', '“', '„', '«']

function trimmedText (element: Element): string {
  return (element.textContent ?? '').trim()
}

function startsWithQuote (element: Element): boolean {
  const text = trimmedText(element)

  return OPENING_QUOTES.some((quote) => text.startsWith(quote))
}

function childMatching (element: Element, predicate: (child: Element) => boolean): Element | undefined {
  return Array.from(element.children).find(predicate)
}

function commonAncestor (first: Element, second: Element): Element | null {
  for (let candidate: Element | null = first; candidate !== null; candidate = candidate.parentElement) {
    if (candidate.contains(second)) {
      return candidate
    }
  }

  return null
}

function listingsWithin (container: Element): Element[] {
  return Array.from(container.querySelectorAll(LISTING_SELECTOR))
    .filter((listing) => listing.querySelector(LISTING_BODY_SELECTOR) !== null)
}

// The heading sits beside the block that holds the map and the listings, not
// inside it. The nearest ancestor of the heading that holds both ties them together.
function packContainerFor (heading: Element): Element | null {
  for (let candidate = heading.parentElement; candidate !== null; candidate = candidate.parentElement) {
    if (candidate.querySelector(MAP_SELECTOR) !== null && listingsWithin(candidate).length > 0) {
      return candidate
    }
  }

  return null
}

function describeListing (root: Element): SerpListing {
  const body = root.querySelector(LISTING_BODY_SELECTOR) as Element
  const heading = body.querySelector(LISTING_NAME_SELECTOR)
  const nameElement = heading?.querySelector('span') ?? heading

  const parts: Partial<Record<ReviewPart, Element>> = {}

  const rating = body.querySelector(RATING_SELECTOR)

  if (rating !== null) {
    parts.review_rating = rating

    const count = childMatching(rating, (child) => RATING_COUNT.test(trimmedText(child)))

    if (count !== undefined) {
      parts.review_count = count
    }
  }

  const snippet = childMatching(body, startsWithQuote)

  if (snippet !== undefined) {
    parts.review_snippet = snippet
  }

  return {
    root,
    name: nameElement !== null ? trimmedText(nameElement) : '',
    sponsored: root.id === SPONSORED_LISTING_ID,
    parts
  }
}

export function findPlacesPack (document: Document): SerpFeature | null {
  for (const heading of Array.from(document.querySelectorAll(PLACES_HEADING_SELECTOR))) {
    const container = packContainerFor(heading)

    if (container === null) {
      continue
    }

    const map = container.querySelector(MAP_SELECTOR) as Element
    const listings = listingsWithin(container)
    const root = commonAncestor(listings[0], map)

    if (root === null) {
      continue
    }

    return {
      key: 'local_pack_places',
      root,
      listings: listings.filter((listing) => root.contains(listing)).map(describeListing)
    }
  }

  return null
}

export const SERP_FEATURE_DETECTORS: Record<SerpFeatureKey, SerpFeatureDetector> = {
  local_pack_places: findPlacesPack
}

export function isSerpFeatureKey (key: string): key is SerpFeatureKey {
  return key in SERP_FEATURE_DETECTORS
}

function setAttributeOnce (element: Element, name: string, value: string): boolean {
  if (element.getAttribute(name) === value) {
    return false
  }

  element.setAttribute(name, value)

  return true
}

export function tagFeature (feature: SerpFeature) {
  setAttributeOnce(feature.root, FEATURE_ATTRIBUTE, feature.key)

  for (const listing of feature.listings) {
    setAttributeOnce(listing.root, LISTING_ATTRIBUTE, listing.sponsored ? 'sponsored' : 'organic')

    for (const [part, element] of Object.entries(listing.parts)) {
      setAttributeOnce(element, PART_ATTRIBUTE, part)
    }
  }
}

export const OUTLINE_STYLE_ID = 'rex-serp-features-outline'

// outline, not border: an outline paints outside the box and moves nothing.
const OUTLINE_CSS = `
[${FEATURE_ATTRIBUTE}] {
  position: relative;
  outline: 2px solid red;
  outline-offset: 2px;
}
[${FEATURE_ATTRIBUTE}]::before {
  content: attr(${FEATURE_ATTRIBUTE});
  position: absolute;
  top: -18px;
  left: 0;
  padding: 0 4px;
  font: 11px/16px monospace;
  color: white;
  background: red;
  z-index: 2147483647;
}
[${PART_ATTRIBUTE}] {
  outline: 2px solid red;
  outline-offset: 1px;
}
`

export function ensureOutlineStyle (document: Document) {
  if (document.getElementById(OUTLINE_STYLE_ID) !== null) {
    return
  }

  const style = document.createElement('style')

  style.id = OUTLINE_STYLE_ID
  style.textContent = OUTLINE_CSS

  document.head.appendChild(style)
}

export const SUBSTITUTE_RATING_LABEL = 'Rating replaced for study'
export const SUBSTITUTE_RATING_NUMBER = '0.0'
export const SUBSTITUTE_REVIEW_COUNT = '(lorem)'
export const SUBSTITUTE_REVIEW_SNIPPET = '"Lorem ipsum dolor sit amet."'

// Google's own empty-star grey, so the stars keep their width and only lose their fill.
const NEUTRAL_STAR_COLOR = '#80868b'

function setTextOnce (element: Element, text: string): boolean {
  if (element.textContent === text) {
    return false
  }

  element.textContent = text

  return true
}

function substituteRating (widget: Element): boolean {
  let changed = setAttributeOnce(widget, 'aria-label', SUBSTITUTE_RATING_LABEL)

  const number = childMatching(widget, (child) => RATING_NUMBER.test(trimmedText(child)))

  if (number !== undefined && setTextOnce(number, SUBSTITUTE_RATING_NUMBER)) {
    changed = true
  }

  const stars = widget.querySelector('[role="img"]') as HTMLElement | null

  if (stars !== null && stars.style.color === '') {
    stars.style.color = NEUTRAL_STAR_COLOR
    changed = true
  }

  return changed
}

// The snippet block holds an icon and the quoted text; descend to the element
// that carries the quote so the icon stays.
function snippetTextElement (snippet: Element): Element {
  let element = snippet

  for (;;) {
    const child = childMatching(element, startsWithQuote)

    if (child === undefined) {
      return element
    }

    element = child
  }
}

export function substituteReviewContent (feature: SerpFeature): ReviewPart[] {
  const changed: ReviewPart[] = []

  const note = function (part: ReviewPart, didChange: boolean) {
    if (didChange && changed.includes(part) === false) {
      changed.push(part)
    }
  }

  for (const listing of feature.listings) {
    const { review_rating, review_count, review_snippet } = listing.parts

    if (review_rating !== undefined) {
      note('review_rating', substituteRating(review_rating))
    }

    if (review_count !== undefined) {
      note('review_count', setTextOnce(review_count, SUBSTITUTE_REVIEW_COUNT))
    }

    if (review_snippet !== undefined) {
      note('review_snippet', setTextOnce(snippetTextElement(review_snippet), SUBSTITUTE_REVIEW_SNIPPET))
    }
  }

  return changed
}
