import mirrorManager, { REXSearchSiteBrowserModule } from '../browser.mjs'

export class REXBingSiteBrowserModule extends REXSearchSiteBrowserModule {
  linkCache = {}
  isPrimarySite = true
  resultCount = 0
  recordedOverview = false
  recordedNews = false

  matchesSearchSite(location):boolean {
    if (['bing.com', 'www.bing.com'].includes(location.host) === false) {
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
      return 'https://www.bing.com/images/search?q=' + encodeURIComponent(query)
    }

    if (queryType === 'news') {
      return 'https://www.bing.com/news/search?q=' + encodeURIComponent(query)
    }

    if (queryType === 'shopping') {
      return 'https://www.bing.com/shop?q=' + encodeURIComponent(query)
    }

    return 'https://www.bing.com/search?q=' + encodeURIComponent(query)
  }

  extractQuery(location) {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location) {
    if (location.pathname.startsWith('/images/search')) {
      return 'image'
    }

    if (location.pathname.startsWith('/news/search')) {
      return 'news'
    }

    if (location.pathname.startsWith('/shop')) {
      return 'shopping'
    }

    return 'web'
  }

  extractResults(configuration) {
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    if (queryType === 'web') {
      const results = document.querySelectorAll('li.b_algo')

      results.forEach(function (element) {
        const cites = element.querySelectorAll('cite')
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
                    if (grandChildNode.nodeType === Node.TEXT_NODE) {
                      title += grandChildNode.nodeValue
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
              engine: 'bing',
              index: this.resultCount
            }

            console.log('[Search Mirror / bing] Got result[' + this.resultCount + ']: ' + title)

            chrome.runtime.sendMessage({
              content: 'record_data_point',
              generator: 'search-mirror-result',
              payload
            })

            this.linkCache[href] = payload
          }
        }
      })
    } else if (queryType === 'image') {
      console.log('[Search Mirror / bing] Looking for images...')

      const results = document.querySelectorAll('div.iuscp')

      results.forEach(function (element) {
        const titles = element.querySelectorAll('a[title]')

        if (titles.length > 0) {
          let title = ''
          let href = null

          titles.forEach(function (titleElement) {
            title += titleElement.getAttribute('title')
          })

          const hrefs = element.querySelectorAll('a.iusc')

          hrefs.forEach(function (hrefElement) {
            const metadata = JSON.parse(hrefElement.getAttribute('m'))

            if (metadata !== null) {
              href = metadata.purl
            }
          })

          let imageHref = null

          const imageElements = element.querySelectorAll('img[alt]')

          imageElements.forEach(function (imageElement) {
            imageHref = imageElement.getAttribute('src')
          })

          if (href !== null && this.linkCache[href] === undefined) {
            const content = element.outerHTML

            this.resultCount += 1

            const payload = {
              title,
              link: href,
              search_url: window.location.href,
              content,
              query,
              'image_url@': imageHref,
              type: queryType,
              foreground: this.isPrimarySite,
              engine: 'bing',
              index: this.resultCount
            }

            console.log('[Search Mirror / bing] Got result[' + this.resultCount + ']: ' + title)

            if (imageHref !== null) {
              // window.cookieManagerPopulateContent(imageHref, title, payload, 'image_url@', function () {
              //   chrome.runtime.sendMessage({
              //     content: 'record_data_point',
              //     generator: 'search-mirror-result',
              //     payload: payload // eslint-disable-line object-shorthand
              //   })
              // })
            } else {
              chrome.runtime.sendMessage({
                'messageType': 'logEvent',
                'event': {
                  'name': 'search-mirror-result',
                  payload
                }
              })
            }

            this.linkCache[href] = payload
          }
        }
      })
    }

    if (configuration['include_ai_elements']) {
      if (this.recordedOverview === false) {
        // AI Overview

        this.recordedOverview = true

        window.setTimeout(() => {
          const aiSvgPath = $('li:has(path[d="m15.226 1.353-.348-1.07a.423.423 0 0 0-.799 0l-.348 1.07a2.2 2.2 0 0 1-1.377 1.397l-1.071.348a.423.423 0 0 0 0 .798l1.071.348a2.2 2.2 0 0 1 1.399 1.403l.348 1.07a.423.423 0 0 0 .798 0l.349-1.07a2.2 2.2 0 0 1 1.398-1.397l1.072-.348a.423.423 0 0 0 0-.798l-.022-.006-1.072-.348a2.2 2.2 0 0 1-1.398-1.397M19.018 7.965l.765.248.015.004a.303.303 0 0 1 0 .57l-.765.248a1.58 1.58 0 0 0-1 .999l-.248.764a.302.302 0 0 1-.57 0v-.002l-.249-.762a1.58 1.58 0 0 0-.999-1.002l-.765-.249a.303.303 0 0 1 0-.57l.765-.248a1.58 1.58 0 0 0 .984-.999l.249-.764a.302.302 0 0 1 .57 0l.249.764a1.58 1.58 0 0 0 .999.999"])')

          aiSvgPath.each((index, item) => {
            console.log('[Search Mirror / bing] Got AI result]')

            const content = $(item).get(0).innerHTML

            const payload = {
                  search_url: window.location.href,
                  content,
                  query,
                  type: queryType,
                  foreground: this.isPrimarySite,
                  engine: 'bing'
                }

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
        }, 2500)
      }
    }

    if (configuration['include_news_elements']) {
      if (this.recordedNews === false) {
        // News Overview

        this.recordedNews = true

        const selectors = [
          '.nslist_card_main',
          '.na_citem'
        ]

        for (const selector of selectors) {
          window.setTimeout(() => {
            const aiSvgPath = $(selector)

            aiSvgPath.each((index, item) => {
              console.log('[Search Mirror / bing] Got News result]')

              const blurb = $(item)

              const content = blurb.get(0).outerHTML

              const payload = {
                    search_url: window.location.href,
                    content,
                    query,
                    type: queryType,
                    foreground: this.isPrimarySite,
                    engine: 'bing',
                  }

              chrome.runtime.sendMessage({
                'messageType': 'logEvent',
                'event': {
                  'name': 'search-mirror-result-news',
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
          }, 2500)
        }
      }
    }
  }
}

const bingSite = new REXBingSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('bing', bingSite)

export default bingSite
