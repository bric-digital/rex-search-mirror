import $ from 'jquery'

import { DateString, NewsBlurb, Position } from '@bric/rex-types/types'

import mirrorManager, { REXSearchSiteBrowserModule, REXSearchMirrorConfiguration } from '../browser.mjs'

export class REXDDGSiteBrowserModule extends REXSearchSiteBrowserModule {
  linkCache: Record<string, unknown> = {}
  resultCount = 0
  recordedOverview = false
  recordedNews = false

  constructor() {
    super()
    this.isPrimarySite = true
  }

  matchesSearchSite(location: Location): boolean {
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

  searchUrl(query: string | null, queryType: string | null): string | null {
    if (query === null) {
      return null
    }

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

  extractQuery(location: Location): string | null {
    const params = new URLSearchParams(location.search)

    return params.get('q')
  }

  extractQueryType(location: Location): string {
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

  extractResults(configuration: REXSearchMirrorConfiguration) {
    const query = this.extractQuery(window.location)
    const queryType = this.extractQueryType(window.location)

    if (queryType === 'web') {
      const results = document.querySelectorAll('article[data-nrn="result"]')

      results.forEach((element) => {
        const cites = element.querySelectorAll('[data-testid="result-extras-url-link"]')

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

        this.recordedOverview = true

        window.setTimeout(() => {
          const aiSvgPath = $('li:has(path[d="M3.375 6a.625.625 0 1 0 0-1.25H.625a.625.625 0 1 0 0 1.25zM8.5 9.375c0 .345-.28.625-.625.625H.625a.625.625 0 1 1 0-1.25h7.25c.345 0 .625.28.625.625M10.375 14a.625.625 0 1 0 0-1.25H.625a.625.625 0 1 0 0 1.25z"])')

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
              engine: 'duckduckgo'
            }

            if (configuration.debug) {
              console.log('[Search Mirror / duckduckgo] Found AI result')
              console.log(payload)
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
      const newsList = $('li[data-layout="news"] article')
      
      newsList.each((index, element) => {
        const aLink = $(element).parent()

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

          const boundingBox = $(element)

          if (boundingBox !== undefined) {
            const rect = boundingBox.get(0)?.getBoundingClientRect()

            if (rect !== undefined) {
              position.top = rect.top
              position.left = rect.left
              position.width = rect.width
              position.height = rect.height
            }
          }

          $(element).find('img[height="16"]').each((index, imgElement) => {
            source = $(imgElement).parent().find('span').text()
          })

          $(element).find('div').each((index, divElement) => {
            if ($(divElement).text().endsWith(' ago')) {
              posted = new DateString($(divElement).text())
            }
          })

          const blurb:NewsBlurb = {
            'headline': `${$(element).find('h3').attr('title')}`,
            posted,
            source,
            'authors': [],
            'url': href,
            position,
            engine: 'duckduckgo',
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
  }
}

const ddgSite = new REXDDGSiteBrowserModule()

mirrorManager.registerSearchMirrorSite('duckduckgo', ddgSite)

export default ddgSite
