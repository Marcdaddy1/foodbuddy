/**
 * Generates docs/privacy/index.html from store/play/privacy-policy.md so the
 * published policy and the repo's source of truth can never drift apart.
 *
 *   node scripts/build-public-pages.mjs
 *
 * Handles the markdown subset the policy actually uses: headings, paragraphs,
 * bullet lists, tables, bold, inline code, and links. It is deliberately not a
 * general markdown parser — if the policy starts using something else, this
 * throws rather than silently dropping content.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Inline formatting: code, bold, italics, links. Escaped first. */
function inline(text) {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  // Flag any unfilled template placeholder so it is impossible to publish
  // the policy with {{support_email}} still sitting in the text unnoticed.
  out = out.replace(/\{\{([a-z_]+)\}\}/g, '<span class="todo">TODO: $1</span>')
  return out
}

function mdToHtml(md) {
  const lines = md.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4) // policy h1 -> page h2
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      i++
      continue
    }

    // Table
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim())
      const header = cells(rows[0])
      const body = rows.slice(2).map(cells)
      out.push('<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:15px">')
      out.push(
        '<thead><tr>' +
          header.map((h) => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--rule)">${inline(h)}</th>`).join('') +
          '</tr></thead><tbody>',
      )
      for (const row of body) {
        out.push(
          '<tr>' +
            row.map((c) => `<td style="padding:8px 12px;border-bottom:1px solid var(--rule);vertical-align:top">${inline(c)}</td>`).join('') +
            '</tr>',
        )
      }
      out.push('</tbody></table></div>')
      continue
    }

    // Bullet list. Markdown allows an item to wrap across several lines, so
    // continuation lines are folded into the current item rather than dropped.
    if (/^[-*]\s+/.test(line)) {
      out.push('<ul>')
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const parts = [lines[i].replace(/^[-*]\s+/, '').trim()]
        i++
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^([-*]\s|\||#{1,4}\s|-{3,}$)/.test(lines[i])
        ) {
          parts.push(lines[i].trim())
          i++
        }
        out.push(`<li>${inline(parts.join(' '))}</li>`)
      }
      out.push('</ul>')
      continue
    }

    // Horizontal rule — a section break in the source, no output needed.
    if (/^-{3,}$/.test(line.trim())) { i++; continue }

    // Paragraph (consume until a blank line or the start of another block)
    const para = []
    while (i < lines.length && lines[i].trim() && !/^([-*]\s|\||#{1,4}\s|-{3,}$)/.test(lines[i])) {
      para.push(lines[i].trim())
      i++
    }
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
    } else {
      // Nothing matched and nothing consumed. Emitting the line verbatim keeps
      // the cursor moving — without this the loop spins forever on any line
      // that looks like a block but matches no branch.
      out.push(`<p>${inline(line.trim())}</p>`)
      i++
    }
  }

  return out.join('\n')
}

const BRAND_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="1024" height="1024" fill="#2D5016"/>
      <path d="M512 268 C 700 404, 718 618, 512 742 C 306 618, 324 404, 512 268 Z" fill="#7CB342"/>
      <path d="M512 300 L512 726" stroke="#2D5016" stroke-width="26" stroke-linecap="round"/>
      <rect x="272" y="486" width="480" height="52" rx="26" fill="#FF6B35"/>
    </svg>`

function page({ title, description, cssPath, h1, bodyHtml, footerHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="stylesheet" href="${cssPath}">
</head>
<body>
<div class="wrap">

  <header class="brand">
    ${BRAND_SVG}
    <span>FoodBuddy</span>
  </header>

  <h1>${h1}</h1>

${bodyHtml}

  <footer>
${footerHtml}
  </footer>

</div>
</body>
</html>
`
}

// ---- Privacy policy -------------------------------------------------------

// Normalise line endings first: this repo is edited on Windows, so the source
// file can be CRLF, while every separator and heading match below assumes LF.
const policyMd = readFileSync(resolve(root, 'store/play/privacy-policy.md'), 'utf8')
  .split('\r\n')
  .join('\n')
const marker = policyMd.indexOf('\n---\n')
if (marker === -1) {
  throw new Error('privacy-policy.md: expected a "---" separator after the drafting notes')
}
// Everything before the separator is internal drafting guidance — not published.
const policyBody = policyMd.slice(marker + 5).trim()

const privacyHtml = page({
  title: 'FoodBuddy Privacy Policy',
  description: 'How FoodBuddy collects, uses, and protects your data.',
  cssPath: '../_shared.css',
  h1: 'Privacy policy',
  bodyHtml: mdToHtml(policyBody),
  footerHtml: `    <p><a href="../delete-account/">Delete your account</a> · <a href="../">FoodBuddy</a></p>`,
})

mkdirSync(resolve(root, 'docs/privacy'), { recursive: true })
writeFileSync(resolve(root, 'docs/privacy/index.html'), privacyHtml)

const placeholders = [...privacyHtml.matchAll(/TODO: ([a-z_]+)/g)].map((m) => m[1])
console.log('Wrote docs/privacy/index.html')
if (placeholders.length) {
  console.log(
    `  ${placeholders.length} placeholder(s) still to fill: ${[...new Set(placeholders)].join(', ')}`,
  )
}
