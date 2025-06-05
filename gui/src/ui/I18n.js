/**
 * 国際化（i18n）管理クラス（改良版）
 */
class I18n {
  constructor() {
    this.currentLanguage = 'ja';
    this.translations = {};
    this.isInitialized = false;
    this.fallbackLanguage = 'en';
    this.loadingPromise = null;
  }

  /**
   * 初期化
   */
  async init(language = 'ja') {
    try {
      logAPI.info('Initializing I18n system...');
      
      // 保存された言語設定を読み込み
      const savedLanguage = storageAPI.getItem('language', language);
      this.currentLanguage = savedLanguage;
      
      // 翻訳ファイルを読み込み
      await this.loadTranslations(this.currentLanguage);
      
      // HTMLに翻訳を適用
      this.applyTranslations();
      
      // 言語セレクターを更新
      this.updateLanguageSelector();
      
      this.isInitialized = true;
      logAPI.info(`I18n initialized with language: ${this.currentLanguage}`);
    } catch (error) {
      logAPI.error('Failed to initialize I18n:', error);
      
      // フォールバック言語で再試行
      if (this.currentLanguage !== this.fallbackLanguage) {
        logAPI.warn(`Falling back to ${this.fallbackLanguage} language`);
        this.currentLanguage = this.fallbackLanguage;
        await this.loadTranslations(this.currentLanguage);
        this.applyTranslations();
      }
      
      this.isInitialized = true;
    }
  }

  /**
   * 翻訳ファイルを読み込み
   */
  async loadTranslations(language) {
    try {
      if (this.loadingPromise) {
        await this.loadingPromise;
        return;
      }

      this.loadingPromise = this.fetchTranslations(language);
      const translations = await this.loadingPromise;
      
      this.translations[language] = translations;
      this.loadingPromise = null;
      
      logAPI.debug(`Translations loaded for language: ${language}`);
    } catch (error) {
      this.loadingPromise = null;
      logAPI.error(`Failed to load translations for ${language}:`, error);
      throw error;
    }
  }

