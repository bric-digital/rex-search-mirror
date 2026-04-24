import { REXConfiguration } from '@bric/rex-core/common'
import rexCorePlugin, { REXServiceWorkerModule } from '@bric/rex-core/service-worker'

interface REXSearchMirrorWorkerConfiguration {
  'url-filters'?: string[]
  [key: string]: unknown
}

const stringToId = function (str:string) {
  let id:number = str.length

  let multiplier = 1

  Array.from(str).forEach((it:string) => {
    id += it.charCodeAt(0) * multiplier

    multiplier *= 10
  })

  return id % 5000
}

export interface SearchSuggestionItem {
  term: unknown
  subtitle?: string
  data?: unknown
}

export interface SearchSuggestionsPayload {
  engine: string
  query: string
  initiator: string | undefined
  search_url: string
  suggestions?: SearchSuggestionItem[]
  raw_suggestions?: string
}

export class REXSearchSiteWorkerModule {
  setup() {
    // Implement in subclasses to capture search suggestions and other background traffic
  }
}

class REXSearchMirrorModule extends REXServiceWorkerModule {
  configuration: REXSearchMirrorWorkerConfiguration = {}

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

  fetchURLContent(request: { content?: string; url?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response?: string) => void) {
    console.log('[Search Mirror] Fetching ' + request.url + '...')

    if (request.content === 'fetch_url_content' && request.url !== undefined) {
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
        if (configuration !== null && configuration !== undefined) {
          this.configuration = (configuration['search_mirror'] as REXSearchMirrorWorkerConfiguration | undefined) ?? {}

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lastError = (chrome.runtime as any).lastError
              if (lastError) {
                console.log('[Search Mirror] ' + lastError.message)
              }
            })

            console.log('[Search Mirror] Added URL filter: ' + urlFilter)
          }

          console.log('[Search Mirror] Initialized.')
        } else {
          self.setTimeout(this.setup, 1000)
        }
      })
  }
}

const plugin = new REXSearchMirrorModule()

export default plugin
