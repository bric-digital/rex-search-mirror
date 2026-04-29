import $ from 'jquery'

import { DateString, NewsBlurb, Position } from '@bric/rex-types/types'

import mirrorManager, { REXSearchSiteBrowserModule, REXSearchMirrorConfiguration } from '../browser.mjs'

export class REXBingSiteBrowserModule extends REXSearchSiteBrowserModule {
  linkCache: Record<string, unknown> = {}
  resultCount = 0
  recordedOverview = false
  recordedNews = false

  constructor() {
    super()
    this.isPrimarySite = true
  }

  matchesSearchSite(location: Location): boolean {
    if (['bing.com', 'www.bing.com'].includes(location.host) === false) {
      return false
    }

    const searchQuery = this.extractQuery(location)

    if (searchQuery === null || searchQuery === undefined || searchQuery === '') {
      return false
    }

    return true
  }

  searchUrl(query: string | null, queryType: string | null): string | null {
    if (query === null) {
      return null
    }

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

  extractQuery(location: Location): string | null {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location: Location): string {
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

  extractResults(configuration: REXSearchMirrorConfiguration) {
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    if (queryType === 'web') {
      const results = document.querySelectorAll('li.b_algo')

      results.forEach((element) => {
        const cites = element.querySelectorAll('cite')
        const titles = element.querySelectorAll('h2')

        if (titles.length > 0 && cites.length > 0) {
          let title = ''
          let href: string | null = null

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

      results.forEach((element) => {
        const titles = element.querySelectorAll('a[title]')

        if (titles.length > 0) {
          let title = ''
          let href: string | null = null

          titles.forEach(function (titleElement) {
            title += titleElement.getAttribute('title')
          })

          const hrefs = element.querySelectorAll('a.iusc')

          hrefs.forEach(function (hrefElement) {
            const metadataRaw = hrefElement.getAttribute('m')
            if (metadataRaw === null) {
              return
            }

            const metadata = JSON.parse(metadataRaw)

            if (metadata !== null) {
              href = metadata.purl
            }
          })

          let imageHref: string | null = null

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
            const aiEl = $(item).get(0)
            if (aiEl === undefined) {
              return
            }
            const content = aiEl.innerHTML

            const payload = {
              search_url: window.location.href,
              content,
              query,
              type: queryType,
              foreground: this.isPrimarySite,
              engine: 'bing'
            }

            if (configuration.debug) {
              console.log('[Search Mirror / duckduckgo] Found AI result')
              console.log(payload)
            }

            chrome.runtime.sendMessage({
              'messageType': 'logEvent',
              'event': {
                'name': 'search-mirror-result-ai',
                payload,
                engine: 'bing',
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
          '.nscardlite_main'
        ]

        for (const selector of selectors) {
          window.setTimeout(() => {
            const newsPath = $(selector)

            if (selector === '.nslist_card_main') {
              newsPath.each((index, item) => {
                const urlElement = $(item).parent().parent().parent()

                const href = urlElement.attr('url')

                const lookupKey = `news-${href}`

                if (href !== undefined && this.linkCache[lookupKey] === undefined) {
                  console.log('[Search Mirror / bing] Got news result')

                  let posted = new DateString(`${Date.now() / 1000}`)
                  let source = ''
                  let position:Position = {
                    'top': -1,
                    'left': -1,
                    'width': -1,
                    'height': -1,
                  }

                  const boundingBox = $(item)

                  if (boundingBox !== undefined) {
                    const rect = boundingBox.get(0)?.getBoundingClientRect()

                    if (rect !== undefined) {
                      position.top = rect.top
                      position.left = rect.left
                      position.width = rect.width
                      position.height = rect.height
                    }
                  }

                  $(item).find('cite').each((index, citeElement) => {
                    const title = $(citeElement).attr('title')

                    if (title !== undefined) {
                      source = title
                    }
                  })

                  $(item).find('span.cap_txt').each((index, dateElement) => {
                    posted = new DateString($(dateElement).text())
                  })

                  const blurb:NewsBlurb = {
                    'headline': $(item).find('.nslist_card_title').text(),
                    posted,
                    source,
                    'authors': [],
                    'url': href,
                    position,
                    engine: 'bing',
                  }

                  if (configuration.debug) {
                    console.log('[Search Mirror / duckduckgo] Found news result')
                    console.log(blurb)
                  }

                  chrome.runtime.sendMessage({
                    'messageType': 'logEvent',
                    'event': {
                      'name': 'search-mirror-result-news',
                      'payload': blurb
                    }
                  })

                  this.linkCache[lookupKey] = blurb
                }
              })
            } else if (selector === '.nscardlite_main') {
              newsPath.each((index, item) => {
                const urlElement = $(item).parent()

                const href = urlElement.attr('url')

                const lookupKey = `news-${href}`

                if (href !== undefined && this.linkCache[lookupKey] === undefined) {
                  console.log('[Search Mirror / bing] Got news result')

                  let posted = new DateString(`${Date.now() / 1000}`)
                  let source = ''
                  let position:Position = {
                    'top': -1,
                    'left': -1,
                    'width': -1,
                    'height': -1,
                  }

                  const boundingBox = $(item)

                  if (boundingBox !== undefined) {
                    const rect = boundingBox.get(0)?.getBoundingClientRect()

                    if (rect !== undefined) {
                      position.top = rect.top
                      position.left = rect.left
                      position.width = rect.width
                      position.height = rect.height
                    }
                  }

                  $(item).find('cite').each((index, citeElement) => {
                    const title = $(citeElement).attr('title')

                    if (title !== undefined) {
                      source = title
                    }
                  })

                  $(item).find('span.cap_txt').each((index, dateElement) => {
                    posted = new DateString($(dateElement).text())
                  })

                  const blurb:NewsBlurb = {
                    'headline': $(item).find('.nscardlite_title').text(),
                    posted,
                    source,
                    'authors': [],
                    'url': href,
                    position,
                    engine: 'bing',
                  }

                  if (configuration.debug) {
                    console.log('[Search Mirror / duckduckgo] Found news result')
                    console.log(blurb)
                  }

                  chrome.runtime.sendMessage({
                    'messageType': 'logEvent',
                    'event': {
                      'name': 'search-mirror-result-news',
                      'payload': blurb
                    }
                  })

                  this.linkCache[lookupKey] = blurb
                }
              })
            }
          }, 2500)
        }
      }
    }
  }
}

const bingSite = new REXBingSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('bing', bingSite)

export default bingSite
