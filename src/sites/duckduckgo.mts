import mirrorManager, { WebmunkSearchSiteBrowserModule } from '../browser.mjs'

export class WebmunkDDGSiteBrowserModule extends WebmunkSearchSiteBrowserModule {
  linkCache = {}
  isPrimarySite = true
  resultCount = 0
  recordedOverview = false

  matchesSearchSite(location):boolean {
    if (['duckduckgo.com'].includes(location.host) === false) {
      return false
    }

    if (location.href.includes('/uviewer')) {
      return false
    }

    const searchQuery = this.extractQuery(location)

    if (searchQuery === null || searchQuery === undefined || searchQuery === '') {
      return false
    }

    return true
  }

  searchUrl(query, queryType):string|null {
    if (queryType === 'image') {
      return 'https://duckduckgo.com/?iax=images&ia=images&q=' + encodeURIComponent(query)
    }

    if (queryType === 'news') {
      return 'https://duckduckgo.com/&iar=news&ia=news&q=' + encodeURIComponent(query)
    }

    if (queryType === 'shopping') {
      return 'https://duckduckgo.com/?ia=shopping&iax=shopping&q=' + encodeURIComponent(query)
    }

    return 'https://duckduckgo.com/?ia=web&q=' + encodeURIComponent(query)
  }

  extractQuery(location) {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location) {
    const params = new URLSearchParams(location.search)

    const ia = params.get('ia')

    if (ia === 'images') {
      return 'image'
    }

    if (ia === 'news') {
      return 'news'
    }

    if (ia === 'shopping') {
      return 'shopping'
    }

    return 'web'
  }

  extractResults(configuration) {
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    if (queryType === 'web') {
      const results = document.querySelectorAll('article[data-nrn="result"]')

      results.forEach(function (element) {
        const cites = element.querySelectorAll('[data-testid="result-extras-url-link"]')

        const titles = element.querySelectorAll('h2')

        if (titles.length > 0 && cites.length > 0) {
          let title = ''
          let href = null

          titles.forEach(function (titleElement) {
            titleElement.childNodes.forEach(function (childNode) {
              if (childNode.nodeType === Node.ELEMENT_NODE) {
                if ((childNode as Element).localName === 'a') {
                  href = (childNode as Element).getAttribute('href')

                  childNode.childNodes.forEach(function (grandChildNode) {
                    if (grandChildNode.nodeType === Node.ELEMENT_NODE) {
                      grandChildNode.childNodes.forEach(function (textNode) {
                        if (textNode.nodeType === Node.TEXT_NODE) {
                          title += textNode.nodeValue
                        }
                      })
                    }
                  })
                }
              }
            })
          })

          let citation = ''

          cites.forEach(function (citeElement) {
            citeElement.childNodes.forEach(function (childNode) {
              if (childNode.nodeType === Node.TEXT_NODE) {
                citation += childNode.nodeValue
              } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                childNode.childNodes.forEach(function (grandChildNode) {
                  if (grandChildNode.nodeType === Node.TEXT_NODE) {
                    citation += grandChildNode.nodeValue
                  }
                })
              }
            })
          })

          if (href !== null && this.linkCache[href] === undefined) {
            const content = element.outerHTML

            this.resultCount += 1

            const payload = {
              title,
              citation,
              link: href,
              search_url: window.location.href,
              content,
              query,
              type: queryType,
              foreground: this.isPrimarySite,
              engine: 'duckduckgo',
              index: this.resultCount
            }

            console.log('[Search Mirror / duckduckgo] Got result[' + this.resultCount + ']: ' + title)
            // console.log(payload)

            chrome.runtime.sendMessage({
              'messageType': 'logEvent',
              'event': {
                'name': 'search-mirror-result',
                payload
              }
            })

            this.linkCache[href] = payload
          }
        }
      })
    }

    if (configuration['include_ai_elements']) {
      if (this.recordedOverview === false) {
        // AI Overview

        window.setTimeout(() => {
          const aiSvgPath = $('li:has(path[d="M3.375 6a.625.625 0 1 0 0-1.25H.625a.625.625 0 1 0 0 1.25zM8.5 9.375c0 .345-.28.625-.625.625H.625a.625.625 0 1 1 0-1.25h7.25c.345 0 .625.28.625.625M10.375 14a.625.625 0 1 0 0-1.25H.625a.625.625 0 1 0 0 1.25z"])')

          aiSvgPath.each((index, item) => {
            console.log('[Search Mirror / duckduckgo] Got AI result]')

            this.recordedOverview = true
            const content = $(item).get(0).innerHTML

            const payload = {
                  search_url: window.location.href,
                  content,
                  query,
                  type: queryType,
                  foreground: this.isPrimarySite,
                  engine: 'duckduckgo'
                }

            console.log(payload)

            chrome.runtime.sendMessage({
              'messageType': 'logEvent',
              'event': {
                'name': 'search-mirror-result-ai',
                payload
              }
            })

            chrome.runtime.sendMessage({
              'messageType': 'logEvent',
              'event': {
                'name': 'search-mirror-result',
                payload
              }
            })
          })
        }, 15000)
      }
    }
  }
}

const ddgSite = new WebmunkDDGSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('duckduckgo', ddgSite)

export default ddgSite
