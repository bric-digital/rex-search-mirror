// @ts-nocheck

import { test, expect } from '@playwright/test'

// Drives the Google site module's extractResults() against captured results
// pages served from tests/src/fixtures. chrome.runtime is stubbed so the
// messages the module sends can be read back, and getManifest() decides
// whether the module believes it runs in an unpacked build.

const PLACES_FIXTURE = '/src/fixtures/google-places-tex-mex-near-me.html?q=tex+mex+near+me'
const SPONSORED_FIXTURE = '/src/fixtures/google-places-hot-dogs-near-me-sponsored.html?q=hot+dogs+near+me'
const BROWSER_BUNDLE = '/extension/js/browser/bundle.js'

const UNPACKED_MANIFEST = {}
const PACKED_MANIFEST = { update_url: 'https://clients2.google.com/service/update2/crx' }

const FEATURE = '[data-rex-serp-feature="local_pack_places"]'
const LISTING = '[data-rex-serp-listing]'
const PART = (name) => `[data-rex-serp-part="${name}"]`
const RATING_WIDGET = '[role="img"][aria-label*="out of 5"]'
const MAP = '[role="region"][aria-label="Map"]'
const OUTLINE_STYLE = 'style#rex-serp-features-outline'

const SETTLE_MS = 200

function configuration (serpFeatures = {}) {
  return {
    enabled: true,
    primary_sites: ['google'],
    serp_features: {
      enabled: true,
      features: ['local_pack_places'],
      settle_ms: SETTLE_MS,
      ...serpFeatures
    }
  }
}

async function openFixture (page, fixture, manifest = UNPACKED_MANIFEST) {
  await page.addInitScript((manifest) => {
    window.rexMessages = []

    globalThis.chrome = {
      runtime: {
        sendMessage: (message) => {
          window.rexMessages.push(message)

          return Promise.resolve({})
        },
        getManifest: () => manifest
      }
    }
  }, manifest)

  await page.goto(fixture)
  await page.addScriptTag({ url: BROWSER_BUNDLE, type: 'module' })
  await page.waitForFunction(() => window.rexSearchMirrorGoogleSite !== undefined)
}

function extract (page, config) {
  return page.evaluate((config) => window.rexSearchMirrorGoogleSite.extractResults(config), config)
}

function eventPayloads (page, name) {
  return page.evaluate((name) => {
    return window.rexMessages
      .filter((message) => message.messageType === 'logEvent' && message.event.name === name)
      .map((message) => message.event.payload)
  }, name)
}

async function waitForSummary (page) {
  await page.waitForFunction(() => {
    return window.rexMessages.some((message) => message.messageType === 'logEvent' && message.event.name === 'search-mirror-serp-summary')
  }, null, { timeout: SETTLE_MS * 20 })

  return eventPayloads(page, 'search-mirror-serp-summary')
}

function count (page, selector) {
  return page.evaluate((selector) => document.querySelectorAll(selector).length, selector)
}

function texts (page, selector) {
  return page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).map((element) => element.textContent.trim()), selector)
}

function attributes (page, selector, attribute) {
  return page.evaluate(([selector, attribute]) => Array.from(document.querySelectorAll(selector)).map((element) => element.getAttribute(attribute)), [selector, attribute])
}

