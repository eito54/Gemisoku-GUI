import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// 自己ホストフォント（オフライン配信のためCDN不使用）
import '@fontsource/m-plus-rounded-1c/400.css'
import '@fontsource/m-plus-rounded-1c/500.css'
import '@fontsource/m-plus-rounded-1c/700.css'
import '@fontsource/russo-one'
import './assets/main.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
