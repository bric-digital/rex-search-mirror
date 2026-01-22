import { dispatchEvent } from '@bric/webmunk-core/service-worker'

import { WebmunkSearchSiteWorkerModule } from '../service-worker.mjs'

export class WebmunkDDGSiteWorkerModule extends WebmunkSearchSiteWorkerModule {
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
          // console.log(details)

          fetch(details.url)
            .then(response => response.text())
            .then(function (data) {
              const payload = {
                engine: 'duckduckgo',
                query,
                initiator: details.initiator,
                search_url: details.url
              }

              const dataJson = JSON.parse(data)

              // console.log(dataJson)

              const dataPayload = []

              dataJson.forEach(function (suggestion) {
                dataPayload.push({
                  term: suggestion.phrase,
                  subtitle: '',
                  data: suggestion
                })
              })

              // console.log('[Search Mirror / duckduckgo] Data Payload (Parsed):')
              // console.log(dataPayload)

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

const ddgWorker = new WebmunkDDGSiteWorkerModule()
ddgWorker.setup()

export default ddgWorker
