import mirrorManager, { WebmunkSearchSiteBrowserModule } from '../browser.mjs'

export class WebmunkGoogleSiteBrowserModule extends WebmunkSearchSiteBrowserModule {
  linkCache = {}
  isPrimarySite = true
  resultCount = 0

  matchesSearchSite(location):boolean {
    console.log(`google matchesSearchSite: ${location}`)

    if (['google.com', 'www.google.com'].includes(location.host) === false) {
      return false
    }

    if (location.href.includes('/uviewer')) {
      return false
    }

    const searchQuery = this.extractQuery(location)

    console.log(`google searchQuery: ${searchQuery}`)

    if (searchQuery === null || searchQuery === undefined || searchQuery === '') {
      return false
    }

    return true
  }

  searchUrl(query, queryType):string|null {
    if (queryType === 'image') {
      return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query)
    }

    if (queryType === 'news') {
      return 'https://www.google.com/search?tbm=nws&q=' + encodeURIComponent(query)
    }

    if (queryType === 'shopping') {
      return 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(query)
    }

    return 'https://www.google.com/search?q=' + encodeURIComponent(query)
  }

  extractQuery(location) {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location) {
    const params = new URLSearchParams(location.search)

    const tbm = params.get('tbm')

    if (tbm === 'isch') {
      return 'image'
    }

    if (tbm === 'nws') {
      return 'news'
    }

    if (tbm === 'shop') {
      return 'shopping'
    }

    return 'web'
  }

  extractResults() {
    console.log('google extractResults')
    console.log(this)
    console.log(window.location)
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    console.log(`google query: ${query} -- queryType: ${queryType}`)

    if (queryType === 'image') {
      const results = document.querySelectorAll('div[data-ved][data-ow][data-oh]')

      results.forEach((element) => {
        const titles = element.querySelectorAll('h3')

        if (titles.length > 0) {
          const hrefs = element.querySelectorAll('a[target="_blank"]')

          let href = null

          hrefs.forEach(function (hrefElement) {
            const url = hrefElement.getAttribute('href')

            const lowerUrl = url.toLowerCase()

            if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
              href = url
            }
          })

          if (href !== null && this.linkCache[href] === undefined) {
            let title = ''

            titles.forEach(function (titleElement) {
              titleElement.childNodes.forEach(function (childNode) {
                if (childNode.nodeType === Node.TEXT_NODE) {
                  title += childNode.nodeValue
                }
              })
            })

            let imageHref = null

            const images = element.querySelectorAll('img[alt][width][height]')

            images.forEach(function (image) {
              if (image.getAttribute('src') !== null) {
                imageHref = image.getAttribute('src')
              }
            })

            const content = element.outerHTML

            this.resultCount += 1

            const payload = {
              title,
              link: href,
              search_url: window.location.href,
              'image_url@': imageHref,
              content,
              query,
              type: queryType,
              foreground: this.isPrimarySite,
              engine: 'google',
              index: this.resultCount
            }

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
    } else if (queryType === 'web') {
      const results = document.querySelectorAll('a[href][data-ved][ping]')

      console.log(`google web: ${results.length}`)

      results.forEach((element) => {
        const titles = element.querySelectorAll('h3')
        const cites = element.querySelectorAll('cite')

        console.log(`google titles: ${titles.length}`)

        if (titles.length > 0 && cites.length > 0) {
          const href = element.getAttribute('href')

          if (this.linkCache[href] === undefined) {
            let title = ''

            titles.forEach(function (titleElement) {
              titleElement.childNodes.forEach(function (childNode) {
                if (childNode.nodeType === Node.TEXT_NODE) {
                  title += childNode.nodeValue
                }
              })
            })

            console.log(`google title: ${title}`)

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

            console.log(`google citation: ${citation}`)

            const content = (element.parentNode.parentNode.parentNode as Element).outerHTML

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
              engine: 'google',
              index: this.resultCount
            }

            console.log('[Search Mirror / google] Got result[' + this.resultCount + ']: ' + title)
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
  }
}

const googleSite = new WebmunkGoogleSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('google', googleSite)

export default googleSite
