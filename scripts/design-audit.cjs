/* プログラマティック・デザイン監査 v3
 * 使い方: npx electron scripts/design-audit.cjs
 * 各ビューの DOM メトリクスを JSON で出力する（画像非対応モデル向けの証拠収集）
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')

async function main() {
  await app.whenReady()
  const win = new BrowserWindow({ width: 960, height: 700, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  await win.loadURL('file://' + path.join(process.cwd(), 'out', 'renderer', 'index.html').replace(/\\/g, '/'))
  await new Promise(r => setTimeout(r, 4200))

  const clickSidebar = async (label) => {
    await win.webContents.executeJavaScript(`(() => { const els = Array.from(document.querySelectorAll('nav button')); const el = els.find(e => (e.textContent||'').trim()==='${label}'); if (el) el.click(); })()`)
    await new Promise(r => setTimeout(r, 800))
  }
  const clickSubTab = async (label) => {
    await win.webContents.executeJavaScript(`(() => { const els = Array.from(document.querySelectorAll('button')); const el = els.find(e => (e.textContent||'').trim()==='${label}'); if (el) el.click(); })()`)
    await new Promise(r => setTimeout(r, 500))
  }

  const AUDIT = `(() => {
    const lum = (r,g,b)=>{const f=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)}
    const parseC = s => { const m = s.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/); return m ? [+m[1],+m[2],+m[3], m[4]===undefined?1:+m[4]] : null }
    const bgOf = el => { let e = el; while (e && e !== document.documentElement) { const c = parseC(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.6) return c; e = e.parentElement } return [15,23,42,1] }
    const vis = Array.from(document.querySelectorAll('body *')).filter(el => { const s = getComputedStyle(el); return s.display!=='none' && s.visibility!=='hidden' && el.children.length===0 && (el.textContent||'').trim() })
    const fonts = {}; const lowContrast = []; const tinyText = []
    for (const el of vis) {
      const s = getComputedStyle(el); const txt = (el.textContent||'').trim().slice(0,30)
      const fk = s.fontSize+'/'+s.fontWeight
      fonts[fk] = (fonts[fk]||0)+1
      const size = parseFloat(s.fontSize)
      if (size < 12) tinyText.push({txt, size, cls:(el.className||'').toString().slice(0,50)})
      const fc = parseC(s.color)
      if (fc) { const L1 = lum(fc[0],fc[1],fc[2]), b = bgOf(el), L2 = lum(b[0],b[1],b[2]); const cr = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05)
        if (cr < 4.5 && size >= 12) lowContrast.push({txt, cr:+cr.toFixed(2), size, color:s.color}) }
    }
    const scrollersActive = Array.from(document.querySelectorAll('*')).filter(el => { const s=getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight>el.clientHeight+4 && el.clientHeight>60 }).map(el=>({cls:(el.className||'').toString().slice(0,80), ch:el.clientHeight, sh:el.scrollHeight}))
    const scrollersPotential = Array.from(document.querySelectorAll('*')).filter(el => { const s=getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) }).map(el=>({cls:(el.className||'').toString().slice(0,80)}))
    const smallTargets = []
    for (const el of document.querySelectorAll('button, a, input[type=checkbox], select')) {
      const r = el.getBoundingClientRect(); if (r.width===0) continue
      if ((r.height < 28 || r.width < 28) && !el.closest('[data-small-ok]')) smallTargets.push({txt:(el.textContent||el.id||'btn').trim().slice(0,20), w:Math.round(r.width), h:Math.round(r.height)})
    }
    const emojiHeads = []
    for (const el of document.querySelectorAll('h1,h2,h3,h4,button,span,p')) {
      const t=(el.textContent||'').trim(); if (t && /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(t.slice(0,3)) && el.children.length<=1) emojiHeads.push({tag:el.tagName.toLowerCase(), txt:t.slice(0,24)})
    }
    const radii = {}; const gaps = {}
    for (const el of Array.from(document.querySelectorAll('body *')).slice(0,1200)) {
      const s=getComputedStyle(el)
      if (s.borderRadius!=='0px') radii[s.borderRadius]=(radii[s.borderRadius]||0)+1
      if (parseFloat(s.gap)>0) gaps[s.gap]=(gaps[s.gap]||0)+1
    }
    const textColors={}, bgColors={}
    for (const el of vis){const c=getComputedStyle(el).color; textColors[c]=(textColors[c]||0)+1}
    for (const el of Array.from(document.querySelectorAll('body *')).slice(0,800)){const c=getComputedStyle(el).backgroundColor; if(c!=='rgba(0, 0, 0, 0)') bgColors[c]=(bgColors[c]||0)+1}
    return JSON.stringify({
      view: location.href.slice(-20),
      fontScale: Object.entries(fonts).sort((a,b)=>b[1]-a[1]).slice(0,10),
      lowContrastCount: lowContrast.length, lowContrastSample: lowContrast.slice(0,8),
      tinyTextCount: tinyText.length, tinyTextSample: tinyText.slice(0,8),
      scrollersActive, scrollersPotential,
      smallTargetsCount: smallTargets.length, smallTargetsSample: smallTargets.slice(0,6),
      emojiInHeadings: emojiHeads.slice(0,10),
      topRadii: Object.entries(radii).sort((a,b)=>b[1]-a[1]).slice(0,6),
      topGaps: Object.entries(gaps).sort((a,b)=>b[1]-a[1]).slice(0,6),
      textColorVariety: Object.keys(textColors).length,
      bgColorVariety: Object.keys(bgColors).length
    })
  })()`

  const auditView = async (tag) => console.log(`AUDIT[${tag}]===' ${await win.webContents.executeJavaScript(AUDIT)}`)

  await auditView('dashboard')
  await clickSidebar('リオープンマネージャー'); await auditView('reopen')
  await clickSidebar('プレイヤーマッピング'); await auditView('mappings')
  await clickSidebar('オーバーレイ設定'); await auditView('overlay')
  await clickSidebar('設定')
  await clickSubTab('システム (System)'); await auditView('settings-system')
  await clickSubTab('OBS設定'); await auditView('settings-obs')
  await clickSubTab('AI解析 (Groq)'); await auditView('settings-ai')
  await clickSidebar('About'); await auditView('about')

  app.quit()
}

main().catch(e => { console.error(e); app.exit(1) })
