#!/usr/bin/env node

// Turns a captured search results page into a test fixture: removes scripts,
// frames, link elements and account details, and adds a Content-Security-Policy
// that keeps the page from loading anything from the network when a test opens it.
//
// Usage:
//   node tests/scripts/prepare-serp-fixture.mjs <capture.html> <fixture.html> [--redact "text"]...

import { readFile, writeFile } from 'fs/promises'

const CONTENT_SECURITY_POLICY = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; font-src data:"
const REDACTED_TEXT = 'Redacted Account'
const REDACTED_EMAIL = 'redacted@example.com'

function parseArguments (argv) {
  const positional = []
  const redactions = []

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--redact') {
      redactions.push(argv[index + 1])
      index += 1
    } else {
      positional.push(argv[index])
    }
  }

  if (positional.length !== 2 || redactions.includes(undefined)) {
    console.error('Usage: prepare-serp-fixture.mjs <capture.html> <fixture.html> [--redact "text"]...')
    process.exit(1)
  }

  return { input: positional[0], output: positional[1], redactions }
}

function escapeRegExp (text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function prepareFixture (html, redactions) {
  let fixture = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/https:\/\/lh\d\.googleusercontent\.com\/ogw\/[^"'\s)\\]*/g, '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED_EMAIL)

  for (const redaction of redactions) {
    fixture = fixture.replace(new RegExp(escapeRegExp(redaction), 'g'), REDACTED_TEXT)
  }

  const policy = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`

  return fixture.replace(/<head\b[^>]*>/i, (head) => head + policy)
}

const { input, output, redactions } = parseArguments(process.argv.slice(2))

const html = await readFile(input, 'utf8')
const fixture = prepareFixture(html, redactions)

await writeFile(output, fixture)

console.log(`${output}: ${fixture.length} characters, ${redactions.length} redaction(s) applied`)
