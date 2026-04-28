import $ from 'jquery'

import { DateString, NewsBlurb, Position } from '@bric/rex-types/types'

import mirrorManager, { REXSearchSiteBrowserModule, REXSearchMirrorConfiguration } from '../browser.mjs'

export class REXGoogleSiteBrowserModule extends REXSearchSiteBrowserModule {
  linkCache: Record<string, unknown> = {}
  resultCount = 0
  recordedOverview = false
  recordedNews = false
  isPrimarySite = true

  matchesSearchSite(location: Location): boolean {
    if (['google.com', 'www.google.com'].includes(location.host) === false) {
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

  searchUrl(query: string | null, queryType: string | null): string | null {
    if (query === null) {
      return null
    }

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

  extractQuery(location: Location): string | null {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location: Location): string | null {
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

  extractResults(configuration: REXSearchMirrorConfiguration) {
    if (configuration['debug']) {
      console.log('[Search Mirror / google] Looking for results...')
      console.log(configuration)
    }

    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    if (queryType === 'image') {
      const results = document.querySelectorAll('div[data-ved][data-ow][data-oh]')

      results.forEach((element) => {
        const titles = element.querySelectorAll('h3')

        if (titles.length > 0) {
          const hrefs = element.querySelectorAll('a[target="_blank"]')

          let href: string | null = null

          hrefs.forEach(function (hrefElement) {
            const url = hrefElement.getAttribute('href')

            if (url === null) {
              return
            }

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

      results.forEach((element) => {
        const titles = element.querySelectorAll('h3')
        const cites = element.querySelectorAll('cite')

        if (titles.length > 0 && cites.length > 0) {
          const href = element.getAttribute('href')

          if (href !== null && this.linkCache[href] === undefined) {
            let title = ''

            titles.forEach(function (titleElement) {
              titleElement.childNodes.forEach(function (childNode) {
                if (childNode.nodeType === Node.TEXT_NODE) {
                  title += childNode.nodeValue
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

            const content = (element.parentNode?.parentNode?.parentNode as Element | null | undefined)?.outerHTML ?? ''

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

    if (configuration['include_news_elements']) {
      const newsSvgPath = $('path[d="M489-460l91-55l91,55L647-564l80-69l-105-9l-42-98l-42,98l-105,9l80,69L489-460ZM228-85q-33,5-59.5-15.5T138-154L85-591q-4-33 16-59t53-30l46-6v326q0,66 47,113t113,47H732q-6,24-24,41.5T664-138L228-85ZM360-280q-33,0-56.5-23.5T280-360V-800q0-33 23.5-56.5T360-880H800q33,0 56.5,23.5T880-800v440q0,33-23.5,56.5T800-280H360Z"]')
      
      const overview = $(newsSvgPath).parent().parent().parent().parent().parent().parent().parent().parent().parent()

      overview.find('div[role="heading"]').each((index, element) => {
        const aLink = $(element).parent().parent().parent()

        let href:string|undefined = $(aLink).attr('href')

        const lookupKey = `news-${href}`

        if (href !== undefined && this.linkCache[lookupKey] === undefined) {
          let posted = new DateString(`${Date.now() / 1000}`)
          let source = ''
          let position:Position = {
            'top': -1,
            'left': -1,
            'width': -1,
            'height': -1,
          }

          const boundingBox = $(element).parent().parent()

          if (boundingBox !== undefined) {
            const rect = boundingBox.get(0)?.getBoundingClientRect()

            if (rect !== undefined) {
              position = rect
            }
          }

          $(element).parent().find('span').each((index, spanElement) => {
            if ($(spanElement).attr('data-ts') !== undefined) {
              const timestamp = $(spanElement).attr('data-ts')

              if (timestamp !== undefined) {
                posted = new DateString(timestamp)
              }
            } else if ($(spanElement).attr('aria-label') === 'About this result') {
              // Pass
            } else if (source === '') {
              source = $(spanElement).text()
            }
          })

          const blurb:NewsBlurb = {
            'headline': $(element).text(),
            posted,
            source,
            'authors': [],
            'url': href,
            position
          }

          if (configuration['debug']) {
            console.log('[Search Mirror / google] Found news result]')
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

    if (configuration['include_ai_elements']) {
      if (this.recordedOverview === false) {
        // AI Overview

        this.recordedOverview = true

        window.setTimeout(() => {
          const aiSvgPath = $('ppath[d="M235.5 471C235.5 438.423 229.22 407.807 216.66 379.155C204.492 350.503 187.811 325.579 166.616 304.384C145.421 283.189 120.498 266.508 91.845 254.34C63.1925 241.78 32.5775 235.5 0 235.5C32.5775 235.5 63.1925 229.416 91.845 217.249C120.498 204.689 145.421 187.811 166.616 166.616C187.811 145.421 204.492 120.497 216.66 91.845C229.22 63.1925 235.5 32.5775 235.5 0C235.5 32.5775 241.584 63.1925 253.751 91.845C266.311 120.497 283.189 145.421 304.384 166.616C325.579 187.811 350.503 204.689 379.155 217.249C407.807 229.416 438.423 235.5 471 235.5C438.423 235.5 407.807 241.78 379.155 254.34C350.503 266.508 325.579 283.189 304.384 304.384C283.189 325.579 266.311 350.503 253.751 379.155C241.584 407.807 235.5 438.423 235.5 471Z"]')

          aiSvgPath.each((index, item) => {
            console.log('[Search Mirror / google] Got AI result]')

            const overview = $(item).parent().parent().parent().parent().parent()

            const overviewEl = overview.get(0)
            if (overviewEl === undefined) {
              return
            }
            const content = overviewEl.innerHTML

            const payload = {
                  search_url: window.location.href,
                  content,
                  query,
                  type: queryType,
                  foreground: this.isPrimarySite,
                  engine: 'google',
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

        window.setTimeout(() => {
          const aiSvgPath = $('[data-news-doc-id]')

          aiSvgPath.each((index, item) => {
            console.log('[Search Mirror / google] Got News result]')

            const blurb = $(item)

            const blurbEl = blurb.get(0)
            if (blurbEl === undefined) {
              return
            }
            const content = blurbEl.outerHTML

            const payload = {
                  search_url: window.location.href,
                  content,
                  query,
                  type: queryType,
                  foreground: this.isPrimarySite,
                  engine: 'google',
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

const googleSite = new REXGoogleSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('google', googleSite)

export default googleSite
