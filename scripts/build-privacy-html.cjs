#!/usr/bin/env node
/**
 * build-privacy-html.cjs - 把 docs/privacy-policy.md 渲染为 docs/privacy-policy.html
 *
 * 用途：GitHub Pages 提供隐私政策的可访问 URL，供小程序隐私接口合规使用。
 * 不依赖任何 npm 包，使用极简 markdown 子集转换（标题、列表、表格、引用、段落）。
 *
 * 运行：node scripts/build-privacy-html.cjs
 */

const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '..', 'docs', 'privacy-policy.md')
const DST = path.resolve(__dirname, '..', 'docs', 'privacy-policy.html')

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(text) {
  let t = escapeHtml(text)
  // 加粗 **xxx**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // 斜体 *xxx*
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // 行内代码 `xxx`
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  // 链接 [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return t
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let inTable = false
  let tableRows = []

  function flushTable() {
    if (!inTable) return
    if (tableRows.length) {
      out.push('<table class="pp-table">')
      // 第一行表头；第二行分隔行（跳过）
      const header = tableRows[0]
      out.push('<thead><tr>' + header.map(c => `<th>${inline(c.trim())}</th>`).join('') + '</tr></thead>')
      const bodyRows = tableRows.slice(2) // skip separator
      out.push('<tbody>')
      for (const r of bodyRows) {
        out.push('<tr>' + r.map(c => `<td>${inline(c.trim())}</td>`).join('') + '</tr>')
      }
      out.push('</tbody></table>')
    }
    inTable = false
    tableRows = []
  }

  while (i < lines.length) {
    const line = lines[i]
    // 表格
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true
      tableRows.push(line.trim().slice(1, -1).split('|'))
      i++
      continue
    } else {
      flushTable()
    }
    // 分隔线
    if (/^---+$\s*$/.test(line.trim())) {
      i++
      continue
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      i++
      continue
    }
    // 引用
    if (line.startsWith('>')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${inline(quoteLines.join(' '))}</blockquote>`)
      continue
    }
    // 无序列表
    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    // 有序列表
    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    // 空行
    if (line.trim() === '') {
      i++
      continue
    }
    // 段落
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s/.test(lines[i]) && !line.startsWith('|') && !lines[i].startsWith('>') && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim())) {
      para.push(lines[i])
      i++
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  flushTable()

  return out.join('\n')
}

const template = (body) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>《十亿个什么与为什么》小程序隐私保护政策</title>
  <meta name="description" content="十亿个什么与为什么小程序隐私保护政策 - 面向 2-6 岁儿童及其家长的未成年人保护方案">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 820px; margin: 0 auto; padding: 24px 16px 80px; color: #222; line-height: 1.75; background: #FAFAF7; }
    h1 { font-size: 26px; color: #1A5C3A; border-bottom: 3px solid #1A5C3A; padding-bottom: 12px; }
    h2 { font-size: 22px; color: #1A5C3A; margin-top: 32px; border-left: 4px solid #1A5C3A; padding-left: 12px; }
    h3 { font-size: 18px; color: #333; margin-top: 24px; }
    blockquote { background: #E8F5E9; border-left: 4px solid #1A5C3A; margin: 12px 0; padding: 12px 16px; color: #555; }
    .pp-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .pp-table th, .pp-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .pp-table th { background: #1A5C3A; color: #fff; }
    .pp-table tr:nth-child(even) { background: #F5F5F5; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    a { color: #1A5C3A; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    p { margin: 8px 0; }
    footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 13px; color: #888; text-align: center; }
  </style>
</head>
<body>
${body}
<footer>
  © 2026 十亿个什么与为什么 · 本页面由 docs/privacy-policy.md 自动生成（scripts/build-privacy-html.cjs）
</footer>
</body>
</html>
`

if (!fs.existsSync(SRC)) {
  console.error('[build-privacy-html] 源文件不存在:', SRC)
  process.exit(1)
}

const md = fs.readFileSync(SRC, 'utf8')
const body = mdToHtml(md)
const html = template(body)
fs.writeFileSync(DST, html, 'utf8')
console.log('[build-privacy-html] 已生成:', DST, '(' + html.length + ' bytes)')
