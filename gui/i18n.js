class I18n {
  constructor() {
    this.currentLanguage = 'ja';
    this.translations = {};
    this.fallbackLanguage = 'ja';
  }

  async init() {
    // ローカルストレージから言語設定を読み込み
    const savedLanguage = localStorage.getItem('language') || 'ja';
    this.currentLanguage = savedLanguage;

    // 翻訳データを読み込み
    await this.loadTranslations(this.currentLanguage);
    
    // フォールバック言語も読み込み（現在の言語と異なる場合）
    if (this.currentLanguage !== this.fallbackLanguage) {
      await this.loadTranslations(this.fallbackLanguage);
    }

    // DOMが読み込まれた後に翻訳を適用
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.applyTranslations());
    } else {
      this.applyTranslations();
    }
  }

  async loadTranslations(language) {
    try {
      const response = await fetch(`locales/${language}.json`);
      const translations = await response.json();
      this.translations[language] = translations;
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);
    }
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let translation = this.translations[this.currentLanguage];
    
    // 現在の言語で翻訳を探す
    for (const k of keys) {
      if (translation && typeof translation === 'object' && k in translation) {
        translation = translation[k];
      } else {
        translation = null;
        break;
      }
    }

    // 見つからない場合はフォールバック言語を試す
    if (!translation && this.currentLanguage !== this.fallbackLanguage) {
      let fallbackTranslation = this.translations[this.fallbackLanguage];
      for (const k of keys) {
        if (fallbackTranslation && typeof fallbackTranslation === 'object' && k in fallbackTranslation) {
          fallbackTranslation = fallbackTranslation[k];
        } else {
          fallbackTranslation = null;
          break;
        }
      }
      translation = fallbackTranslation;
    }

    // それでも見つからない場合はキーをそのまま返す
    if (!translation) {
      console.warn(`Translation not found for key: ${key}`);
      return key;
    }

    // パラメータ置換
    if (typeof translation === 'string') {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  interpolate(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  async setLanguage(language) {
    if (this.currentLanguage === language) return;

    this.currentLanguage = language;
    localStorage.setItem('language', language);

    // 新しい言語の翻訳データを読み込み
    await this.loadTranslations(language);
    
    // 翻訳を再適用
    this.applyTranslations();
    
    // HTML言語属性を更新
    document.documentElement.lang = language;
  }

  applyTranslations() {
    // data-i18n属性を持つ要素を翻訳
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);
      
      if (element.tagName === 'INPUT') {
        if (element.type === 'text' || element.type === 'password' || element.type === 'email') {
          element.placeholder = translation;
        } else {
          element.value = translation;
        }
      } else {
        element.innerHTML = translation;
      }
    });

    // data-i18n-title属性を持つ要素のtitle属性を翻訳
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // 言語選択ドロップダウンの更新
    this.updateLanguageSelector();
  }

  updateLanguageSelector() {
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
      languageSelector.value = this.currentLanguage;
    }
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getAvailableLanguages() {
    return [
      { code: 'ja', name: '日本語' },
      { code: 'en', name: 'English' }
    ];
  }
}

// グローバルインスタンスを作成
const i18n = new I18n();

// DOM読み込み完了後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
  i18n.init();
}