  /**
   * 翻訳ファイルを取得
   */
  async fetchTranslations(language) {
    const response = await fetch(`../locales/${language}.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch translations: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * キーに対応する翻訳を取得
   */
  t(key, params = {}) {
    if (!this.isInitialized) {
      logAPI.warn('I18n not initialized, returning key as-is');
      return key;
    }

    const translation = this.getTranslation(key, this.currentLanguage) || 
                       this.getTranslation(key, this.fallbackLanguage) || 
                       key;
    
    return this.interpolate(translation, params);
  }

  /**
   * 指定された言語のキーから翻訳を取得
   */
  getTranslation(key, language) {
    const translations = this.translations[language];
    if (!translations) {
      return null;
    }

    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    return typeof value === 'string' ? value : null;
  }

  /**
   * 翻訳文字列に パラメータを補間
   */
  interpolate(text, params) {
    if (!params || Object.keys(params).length === 0) {
      return text;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * 言語を変更
   */
  async setLanguage(language) {
    try {
      if (language === this.currentLanguage) {
        return;
      }

      logAPI.info(`Changing language from ${this.currentLanguage} to ${language}`);
      
      // 翻訳ファイルを読み込み（キャッシュされていない場合）
      if (!this.translations[language]) {
        await this.loadTranslations(language);
      }
      
      this.currentLanguage = language;
      
      // 設定を保存
      storageAPI.setItem('language', language);
      
      // HTMLに翻訳を適用
      this.applyTranslations();
      
      // 言語セレクターを更新
      this.updateLanguageSelector();
      
      // HTML要素の言語属性を更新
      document.documentElement.lang = language;
      
      logAPI.info(`Language changed to: ${language}`);
      
      // 言語変更イベントを発火
      this.dispatchLanguageChangeEvent(language);
    } catch (error) {
      logAPI.error('Failed to change language:', error);
      throw error;
    }
  }

  /**
   * HTML要素に翻訳を適用
   */
  applyTranslations() {
    try {
      // data-i18n属性を持つ要素のテキストを翻訳
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
          const translation = this.t(key);
          
          // テキストコンテンツを更新
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // input要素の場合は value を更新
            if (element.type !== 'text' && element.type !== 'password' && element.type !== 'email') {
              element.value = translation;
            }
          } else {
            element.textContent = translation;
          }
        }
      });

      // data-i18n-placeholder属性を持つ要素のプレースホルダーを翻訳
      const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
      placeholderElements.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key) {
          const translation = this.t(key);
          element.placeholder = translation;
        }
      });

      // data-i18n-title属性を持つ要素のタイトルを翻訳
      const titleElements = document.querySelectorAll('[data-i18n-title]');
      titleElements.forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (key) {
          const translation = this.t(key);
          element.title = translation;
        }
      });

      // data-i18n-aria-label属性を持つ要素のaria-labelを翻訳
      const ariaElements = document.querySelectorAll('[data-i18n-aria-label]');
      ariaElements.forEach(element => {
        const key = element.getAttribute('data-i18n-aria-label');
        if (key) {
          const translation = this.t(key);
          element.setAttribute('aria-label', translation);
        }
      });

      logAPI.debug('Translations applied to DOM elements');
    } catch (error) {
      logAPI.error('Failed to apply translations:', error);
    }
  }

  /**
   * 言語セレクターを更新
   */
  updateLanguageSelector() {
    const selector = document.getElementById('languageSelector');
    if (selector) {
      selector.value = this.currentLanguage;
      
      // 言語変更イベントリスナーを設定（重複を避けるため一度削除）
      selector.removeEventListener('change', this.handleLanguageChange);
      selector.addEventListener('change', this.handleLanguageChange.bind(this));
    }
  }

  /**
   * 言語変更ハンドラー
   */
  async handleLanguageChange(event) {
    const newLanguage = event.target.value;
    try {
      await this.setLanguage(newLanguage);
    } catch (error) {
      logAPI.error('Failed to handle language change:', error);
      
      // エラーの場合は元の言語に戻す
      event.target.value = this.currentLanguage;
      
      if (window.NotificationManager) {
        NotificationManager.show('error', this.t('errors.languageChangeFailed'));
      }
    }
  }

  /**
   * 利用可能な言語一覧を取得
   */
  getAvailableLanguages() {
    return [
      { code: 'ja', name: '日本語', nativeName: '日本語' },
      { code: 'en', name: 'English', nativeName: 'English' }
    ];
  }

  /**
   * 現在の言語を取得
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * 特定の要素に翻訳を適用
   */
  translateElement(element) {
    if (!element) return;

    // data-i18n属性
    const i18nKey = element.getAttribute('data-i18n');
    if (i18nKey) {
      const translation = this.t(i18nKey);
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.type !== 'text' && element.type !== 'password' && element.type !== 'email') {
          element.value = translation;
        }
      } else {
        element.textContent = translation;
      }
    }

    // data-i18n-placeholder属性
    const placeholderKey = element.getAttribute('data-i18n-placeholder');
    if (placeholderKey) {
      element.placeholder = this.t(placeholderKey);
    }

    // data-i18n-title属性
    const titleKey = element.getAttribute('data-i18n-title');
    if (titleKey) {
      element.title = this.t(titleKey);
    }

    // data-i18n-aria-label属性
    const ariaKey = element.getAttribute('data-i18n-aria-label');
    if (ariaKey) {
      element.setAttribute('aria-label', this.t(ariaKey));
    }
  }

  /**
   * 言語変更イベントを発火
   */
  dispatchLanguageChangeEvent(language) {
    const event = new CustomEvent('languageChanged', {
      detail: { language, translations: this.translations[language] }
    });
    document.dispatchEvent(event);
  }

  /**
   * 翻訳ファイルをプリロード
   */
  async preloadLanguages(languages = ['ja', 'en']) {
    const promises = languages.map(lang => {
      if (!this.translations[lang]) {
        return this.loadTranslations(lang).catch(error => {
          logAPI.warn(`Failed to preload language ${lang}:`, error);
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
    logAPI.info('Language preloading completed');
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.translations = {};
    this.isInitialized = false;
    this.loadingPromise = null;
    
    // イベントリスナーを削除
    const selector = document.getElementById('languageSelector');
    if (selector) {
      selector.removeEventListener('change', this.handleLanguageChange);
    }
    
    logAPI.info('I18n system destroyed');
  }
}

// グローバルインスタンスを作成
window.i18n = new I18n();

// I18nクラスをエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18n;
}