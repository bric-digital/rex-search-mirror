// @ts-nocheck

// Implements the necessary functionality to load the REX modules into the 
// extension background service worker context.

import rexCorePlugin from '@bric/rex-core/service-worker'
import rexSearchMirrorPlugin from '@bric/rex-search-mirror/service-worker'

console.log(`Imported ${rexCorePlugin} into service worker context...`)
console.log(`Imported ${rexSearchMirrorPlugin} into service worker context...`)

self['rexCorePlugin'] = rexCorePlugin
self['rexSearchMirrorPlugin'] = rexSearchMirrorPlugin

rexCorePlugin.setup()
