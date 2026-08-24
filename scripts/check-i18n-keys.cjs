// 使用中のt()キーとロケール定義の差分を出す
const fs = require('fs')
const path = require('path')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    return /\.tsx$/.test(d.name) && !/locales/.test(p) ? [p] : []
  })
}

const used = new Set()
for (const file of walk(path.join(process.cwd(), 'src/renderer/src'))) {
  const src = fs.readFileSync(file, 'utf8')
  // t('key') / t("key") / t('key', {...}) を抽出
  for (const m of src.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) {
    used.add(m[1])
  }
}

const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  typeof v === 'object' ? flat(v, prefix + k + '.') : [prefix + k]
)

const ja = new Set(flat(JSON.parse(fs.readFileSync('src/renderer/src/locales/ja.json', 'utf8'))))
const en = new Set(flat(JSON.parse(fs.readFileSync('src/renderer/src/locales/en.json', 'utf8'))))

const missingJa = [...used].filter(k => !ja.has(k)).sort()
const missingEn = [...used].filter(k => !en.has(k)).sort()
console.log(`used: ${used.size}, missing in ja: ${missingJa.length}, missing in en: ${missingEn.length}`)
missingJa.forEach(k => console.log('MISSING:', k))
// 未使用キー（参考）
const unused = [...ja].filter(k => !used.has(k) && !['app.title'].includes(k))
console.log(`unused-in-renderer (参考): ${unused.length}`)
