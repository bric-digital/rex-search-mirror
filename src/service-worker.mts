import { REXConfiguration } from '@bric/rex-core/extension'
import rexCorePlugin, { REXServiceWorkerModule } from '@bric/rex-core/service-worker'

const stringToId = function (str:string) {
  let id:number = str.length

  let multiplier = 1

  Array.from(str).forEach((it:string) => {
    id += it.charCodeAt(0) * multiplier

    multiplier *= 10
  })

  return id % 5000
}

export class WebmunkSearchSiteWorkerModule {
  setup() {
    // Implement in subclasses to capture search suggestions and other background traffic
  }
}

class WebmunkSearchMirrorModule extends REXServiceWorkerModule {
  configuration = {}

  configurationDetails():any { // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      search_mirror: {
        enabled: 'Boolean, true if module is active, false otherwise.',
        primary_sites: 'Array of strings indicating which sites to collect search results from directly. Valid array items: "google", "bing", "duckduckgo".',
        secondary_sites: 'Array of strings indicating which sites to collect mirrored search results from. These queries are invisible to the user. Leave empty to disable this feature. Valid array items: "google", "bing", "duckduckgo".',
        include_ai_elements: 'Boolean, true if module should capture AI overviews and similar elements, false to disable AI element capture.',
        include_news_elements: 'Boolean, true if module should capture news blurbs and similar elements, false to disable news element capture.'
      }
    }
  }

  fetchURLContent(request, sender, sendResponse) {
    console.log('[Search Mirror] Fetching ' + request.url + '...')

    if (request.content === 'fetch_url_content') {
      const url = request.url

      fetch(url, {
        redirect: 'follow' // manual, *follow, error
      })
        .then(response => response.text())
        .then(function (textBody) {
          console.log('[Search Mirror] Fetched: ' + textBody)

          sendResponse(textBody)
        })

      return true
    }

    return false
  }

  setup() {
    rexCorePlugin.fetchConfiguration()
      .then((configuration:REXConfiguration) => {
        this.configuration = configuration['search_mirror']

        if (this.configuration === null || this.configuration === undefined) {
          this.configuration = {}
        }

        let urlFilters = [
          '||bing.com/',
          '||www.bing.com/',
          '||google.com/',
          '||www.google.com/',
          '||duckduckgo.com/'
        ]

        if (this.configuration['url-filters'] !== undefined) {
          urlFilters = this.configuration['url-filters']
        }

        for (const urlFilter of urlFilters) {
          const stripRule = {
            id: stringToId('search-mirror-' + urlFilter),
            priority: 1,
            action: {
              type: 'modifyHeaders' as const,
              responseHeaders: [
                { header: 'x-frame-options', operation: 'remove' as const},
                { header: 'content-security-policy', operation: 'remove' as const }
              ]
            },
            condition: { urlFilter, resourceTypes: ['main_frame' as const, 'sub_frame' as const] }
          }

          chrome.declarativeNetRequest.updateSessionRules({
            addRules: [stripRule]
          }, () => {
            if (chrome.runtime['lastError']) {
              console.log('[Search Mirror] ' + chrome.runtime['lastError'].message)
            }
          })

          console.log('[Search Mirror] Added URL filter: ' + urlFilter)
        }

        console.log('[Search Mirror] Initialized.')
      })
  }
}

const plugin = new WebmunkSearchMirrorModule()

export default plugin
