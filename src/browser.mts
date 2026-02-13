import { REXClientModule, registerREXModule, injectREXSelectors } from '@bric/rex-core/browser'
import { REXConfiguration } from '@bric/rex-core/extension'

export class REXSearchSiteBrowserModule {
  matchesSearchSite(url):boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
    return false
  }

  searchUrl(query, queryType):string|null { // eslint-disable-line @typescript-eslint/no-unused-vars
    return null
  }
}

class SearchMirrorModule extends REXClientModule {
  searchMirrorSites = {}
  pageChangeListeners = []
  mutationObserver:MutationObserver = null
  configuration = null

  constructor() {
    super()
  }

  toString():string {
    return 'SearchMirrorModule (overrride in subclasses)'
  }

  insertMirrorSite(identifier, location) {
    const wrapper = document.createElement('div')

    const htmlCode = '<iframe id="background_fetch_frame' + identifier + '" src="' + location + '" style="display: block; height: 8px; opacity: 1.0;"></iframe>'

    wrapper.innerHTML = htmlCode

    document.querySelector('body').appendChild(wrapper.firstChild)

    console.log('[Search Mirror] Inserted ' + identifier + ' background search: ' + location)
  }

  setup() {
    injectREXSelectors()

    chrome.runtime.sendMessage({'messageType': 'fetchConfiguration'})
      .then((response:{ [name: string]: any; }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const configuration = response as REXConfiguration

        this.configuration = configuration['search_mirror']

        if (this.configuration === undefined) {
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
            let matchedSearchSiteKey = null

            for (const [siteKey, siteObject] of Object.entries(this.searchMirrorSites)) {
              if ((siteObject as REXSearchSiteBrowserModule).matchesSearchSite(window.location)) {
                matchedSearchSiteKey = siteKey
              }
            }

            if (this.configuration['primary_sites'] !== undefined && this.configuration['primary_sites'].includes(matchedSearchSiteKey) === false) {
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
                  const searchLocation = (siteObject as REXSearchSiteBrowserModule).searchUrl(query, queryType)

                  if (this.configuration['secondary-sites'] !== undefined && this.configuration['secondary-sites'].includes(siteKey) === false) {
                    // Skip -- not enabled
                  } else if (existingFrame === null && searchLocation !== null) {
                    this.insertMirrorSite(siteKey, searchLocation)
                  }
                }
              }

              thisSearchSite.isPrimarySite = true

              this.registerPageChangeListener(() => {
                thisSearchSite.extractResults(this.configuration)
              })
            }
          } else {
            let matchedSearchSiteKey = null

            for (const [siteKey, siteObject] of Object.entries(this.searchMirrorSites)) {
              if ((siteObject as REXSearchSiteBrowserModule).matchesSearchSite(window.location)) {
                matchedSearchSiteKey = siteKey
              }
            }

            if (this.configuration['secondary_sites'] !== undefined && this.configuration['secondary_sites'].includes(matchedSearchSiteKey) === false) {
              matchedSearchSiteKey = null
            }

            if (matchedSearchSiteKey !== null) {
              console.log('[Search Mirror] ' + window.location.href + ' is a search site (secondary).')

              const thisSearchSite = this.searchMirrorSites[matchedSearchSiteKey]

              thisSearchSite.isPrimarySite = false

              this.registerPageChangeListener(() => {
                thisSearchSite.extractResults(this.configuration)
              })
            }
          }
        }
      })
  }

  registerSearchMirrorSite(siteKey, siteObject) {
    this.searchMirrorSites[siteKey] = siteObject
  }

  registerPageChangeListener(callback) {
    this.pageChangeListeners.push(callback)
  }

  registerModuleCallback(configuration) {
    let searchConfig = configuration['search_mirror']

    if (searchConfig === undefined) {
      searchConfig = {
        enabled: true
      }
    }
  }
}

const plugin = new SearchMirrorModule()

registerREXModule(plugin)

export default plugin
