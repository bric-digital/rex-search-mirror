import rexSearchMirrorPlugin from '@bric/rex-search-mirror/browser'
import searchMirrorGooglePlugin from '@bric/rex-search-mirror/sites/browser/google'
import searchMirrorBingPlugin from '@bric/rex-search-mirror/sites/browser/bing'
import ddgMirrorBingPlugin from '@bric/rex-search-mirror/sites/browser/duckduckgo'

console.log(`[Search Mirror Test] Imported ${rexSearchMirrorPlugin} into the browser context for ${window.location.href}...`)
console.log(`[Search Mirror Test] Imported ${searchMirrorGooglePlugin} into page context...`)
console.log(`[Search Mirror Test] Imported ${searchMirrorBingPlugin} into page context...`)
console.log(`[Search Mirror Test] Imported ${ddgMirrorBingPlugin} into page context...`)

self['rexSearchMirrorPlugin'] = rexSearchMirrorPlugin
