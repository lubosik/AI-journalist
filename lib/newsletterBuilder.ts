/**
 * TypeScript port of the Herald Python newsletter builder.
 * Replicates the same HTML output as:
 *   /root/projects/herald/newsletter/builder.py
 *   /root/projects/herald/newsletter/sections.py
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Section {
  id: string
  title?: string
  content: string
  locked?: boolean
  word_count?: number
  voice_score?: number
}

export interface Visual {
  placement: string
  url: string
  alt?: string
  caption?: string
}

export interface BuildParams {
  sections: Section[]
  visuals: Visual[]
  issueNumber: number
  subjectLine: string
  weekStart?: string | null
  deals?: { supply: string[]; demand: string[] }
}

// ---------------------------------------------------------------------------
// Design tokens (matching sections.py)
// ---------------------------------------------------------------------------

const BG_WHITE = '#F5F0E8'
const COLOR_PRIMARY = '#1A1A1A'
const COLOR_ACCENT = '#D0C8B8'
const COLOR_NAVY = '#2A2A2A'
const COLOR_MUTED = '#666666'
const COLOR_ALT_ROW = '#EDE8DC'
const COLOR_TABLE_HEADER_BG = '#1A1A1A'
const COLOR_TABLE_HEADER_TEXT = '#F5F0E8'
const FONT_SERIF = "Georgia, 'Times New Roman', serif"
const FONT_SANS = 'Arial, Helvetica, sans-serif'
const MAX_WIDTH = '600px'

// Fixed editorial section order: [id, defaultTitle, bgColor]
const SECTION_ORDER: Array<[string, string, string]> = [
  ['tldr', 'TL;DR', '#1a1a2e'],
  ['lead', 'The Lead', '#ffffff'],
  ['market_pulse', 'Market Pulse', '#f8f6f0'],
  ['angle', 'The Angle', '#ffffff'],
]

// ---------------------------------------------------------------------------
// HTML escaping utilities (no external deps)
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Week string builder
// ---------------------------------------------------------------------------

function buildWeekStr(weekStart: string | null | undefined): string {
  const fallback = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  if (!weekStart) return fallback
  try {
    const start = new Date(weekStart)
    if (isNaN(start.getTime())) return fallback
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const startMonth = start.toLocaleString('en-US', { month: 'long' })
    const endMonth = end.toLocaleString('en-US', { month: 'long' })
    const year = start.getFullYear()

    if (start.getMonth() === end.getMonth()) {
      return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`
    } else {
      return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`
    }
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Container helpers
// ---------------------------------------------------------------------------

function containerOpen(maxWidth: string = MAX_WIDTH, bg: string = BG_WHITE): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:${bg};">` +
    `<tr><td align="center" style="padding:0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="${maxWidth}" style="max-width:${maxWidth};width:100%;background:${bg};">` +
    `<tr><td style="padding:0 24px;">`
  )
}

function containerClose(): string {
  return '</td></tr></table></td></tr></table>'
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

export function renderHeader(
  issueNumber: number,
  weekStr: string,
  subject: string,
  headerImageUrl?: string | null,
): string {
  const parts: string[] = []

  parts.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:${BG_WHITE};">` +
    `<tr><td align="center" style="padding:0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="${MAX_WIDTH}" style="max-width:${MAX_WIDTH};width:100%;background:${BG_WHITE};">` +
    `<tr><td style="padding:40px 24px 24px 24px;text-align:center;">`
  )

  if (headerImageUrl) {
    const safeUrl = escapeAttr(headerImageUrl)
    parts.push(
      `<img src="${safeUrl}" alt="Newsletter header" ` +
      `style="display:block;margin:0 auto 20px auto;max-width:100%;height:auto;" />`
    )
  }

  parts.push(
    `<h1 style="margin:0;border-bottom:3px solid ${COLOR_PRIMARY};padding-bottom:16px;` +
    `font-family:${FONT_SERIF};font-size:36px;font-weight:900;color:${COLOR_PRIMARY};letter-spacing:0;">` +
    `ROFR'd` +
    `</h1>` +
    `<p style="margin:10px 0 24px 0;font-family:${FONT_SANS};font-size:11px;` +
    `letter-spacing:2px;text-transform:uppercase;color:${COLOR_MUTED};">` +
    `Pre-IPO Secondaries &bull; ${escapeHtml(weekStr)} &bull; 3 min read` +
    `</p>`
  )

  const safeSubject = escapeHtml(subject)
  parts.push(
    `<p style="margin:0;font-family:${FONT_SERIF};font-size:18px;` +
    `font-weight:700;color:${COLOR_PRIMARY};line-height:1.45;">` +
    `${safeSubject}` +
    `</p>`
  )

  parts.push('</td></tr></table></td></tr></table>')
  return parts.join('')
}

export function renderContents(sections: Array<{ id: string; title?: string }>): string {
  if (!sections || sections.length === 0) return ''

  const parts: string[] = []
  parts.push(containerOpen())
  parts.push(
    `<div style="padding:24px 0 16px 0;">` +
    `<p style="margin:0 0 12px 0;font-family:${FONT_SANS};font-size:10px;` +
    `letter-spacing:3px;text-transform:uppercase;color:${COLOR_ACCENT};">` +
    `IN THIS ISSUE` +
    `</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
  )

  sections.forEach((section, idx) => {
    const sectionId = escapeAttr(section.id || '')
    const title = escapeHtml(section.title || 'Untitled')
    const bg = (idx + 1) % 2 !== 0 ? BG_WHITE : COLOR_ALT_ROW
    parts.push(
      `<tr style="background:${bg};">` +
      `<td style="padding:8px 12px;font-family:${FONT_SERIF};font-size:14px;color:${COLOR_MUTED};">` +
      `${String(idx + 1).padStart(2, '0')}.` +
      `</td>` +
      `<td style="padding:8px 4px 8px 0;font-family:${FONT_SERIF};font-size:14px;">` +
      `<a href="#${sectionId}" ` +
      `style="color:${COLOR_PRIMARY};text-decoration:none;border-bottom:1px solid ${COLOR_ACCENT};">` +
      `${title}` +
      `</a>` +
      `</td>` +
      `</tr>`
    )
  })

  parts.push('</table>')
  parts.push(
    `<div style="height:1px;background:${COLOR_ACCENT};margin:16px 0 0 0;"></div>` +
    `</div>`
  )
  parts.push(containerClose())
  return parts.join('')
}

export function renderSection(
  sectionId: string,
  title: string,
  content: string,
  bgColor: string,
): string {
  const safeId = escapeAttr(sectionId)
  const safeTitle = escapeHtml(title)

  // Pre-process story headlines — Hermes outputs "### Headline ###" for per-story headlines
  function renderHeadlines(text: string): string {
    return text.replace(/###\s*(.+?)\s*###/g, (_match: string, headlineText: string) => {
      const escaped = escapeHtml(headlineText.trim())
      return (
        `<p style="font-family:${FONT_SERIF};font-size:19px;font-weight:700;` +
        `line-height:1.35;color:${COLOR_PRIMARY};padding-bottom:12px;` +
        `padding-top:16px;margin:0 0 12px 0;">` +
        `${escaped}</p>`
      )
    })
  }

  let processedContent = content
  if (!processedContent.trim().startsWith('<')) {
    processedContent = renderHeadlines(processedContent)
  }

  let bodyHtml: string
  if (processedContent.trim().startsWith('<')) {
    bodyHtml = processedContent
  } else {
    const escaped = escapeHtml(processedContent)
    const paraStyle = `font-family:${FONT_SERIF};font-size:15px;line-height:1.75;color:#2A2A2A;`
    bodyHtml =
      `<p style="margin:0 0 16px 0;${paraStyle}">` +
      escaped
        .replace(/\n\n/g, `</p><p style="margin:0 0 16px 0;${paraStyle}">`)
        .replace(/\n/g, '<br>') +
      `</p>`
  }

  const parts: string[] = []
  parts.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:${bgColor};">` +
    `<tr><td align="center" style="padding:0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="${MAX_WIDTH}" style="max-width:${MAX_WIDTH};width:100%;background:${bgColor};">` +
    `<tr><td style="padding:32px 24px;">`
  )

  parts.push(`<a name="${safeId}" id="${safeId}" style="display:block;"></a>`)

  parts.push(
    `<p style="margin:0 0 12px 0;font-family:${FONT_SANS};font-size:10px;` +
    `font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999999;` +
    `border-top:1px solid ${COLOR_ACCENT};padding-top:24px;">` +
    `${safeTitle}` +
    `</p>`
  )

  parts.push(bodyHtml)
  parts.push('</td></tr></table></td></tr></table>')
  return parts.join('')
}

export function renderTldrSection(content: string): string {
  const BG = '#EDE8DC'
  const TEXT = COLOR_PRIMARY

  const parts: string[] = []
  parts.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:${BG};">` +
    `<tr><td align="center" style="padding:0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="${MAX_WIDTH}" style="max-width:${MAX_WIDTH};width:100%;background:${BG};">` +
    `<tr><td style="padding:20px 24px 20px 24px;border-left:4px solid ${COLOR_PRIMARY};">`
  )

  parts.push('<a name="tldr" id="tldr" style="display:block;"></a>')

  parts.push(
    `<p style="margin:0 0 14px 0;font-family:${FONT_SANS};font-size:10px;` +
    `font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#999999;">` +
    `TL;DR` +
    `</p>`
  )

  let body: string
  if (content.trim().startsWith('<')) {
    body = content
  } else {
    const lines = content.trim().split('\n').map(l => l.trim()).filter(Boolean)
    body = lines
      .map(line => {
        const stripped = line.replace(/^[-—*•\s]+/, '')
        return (
          `<p style="margin:0 0 8px 0;font-family:${FONT_SERIF};font-size:14px;` +
          `line-height:1.7;color:${TEXT};">` +
          `&#8212; ${escapeHtml(stripped)}</p>`
        )
      })
      .join('')
  }

  parts.push(body)
  parts.push('</td></tr></table></td></tr></table>')
  return parts.join('')
}

export function renderSupplyDemandBlock(supply: string[], demand: string[]): string {
  const GOLD = '#c9a84c'

  function renderItems(items: string[]): string {
    if (!items || items.length === 0) {
      return (
        `<p style="font-family:${FONT_SERIF};font-size:14px;` +
        `color:${COLOR_MUTED};font-style:italic;margin:0 0 20px 0;">` +
        `No deals listed yet.` +
        `</p>`
      )
    }
    return items
      .map(item => (
        `<p style="font-family:${FONT_SERIF};font-size:15px;` +
        `line-height:1.65;color:${COLOR_PRIMARY};` +
        `margin:0 0 10px 0;padding-left:14px;` +
        `border-left:2px solid ${GOLD};">` +
        escapeHtml(item.trim()) +
        `</p>`
      ))
      .join('')
  }

  const supplyHtml = renderItems(supply || [])
  const demandHtml = renderItems(demand || [])

  return (
    `<div style="margin-top:28px;border-top:1px solid ${COLOR_ACCENT};padding-top:24px;">` +
    `<p style="font-family:${FONT_SANS};font-size:10px;font-weight:700;` +
    `letter-spacing:3px;text-transform:uppercase;color:#999999;margin:0 0 14px 0;">` +
    `SUPPLY` +
    `</p>` +
    supplyHtml +
    `<p style="font-family:${FONT_SANS};font-size:10px;font-weight:700;` +
    `letter-spacing:3px;text-transform:uppercase;color:#999999;margin:20px 0 14px 0;">` +
    `DEMAND` +
    `</p>` +
    demandHtml +
    `</div>`
  )
}

export function renderImageBlock(imageUrl: string, caption?: string, alt?: string): string {
  const safeUrl = escapeAttr(imageUrl)
  const safeAlt = escapeHtml(alt || '')

  const parts: string[] = []
  parts.push(containerOpen())
  parts.push(
    `<div style="padding:24px 0;text-align:center;">` +
    `<img src="${safeUrl}" alt="${safeAlt}" ` +
    `style="display:block;max-width:100%;height:auto;margin:0 auto;` +
    `border:1px solid #e8e4dc;" />`
  )

  if (caption) {
    const safeCaption = escapeHtml(caption)
    parts.push(
      `<p style="margin:10px 0 0 0;font-family:${FONT_SANS};font-size:11px;` +
      `color:${COLOR_MUTED};font-style:italic;text-align:center;">` +
      `${safeCaption}` +
      `</p>`
    )
  }

  parts.push('</div>')
  parts.push(containerClose())
  return parts.join('')
}

const DEFAULT_FOOTER_NOTE = "You know a name I should? Hit reply.\n\n— D"

export function renderFooter(footerNote?: string): string {
  const currentYear = new Date().getFullYear()
  const note = (footerNote || DEFAULT_FOOTER_NOTE).trim()
  const noteHtml = escapeHtml(note).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')

  const parts: string[] = []
  parts.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:${BG_WHITE};margin-top:16px;">` +
    `<tr><td align="center" style="padding:0;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="${MAX_WIDTH}" style="max-width:${MAX_WIDTH};width:100%;background:${BG_WHITE};">` +
    `<tr><td style="padding:24px 24px 40px 24px;text-align:left;` +
    `border-top:1px solid ${COLOR_ACCENT};">`
  )

  parts.push(
    `<p style="margin:0 0 20px 0;font-family:${FONT_SERIF};font-size:15px;` +
    `line-height:1.75;color:${COLOR_NAVY};">` +
    noteHtml +
    `</p>`
  )

  parts.push(
    `<p style="margin:0 0 12px 0;font-family:${FONT_SANS};font-size:11px;` +
    `color:${COLOR_MUTED};">` +
    `<a href="{{unsubscribe_url}}" ` +
    `style="color:${COLOR_MUTED};text-decoration:underline;">Unsubscribe</a>` +
    ` &nbsp;|&nbsp; ` +
    `<a href="{{manage_preferences_url}}" ` +
    `style="color:${COLOR_MUTED};text-decoration:underline;">Manage preferences</a>` +
    `</p>`
  )

  parts.push(
    `<p style="margin:0;font-family:${FONT_SANS};font-size:10px;` +
    `color:${COLOR_MUTED};line-height:1.6;">` +
    `&copy; ${currentYear} The Secondaries Intelligence Report. All rights reserved.<br>` +
    `For informational purposes only. Not investment advice.<br>` +
    `Strictly private circulation — VC secondaries market intelligence.` +
    `</p>`
  )

  parts.push('</td></tr></table></td></tr></table>')
  return parts.join('')
}

// ---------------------------------------------------------------------------
// Document wrapper
// ---------------------------------------------------------------------------

function wrapDocument(bodyHtml: string): string {
  return (
    `<!DOCTYPE html>` +
    `<html lang="en">` +
    `<head>` +
    `<meta charset="UTF-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` +
    `<meta http-equiv="X-UA-Compatible" content="IE=edge" />` +
    `</head>` +
    `<body style="margin:0;padding:0;background:#F5F0E8;` +
    `font-family:Georgia,'Times New Roman',serif;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `width="100%" style="background:#F5F0E8;padding:0;">` +
    `<tr><td align="center">` +
    bodyHtml +
    `</td></tr></table>` +
    `</body>` +
    `</html>`
  )
}

// ---------------------------------------------------------------------------
// Helper: find visual by placement
// ---------------------------------------------------------------------------

function findVisual(visuals: Visual[], placement: string): Visual | undefined {
  return visuals.find(v => v.placement === placement)
}

// ---------------------------------------------------------------------------
// Plain text builder (strips HTML tags)
// ---------------------------------------------------------------------------

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&copy;/g, '(c)')
    .replace(/ {2,}/g, ' ')
    .trim()
}

export function buildPlainText(
  sections: Section[],
  deals?: { supply: string[]; demand: string[] },
): string {
  const sectionsById: Record<string, Section> = {}
  for (const s of sections) {
    if (s.id) sectionsById[s.id] = s
  }

  const lines: string[] = []
  lines.push('='.repeat(60))
  lines.push('The Secondaries Intelligence Report')
  lines.push('='.repeat(60))
  lines.push('')

  for (const [sid, defaultTitle] of SECTION_ORDER) {
    const sectionData = sectionsById[sid]
    if (!sectionData) continue

    const title = sectionData.title || defaultTitle
    const content = sectionData.content || ''

    lines.push(`[ ${title.toUpperCase()} ]`)
    lines.push('-'.repeat(40))

    if (content) {
      const clean = stripHtml(content).replace(/\n{3,}/g, '\n\n')
      lines.push(clean)
    }
    lines.push('')
  }

  // Standalone deals block
  const supply = deals?.supply || []
  const demand = deals?.demand || []
  lines.push('[ DEALS ]')
  lines.push('-'.repeat(40))
  lines.push('Supply:')
  if (supply.length) {
    for (const item of supply) lines.push(`  - ${item}`)
  } else {
    lines.push('  (none listed)')
  }
  lines.push('')
  lines.push('Demand:')
  if (demand.length) {
    for (const item of demand) lines.push(`  - ${item}`)
  } else {
    lines.push('  (none listed)')
  }
  lines.push('')

  lines.push('='.repeat(60))
  lines.push('The Secondaries Intelligence Report')
  lines.push('='.repeat(60))

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildNewsletterHTML(params: BuildParams): Promise<string> {
  const { sections, visuals, issueNumber, subjectLine, weekStart, deals } = params

  const weekStr = buildWeekStr(weekStart)

  // Index sections by id
  const sectionsById: Record<string, Section> = {}
  for (const s of sections) {
    if (s.id) sectionsById[s.id] = s
  }

  // Build a placement index: placement_key -> Visual.
  // Only index visuals that have a real URL — skip failed generation placeholders.
  // Supported placements:
  //   "top"              -> header banner image
  //   "after_<section>"  -> injected immediately after that section
  //   "before_deals"     -> injected before the Deals block
  //   "bottom"           -> injected after Deals, before footer
  const visualsByPlacement: Record<string, Visual> = {}
  for (const v of visuals) {
    if (v.placement && v.url?.trim()) visualsByPlacement[v.placement] = v
  }

  const headerImageUrl = visualsByPlacement['top']?.url ?? null

  // Build TOC from fixed order, only sections that have data
  const tocSections: Array<{ id: string; title?: string }> = []
  for (const [sid, defaultTitle] of SECTION_ORDER) {
    if (sectionsById[sid]) {
      tocSections.push({ id: sid, title: sectionsById[sid].title || defaultTitle })
    }
  }

  const parts: string[] = []

  // 1. Header
  parts.push(renderHeader(issueNumber, weekStr, subjectLine, headerImageUrl))

  // 2. Table of contents (only if more than 3 sections)
  if (tocSections.length > 3) {
    parts.push(renderContents(tocSections))
  }

  // 3. Sections in fixed editorial order.  After each section, inject any
  //    visual whose placement is "after_<section_id>".
  for (const [sid, defaultTitle, bgColor] of SECTION_ORDER) {
    const sectionData = sectionsById[sid]
    if (!sectionData) continue

    const title = sectionData.title || defaultTitle
    const content = sectionData.content || ''

    if (sid === 'tldr') {
      parts.push(renderTldrSection(content))
    } else {
      parts.push(renderSection(sid, title, content, bgColor))
    }

    // Inject visual placed after this section, if any.
    const afterVisual = visualsByPlacement[`after_${sid}`]
    if (afterVisual) {
      parts.push(renderImageBlock(afterVisual.url, afterVisual.caption, afterVisual.alt))
    }
  }

  // 4. Optional image before the Deals block.
  const beforeDealsVisual = visualsByPlacement['before_deals']
  if (beforeDealsVisual) {
    parts.push(renderImageBlock(beforeDealsVisual.url, beforeDealsVisual.caption, beforeDealsVisual.alt))
  }

  // 5. Standalone Deals section
  const supply = deals?.supply || []
  const demand = deals?.demand || []
  const sdHtml = renderSupplyDemandBlock(supply, demand)
  parts.push(renderSection('deals_block', 'Deals', sdHtml, '#f8f6f0'))

  // 6. Optional image after Deals (bottom placement).
  const bottomVisual = visualsByPlacement['bottom']
  if (bottomVisual) {
    parts.push(renderImageBlock(bottomVisual.url, bottomVisual.caption, bottomVisual.alt))
  }

  // 7. Footer — use custom sign-off from a 'footer' section if present
  const footerSection = sectionsById['footer']
  parts.push(renderFooter(footerSection?.content))

  const bodyHtml = parts.join('')
  return wrapDocument(bodyHtml)
}
