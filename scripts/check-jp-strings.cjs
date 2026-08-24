// ユーザー表示文字列として残存する日本語を検出する（コメント行は除外）
const fs = require('fs')
const path = require('path')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    return /\.(tsx|ts)$/.test(d.name) && !/locales/.test(p) ? [p] : []
  })
}

const hits = []
for (const file of walk(path.join(process.cwd(), 'src/renderer/src'))) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  let inBlock = false
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false
      return
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true
      return
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
    // 行末のコメントを除去してから判定
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    const cjk = code.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/)
    if (cjk) hits.push(`${path.relative(process.cwd(), file)}:${idx + 1}: ${trimmed.slice(0, 80)}`)
  })
}

console.log(`remaining JP-in-code lines: ${hits.length}`)
hits.forEach(h => console.log(h))
