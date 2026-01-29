import { dispatchEvent } from '@bric/webmunk-core/service-worker'

import { WebmunkSearchSiteWorkerModule } from '../service-worker.mjs'

export class WebmunkGoogleSiteWorkerModule extends WebmunkSearchSiteWorkerModule {
  setup() {
    chrome.webRequest.onCompleted.addListener(async function (details) {
      if (details.initiator === undefined || details.initiator.includes('chrome-extension://')) {
        return
      }

      if (details.url.includes('google.com/complete/search')) {
        console.log('[Search Mirror / google] Autocomplete Request: ' + details.url)

        const searchUrl = new URL(details.url)

        const query = searchUrl.searchParams.get('q')

        if (query !== null && query !== '') {
          fetch(details.url)
            .then(response => response.text())
            .then(function (data) {
              const payload = {
                engine: 'google',
                query,
                initiator: details.initiator,
                search_url: details.url
              }

              if (data.startsWith(')]}\'')) {
                data = data.substring(4)

                const dataJson = JSON.parse(data)

                const dataPayload = []

                const suggestions = dataJson[0]

                suggestions.forEach(function (suggestion) {
                  let subtitle = ''

                  if (suggestion.length > 3) {
                    subtitle = suggestion[3].zi
                  }

                  dataPayload.push({
                    term: suggestion[0],
                    subtitle,
                    data: suggestion
                  })
                })

                payload['suggestions'] = dataPayload
              } else {
                payload['raw_suggestions'] = data
              }

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

const googleWorker = new WebmunkGoogleSiteWorkerModule()
googleWorker.setup()

export default googleWorker
