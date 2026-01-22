import mirrorManager, { WebmunkSearchSiteBrowserModule } from '../browser.mjs'

export class WebmunkBingSiteBrowserModule extends WebmunkSearchSiteBrowserModule {
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

  extractResults() {
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)
    const linkCache = {}
    let isPrimarySite = true
    let resultCount = 0

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
            // console.log(payload)

            chrome.runtime.sendMessage({
              content: 'record_data_point',
              generator: 'search-mirror-result',
              payload: payload // eslint-disable-line object-shorthand
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
            // console.log(payload)

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
  }
}

const bingSite = new WebmunkBingSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('bing', bingSite)

export default bingSite
