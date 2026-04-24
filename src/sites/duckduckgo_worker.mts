import { dispatchEvent } from '@bric/rex-core/service-worker'

import { REXSearchSiteWorkerModule } from '../service-worker.mjs'

export class REXDDGSiteWorkerModule extends REXSearchSiteWorkerModule {
  setup() {
    chrome.webRequest.onCompleted.addListener(async function (details) {
      if (details.initiator === undefined || details.initiator.includes('chrome-extension://')) {
        return
      }

      // https://duckduckgo.com/ac/?q=wol&kl=wt-wt

      if (details.url.includes('duckduckgo.com/ac')) {
        console.log('[Search Mirror / duckduckgo] Autocomplete Request: ' + details.url)

        const searchUrl = new URL(details.url)

        const query = searchUrl.searchParams.get('q')

        if (query !== null && query !== '') {
          fetch(details.url)
            .then(response => response.text())
            .then(function (data) {
              const payload: {
                engine: string
                query: string
                initiator: string | undefined
                search_url: string
                suggestions?: Array<{ term: unknown; subtitle: string; data: unknown }>
              } = {
                engine: 'duckduckgo',
                query,
                initiator: details.initiator,
                search_url: details.url
              }

              const dataJson = JSON.parse(data)

              const dataPayload: Array<{ term: unknown; subtitle: string; data: unknown }> = []

              dataJson.forEach(function (suggestion: { phrase?: unknown }) {
                dataPayload.push({
                  term: suggestion.phrase,
                  subtitle: '',
                  data: suggestion
                })
              })

              payload['suggestions'] = dataPayload

              dispatchEvent({
                name: 'search-suggestions-result',
                payload
              })
            })
        }
      }
    }, {
      urls: ['<all_urls>']
    }, ['responseHeaders', 'extraHeaders'])
  }
}

const ddgWorker = new REXDDGSiteWorkerModule()
ddgWorker.setup()

export default ddgWorker
