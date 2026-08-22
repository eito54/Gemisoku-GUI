/* デザインレビュー用スクリーンショットキャプチャ v2
 * 使い方: npx electron scripts/design-capture.cjs  (リポジトリルートで実行)
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const OUT = path.join(process.cwd(), '.gstack', 'design-reports', 'audit-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''))
fs.mkdirSync(OUT, { recursive: true })

async function main() {
  await app.whenReady()
  const win = new BrowserWindow({ width: 960, height: 700, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  const indexHtml = 'file://' + path.join(process.cwd(), 'out', 'renderer', 'index.html').replace(/\\/g, '/')
  await win.loadURL(indexHtml)
  await new Promise(r => setTimeout(r, 4200))

  const shot = async (name) => {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG())
    console.log('captured:', name)
  }

  // サイドバータブを正確なラベルでクリック
  const clickSidebar = async (label) => {
    const ok = await win.webContents.executeJavaScript(`(() => {
      const els = Array.from(document.querySelectorAll('nav button'))
      const el = els.find(e => (e.textContent || '').trim() === '${label}')
      if (el) { el.click(); return true }
      return false
    })()`)
    await new Promise(r => setTimeout(r, 800))
    return ok
  }

  const clickSubTab = async (label) => {
    const ok = await win.webContents.executeJavaScript(`(() => {
      const els = Array.from(document.querySelectorAll('button'))
      const el = els.find(e => (e.textContent || '').trim() === '${label}')
      if (el) { el.click(); return true }
      return false
    })()`)
    await new Promise(r => setTimeout(r, 500))
    return ok
  }

  // スクロール構造のダンプ（ネスト検出）
  const dumpScrollers = async (tag) => {
    const info = await win.webContents.executeJavaScript(`JSON.stringify(Array.from(document.querySelectorAll('*'))
      .filter(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 60 })
      .map(el => ({ cls: (el.className || '').toString().slice(0, 70), ch: el.clientHeight, sh: el.scrollHeight })))`)
    console.log(`SCROLLERS[${tag}]===' + ${''}` + info)
  }

  await shot('01-dashboard')
  if (await clickSidebar('リオープンマネージャー')) await shot('02-reopen')
  if (await clickSidebar('プレイヤーマッピング')) await shot('03-mappings')
  if (await clickSidebar('オーバーレイ設定')) { await shot('04-overlay'); await dumpScrollers('overlay') }
  if (await clickSidebar('設定')) {
    await clickSubTab('システム (System)'); await shot('05-settings-system'); await dumpScrollers('settings-system')
    await clickSubTab('OBS設定'); await shot('06-settings-obs'); await dumpScrollers('settings-obs')
    await clickSubTab('AI解析 (Groq)'); await shot('07-settings-ai'); await dumpScrollers('settings-ai')
  }
  if (await clickSidebar('About')) await shot('08-about')

  app.quit()
}

main().catch(e => { console.error(e); app.exit(1) })