function rects (page, selector) {
  return page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
    const rect = element.getBoundingClientRect()

    return [rect.top, rect.left, rect.width, rect.height]
  }), selector)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test.describe('REX - Search Mirror - SERP features - local_pack_places', () => {
  test.describe('detection and tagging', () => {
    test.beforeEach(async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE)
    })

    test('tags the pack root, each listing and the review parts inside it', async ({ page }) => {
      await extract(page, configuration())

      expect(await count(page, FEATURE)).toBe(1)
      expect(await count(page, `${FEATURE} ${MAP}`)).toBe(1)
      expect(await count(page, `${FEATURE} div[id^="pv-"]`)).toBe(3)

      expect(await attributes(page, LISTING, 'data-rex-serp-listing')).toEqual(['organic', 'organic', 'organic'])

      expect(await count(page, `${FEATURE} ${PART('review_rating')}`)).toBe(3)
      expect(await count(page, `${FEATURE} ${PART('review_count')}`)).toBe(3)
      expect(await count(page, `${FEATURE} ${PART('review_snippet')}`)).toBe(2)
      expect(await count(page, '[data-rex-serp-part]')).toBe(8)

      expect(await texts(page, PART('review_count'))).toEqual(['(321)', '(307)', '(633)'])
      expect(await attributes(page, PART('review_rating'), 'role')).toEqual(['img', 'img', 'img'])
    })

    test('leaves rating widgets outside the pack alone', async ({ page }) => {
      await extract(page, configuration())

      expect(await count(page, RATING_WIDGET)).toBe(10)
      expect(await count(page, `${RATING_WIDGET}[data-rex-serp-part]`)).toBe(3)
      expect(await count(page, `${RATING_WIDGET}:not(${FEATURE} *)[data-rex-serp-part]`)).toBe(0)
    })

    test('emits one feature event naming the listings and one summary after settling', async ({ page }) => {
      await extract(page, configuration())

      const features = await eventPayloads(page, 'search-mirror-serp-feature')

      expect(features).toHaveLength(1)
      expect(features[0].feature).toBe('local_pack_places')
      expect(features[0].engine).toBe('google')
      expect(features[0].query).toBe('tex mex near me')
      expect(features[0].search_url).toContain('/src/fixtures/google-places-tex-mex-near-me.html?q=tex+mex+near+me')
      expect(features[0].serp_id).toMatch(UUID)
      expect(features[0].listings).toEqual([
        { name: 'Cactus Grill Mexican Restaurant and catering', sponsored: false },
        { name: "Macho's Grill", sponsored: false },
        { name: 'BRASAS', sponsored: false }
      ])
      expect(typeof features[0].date).toBe('number')

      const summaries = await waitForSummary(page)

      expect(summaries).toHaveLength(1)
      expect(summaries[0].serp_id).toBe(features[0].serp_id)
      expect(summaries[0].query).toBe('tex mex near me')
      expect(summaries[0].features_checked).toEqual(['local_pack_places'])
      expect(summaries[0].features_found).toEqual(['local_pack_places'])
      expect(summaries[0].substituted).toEqual([])
      expect(summaries[0].settled_after_ms).toBeGreaterThanOrEqual(SETTLE_MS)

      const results = await eventPayloads(page, 'search-mirror-result')

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((result) => result.serp_id === features[0].serp_id)).toBe(true)
    })

    test('is idempotent: a second pass adds no tags and no events', async ({ page }) => {
      await extract(page, configuration())
      await extract(page, configuration())

      expect(await count(page, FEATURE)).toBe(1)
      expect(await count(page, LISTING)).toBe(3)
      expect(await count(page, '[data-rex-serp-part]')).toBe(8)
      expect(await eventPayloads(page, 'search-mirror-serp-feature')).toHaveLength(1)

      await page.waitForTimeout(SETTLE_MS * 3)

      expect(await eventPayloads(page, 'search-mirror-serp-summary')).toHaveLength(1)
    })

    test('does nothing when the feature list leaves the pack out, when disabled, or without the config section', async ({ page }) => {
      await extract(page, configuration({ features: [] }))
      await extract(page, configuration({ enabled: false }))
      await extract(page, { enabled: true, primary_sites: ['google'] })

      expect(await count(page, '[data-rex-serp-feature]')).toBe(0)
      expect(await count(page, '[data-rex-serp-listing]')).toBe(0)
      expect(await count(page, '[data-rex-serp-part]')).toBe(0)
      expect(await eventPayloads(page, 'search-mirror-serp-feature')).toHaveLength(0)

      await page.waitForTimeout(SETTLE_MS * 3)

      const summaries = await eventPayloads(page, 'search-mirror-serp-summary')

      expect(summaries).toHaveLength(1)
      expect(summaries[0].features_checked).toEqual([])
      expect(summaries[0].features_found).toEqual([])
    })

    test('a new query in the same document starts a new SERP', async ({ page }) => {
      await extract(page, configuration())

      const first = await eventPayloads(page, 'search-mirror-serp-feature')

      await page.evaluate(() => {
        const root = document.querySelector('[data-rex-serp-feature]')
        const container = root.parentElement
        const rendered = container.innerHTML.replace(/ data-rex-serp-[a-z]+="[^"]*"/g, '')

        history.replaceState(null, '', '?q=burritos+near+me')
        container.innerHTML = rendered
      })

      await extract(page, configuration())

      const events = await eventPayloads(page, 'search-mirror-serp-feature')

      expect(events).toHaveLength(2)
      expect(events[1].query).toBe('burritos near me')
      expect(events[1].serp_id).toMatch(UUID)
      expect(events[1].serp_id).not.toBe(first[0].serp_id)
    })
  })

  test.describe('sponsored listing', () => {
    test('marks the sponsored listing and reports it first', async ({ page }) => {
      await openFixture(page, SPONSORED_FIXTURE)
      await extract(page, configuration())

      expect(await attributes(page, LISTING, 'data-rex-serp-listing')).toEqual(['sponsored', 'organic', 'organic', 'organic'])
      expect(await attributes(page, '[data-rex-serp-listing="sponsored"]', 'id')).toEqual(['pv-'])
      expect(await count(page, '[data-rex-serp-listing="sponsored"] [data-rex-serp-part="review_rating"]')).toBe(1)

      const features = await eventPayloads(page, 'search-mirror-serp-feature')

      expect(features).toHaveLength(1)
      expect(features[0].listings).toEqual([
        { name: 'Five Guys', sponsored: true },
        { name: "Pete's Red Hots", sponsored: false },
        { name: "Parky's Hot Dogs", sponsored: false },
        { name: "Portillo's Forest Park", sponsored: false }
      ])
    })
  })

  test.describe('outline', () => {
    test('injects one stylesheet keyed on the attributes on an unpacked build', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)

      const before = await rects(page, `${MAP}, div[id^="pv-"]`)

      await extract(page, configuration({ outline: true }))
      await extract(page, configuration({ outline: true }))

      expect(await count(page, OUTLINE_STYLE)).toBe(1)

      const css = await page.evaluate(() => document.querySelector('style#rex-serp-features-outline').textContent)

      expect(css).toContain('[data-rex-serp-feature]')
      expect(css).toContain('[data-rex-serp-part]')
      expect(css).toContain('outline')
      expect(css).not.toContain('border')

      expect(await rects(page, `${MAP}, div[id^="pv-"]`)).toEqual(before)
    })

    test('injects nothing when the flag is off', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)
      await extract(page, configuration({ outline: false }))

      expect(await count(page, FEATURE)).toBe(1)
      expect(await count(page, OUTLINE_STYLE)).toBe(0)
    })

    test('injects nothing on a packed build even with the flag on', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, PACKED_MANIFEST)
      await extract(page, configuration({ outline: true }))

      expect(await count(page, FEATURE)).toBe(1)
      expect(await count(page, OUTLINE_STYLE)).toBe(0)
    })
  })

  test.describe('substitute', () => {
    const SUBSTITUTE = { substitute: true }

    test('replaces the rating, count and snippet and leaves the rest of the listing and the map alone', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)

      const mapBefore = await page.evaluate((selector) => document.querySelector(selector).outerHTML, MAP)
      const namesBefore = await texts(page, '.rllt__details [role="heading"][aria-level="3"]')

      await extract(page, configuration(SUBSTITUTE))

      expect(await attributes(page, PART('review_rating'), 'aria-label')).toEqual(Array(3).fill('Rating replaced for study'))
      expect(await texts(page, PART('review_count'))).toEqual(['(lorem)', '(lorem)', '(lorem)'])
      expect(await texts(page, PART('review_snippet'))).toEqual(['"Lorem ipsum dolor sit amet."', '"Lorem ipsum dolor sit amet."'])
      expect(await count(page, `${PART('review_snippet')} svg`)).toBe(2)

      const numbers = await page.evaluate((selector) => {
        return Array.from(document.querySelectorAll(selector)).map((widget) => widget.firstElementChild.textContent)
      }, PART('review_rating'))

      expect(numbers).toEqual(['0.0', '0.0', '0.0'])

      const starColors = await page.evaluate((selector) => {
        return Array.from(document.querySelectorAll(`${selector} [role="img"]`)).map((stars) => stars.style.color)
      }, PART('review_rating'))

      expect(starColors).toHaveLength(3)
      expect(starColors.every((color) => color !== '')).toBe(true)

      expect(await texts(page, '.rllt__details [role="heading"][aria-level="3"]')).toEqual(namesBefore)
      expect(await page.evaluate((selector) => document.querySelector(selector).outerHTML, MAP)).toBe(mapBefore)

      const summaries = await waitForSummary(page)

      expect(summaries[0].substituted).toEqual(['review_rating', 'review_count', 'review_snippet'])
    })

    test('a second pass changes nothing further', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)

      await extract(page, configuration(SUBSTITUTE))

      const afterFirst = await page.evaluate((selector) => document.querySelector(selector).outerHTML, FEATURE)

      await extract(page, configuration(SUBSTITUTE))

      expect(await page.evaluate((selector) => document.querySelector(selector).outerHTML, FEATURE)).toBe(afterFirst)
    })

    test('re-applies when Google re-renders a listing body or restores a single text', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)

      const originalBody = await page.evaluate(() => document.querySelectorAll('.rllt__details')[1].innerHTML)

      await extract(page, configuration(SUBSTITUTE))

      await page.evaluate((originalBody) => {
        document.querySelectorAll('.rllt__details')[1].innerHTML = originalBody
      }, originalBody)

      expect(await texts(page, PART('review_count'))).toEqual(['(lorem)', '(lorem)'])

      await extract(page, configuration(SUBSTITUTE))

      expect(await texts(page, PART('review_count'))).toEqual(['(lorem)', '(lorem)', '(lorem)'])
      expect(await texts(page, PART('review_snippet'))).toEqual(['"Lorem ipsum dolor sit amet."', '"Lorem ipsum dolor sit amet."'])
      expect(await attributes(page, LISTING, 'data-rex-serp-listing')).toEqual(['organic', 'organic', 'organic'])

      await page.evaluate((selector) => {
        document.querySelectorAll(selector)[0].textContent = '(321)'
      }, PART('review_count'))

      await extract(page, configuration(SUBSTITUTE))

      expect(await texts(page, PART('review_count'))).toEqual(['(lorem)', '(lorem)', '(lorem)'])
      expect(await eventPayloads(page, 'search-mirror-serp-feature')).toHaveLength(1)
    })

    test('re-applies when Google re-renders the whole pack, without a second feature event', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, UNPACKED_MANIFEST)

      const originalPack = await page.evaluate((selector) => {
        const map = document.querySelector(selector)
        const listing = document.querySelector('div[id^="pv-"]')
        let root = listing

        while (root !== null && root.contains(map) === false) {
          root = root.parentElement
        }

        window.rexPackContainer = root.parentElement

        return root.parentElement.innerHTML
      }, MAP)

      await extract(page, configuration(SUBSTITUTE))

      await page.evaluate((originalPack) => {
        window.rexPackContainer.innerHTML = originalPack
      }, originalPack)

      expect(await count(page, FEATURE)).toBe(0)

      await extract(page, configuration(SUBSTITUTE))

      expect(await count(page, FEATURE)).toBe(1)
      expect(await texts(page, PART('review_count'))).toEqual(['(lorem)', '(lorem)', '(lorem)'])
      expect(await eventPayloads(page, 'search-mirror-serp-feature')).toHaveLength(1)
    })

    test('substitutes nothing on a packed build even with the flag on', async ({ page }) => {
      await openFixture(page, PLACES_FIXTURE, PACKED_MANIFEST)
      await extract(page, configuration(SUBSTITUTE))

      expect(await count(page, FEATURE)).toBe(1)
      expect(await texts(page, PART('review_count'))).toEqual(['(321)', '(307)', '(633)'])
      expect(await attributes(page, PART('review_rating'), 'aria-label')).toEqual([
        'Rated 4.3 out of 5, 321 user reviews',
        'Rated 4.6 out of 5, 307 user reviews',
        'Rated 4.3 out of 5, 633 user reviews'
      ])

      const summaries = await waitForSummary(page)

      expect(summaries[0].substituted).toEqual([])
    })
  })
})
