import { REXClientModule, registerREXModule, injectREXSelectors } from '@bric/rex-core/browser'
import { REXConfiguration } from '@bric/rex-core/common'

export interface REXSearchMirrorConfiguration {
  enabled: boolean
  debug?: boolean
  primary_sites?: string[]
  secondary_sites?: string[]
  'secondary-sites'?: string[]
  [key: string]: unknown
}

export class REXSearchSiteBrowserModule {
  isPrimarySite = false

  matchesSearchSite(url: Location): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
    return false
  }

  searchUrl(query: string | null, queryType: string | null): string | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    return null
  }

  extractQuery(location: Location): string | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    return null
  }

  extractQueryType(location: Location): string | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    return null
  }

  extractResults(configuration: REXSearchMirrorConfiguration): void { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Override in subclasses.
  }
}

type PageChangeListener = () => void

class SearchMirrorModule extends REXClientModule {
  searchMirrorSites: Record<string, REXSearchSiteBrowserModule> = {}
  pageChangeListeners: PageChangeListener[] = []
  mutationObserver: MutationObserver | null = null
  configuration: REXSearchMirrorConfiguration | null = null

  toString():string {
    return 'SearchMirrorModule'
  }

  insertMirrorSite(identifier: string, location: string) {
    const wrapper = document.createElement('div')

    const htmlCode = '<iframe id="background_fetch_frame' + identifier + '" src="' + location + '" style="display: block; height: 8px; opacity: 1.0;"></iframe>'

    wrapper.innerHTML = htmlCode

    const body = document.querySelector('body')
    if (body !== null && wrapper.firstChild !== null) {
      body.appendChild(wrapper.firstChild)
    }
  }

  setup() {
    injectREXSelectors()

    chrome.runtime.sendMessage({'messageType': 'fetchConfiguration'})
      .then((response:{ [name: string]: any; }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const configuration = response as REXConfiguration

        this.configuration = configuration['search_mirror'] as REXSearchMirrorConfiguration | undefined ?? null

        if (this.configuration === null) {
          this.configuration = {
            enabled: true,
            'secondary_sites': []
          }
        }

        this.mutationObserver = new MutationObserver(() => {
          for (const callback of this.pageChangeListeners) {
            callback()
          }
        })

        this.mutationObserver.observe(document, {subtree: true, childList: true});

        if (this.configuration.enabled) {
          if (window.location === window.parent.location) { // Top frame
            let matchedSearchSiteKey: string | null = null

            for (const [siteKey, siteObject] of Object.entries(this.searchMirrorSites)) {
              if (siteObject.matchesSearchSite(window.location)) {
                matchedSearchSiteKey = siteKey
              }
            }

            if (this.configuration['primary_sites'] !== undefined && matchedSearchSiteKey !== null && this.configuration['primary_sites'].includes(matchedSearchSiteKey) === false) {
              matchedSearchSiteKey = null
            }

            if (matchedSearchSiteKey !== null) {
              console.log('[Search Mirror] ' + window.location.href + ' is a search site (primary).')

              const thisSearchSite = this.searchMirrorSites[matchedSearchSiteKey]

              const query = thisSearchSite.extractQuery(window.location)
              const queryType = thisSearchSite.extractQueryType(window.location)

              for (const [siteKey, siteObject] of Object.entries(this.searchMirrorSites)) {
                if (siteKey !== matchedSearchSiteKey) {
                  const existingFrame = document.getElementById('background_fetch_frame_' + siteKey)
                  const searchLocation = siteObject.searchUrl(query, queryType)

                  if (this.configuration['secondary-sites'] !== undefined && this.configuration['secondary-sites'].includes(siteKey) === false) {
                    // Skip -- not enabled
                  } else if (existingFrame === null && searchLocation !== null) {
                    this.insertMirrorSite(siteKey, searchLocation)
                  }
                }
              }

              thisSearchSite.isPrimarySite = true

              this.registerPageChangeListener(() => {
                if (this.configuration !== null) {
                  thisSearchSite.extractResults(this.configuration)
                }
              })
            }
          } else {
            let matchedSearchSiteKey: string | null = null

            for (const [siteKey, siteObject] of Object.entries(this.searchMirrorSites)) {
              if (siteObject.matchesSearchSite(window.location)) {
                matchedSearchSiteKey = siteKey
              }
            }

            if (this.configuration['secondary_sites'] !== undefined && matchedSearchSiteKey !== null && this.configuration['secondary_sites'].includes(matchedSearchSiteKey) === false) {
              matchedSearchSiteKey = null
            }

            if (matchedSearchSiteKey !== null) {
              console.log('[Search Mirror] ' + window.location.href + ' is a search site (secondary).')

              const thisSearchSite = this.searchMirrorSites[matchedSearchSiteKey]

              thisSearchSite.isPrimarySite = false

              this.registerPageChangeListener(() => {
                if (this.configuration !== null) {
                  thisSearchSite.extractResults(this.configuration)
                }
              })
            }
          }
        }
      })
  }

  registerSearchMirrorSite(siteKey: string, siteObject: REXSearchSiteBrowserModule) {
    this.searchMirrorSites[siteKey] = siteObject
  }

  registerPageChangeListener(callback: PageChangeListener) {
    this.pageChangeListeners.push(callback)
  }

  registerModuleCallback(configuration: REXConfiguration) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // No-op; hook retained for subclass overrides.
  }
}

const plugin = new SearchMirrorModule()

registerREXModule(plugin)

export default plugin
