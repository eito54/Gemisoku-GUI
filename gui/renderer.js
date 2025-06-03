// 言語切り替え機能
async function changeLanguage(language) {
    if (typeof i18n !== 'undefined') {
        await i18n.setLanguage(language);
        // テーマトグルのタイトルも更新
        updateThemeToggleTitle();
    }
}

// テーマトグルのタイトルを現在の言語で更新
function updateThemeToggleTitle() {
    const themeToggle = document.querySelector('.theme-toggle');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (typeof i18n !== 'undefined' && themeToggle) {
        const titleKey = currentTheme === 'dark' ? 'theme.toggleLight' : 'theme.toggle';
        const title = i18n.t('theme.toggle');
        themeToggle.title = title;
    }
}

// ダークモード切り替え機能
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // アイコンを更新
    const themeToggle = document.querySelector('.theme-toggle');
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌓';
    
    // タイトルを現在の言語で更新
    updateThemeToggleTitle();
}

// 保存されたテーマを読み込み
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌓';
        // タイトルは多言語対応のため、i18n初期化後に設定
        updateThemeToggleTitle();
    }
}

// DOM要素の取得
const configForm = document.getElementById('configForm');
const configStatus = document.getElementById('configStatus');
const operationStatus = document.getElementById('operationStatus');

const obsIpInput = document.getElementById('obsIp');
const obsPortInput = document.getElementById('obsPort');
const obsPasswordInput = document.getElementById('obsPassword');
const obsSourceNameInput = document.getElementById('obsSourceName');
const geminiApiKeyInput = document.getElementById('geminiApiKey');

const fetchRaceBtn = document.getElementById('fetchRaceBtn');
const fetchOverallBtn = document.getElementById('fetchOverallBtn');
const openOverlayBtn = document.getElementById('openOverlayBtn');
const editScoresBtn = document.getElementById('editScoresBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('GUI renderer loaded, initializing...');
    
    // i18nの初期化を待つ
    if (typeof i18n !== 'undefined') {
        await i18n.init();
    }
    
    loadTheme(); // テーマを読み込み
    await loadConfig();
    setupUpdateListeners(); // アップデートリスナーを設定
    await checkAppVersion(); // アプリバージョンを表示
    console.log('GUI initialization complete');
});

// 設定を読み込み
async function loadConfig() {
    try {
        const config = await window.electronAPI.getConfig();
        
        obsIpInput.value = config.obsIp || '127.0.0.1';
        obsPortInput.value = config.obsPort || '4455';
        obsPasswordInput.value = config.obsPassword || '';
        obsSourceNameInput.value = config.obsSourceName || '';
        geminiApiKeyInput.value = config.geminiApiKey || '';
        
        // 新しい設定項目の読み込み
        const showRemainingRacesCheckbox = document.getElementById('showRemainingRaces');
        if (showRemainingRacesCheckbox) {
            showRemainingRacesCheckbox.checked = config.showRemainingRaces !== false; // デフォルトはtrue
        }
    } catch (error) {
        const errorMsg = typeof i18n !== 'undefined' ? i18n.t('messages.configLoadError') : '設定の読み込みに失敗しました';
        showStatus(configStatus, 'error', errorMsg + ': ' + error.message);
    }
}

// 設定を保存
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const showRemainingRacesCheckbox = document.getElementById('showRemainingRaces');
    
    const config = {
        obsIp: obsIpInput.value.trim(),
        obsPort: obsPortInput.value.trim(),
        obsPassword: obsPasswordInput.value.trim(),
        obsSourceName: obsSourceNameInput.value.trim(),
        geminiApiKey: geminiApiKeyInput.value.trim(),
        showRemainingRaces: showRemainingRacesCheckbox ? showRemainingRacesCheckbox.checked : true
    };
    
    // バリデーション（OBSパスワードは必須ではない）
    if (!config.obsIp || !config.obsPort || !config.obsSourceName || !config.geminiApiKey) {
        const errorMsg = typeof i18n !== 'undefined' ? i18n.t('config.validationError') : 'OBS IPアドレス、ポート、ソース名、Gemini APIキーは必須です';
        showStatus(configStatus, 'error', errorMsg);
        return;
    }
    
    try {
        showButtonLoading(e.target.querySelector('button'), true);
        
        const result = await window.electronAPI.saveConfig(config);
        
        if (result.success) {
            const successMsg = typeof i18n !== 'undefined' ? i18n.t('messages.configSaved') : '設定が保存されました';
            showStatus(configStatus, 'success', successMsg);
            showSuccessParticles(document.querySelector('button[type="submit"]'));
        } else {
            const errorMsg = typeof i18n !== 'undefined' ? i18n.t('messages.configSaveError') : '設定の保存に失敗しました';
            showStatus(configStatus, 'error', errorMsg);
        }
    } catch (error) {
        const errorMsg = typeof i18n !== 'undefined' ? i18n.t('messages.configSaveError') : '設定の保存に失敗しました';
        showStatus(configStatus, 'error', errorMsg + ': ' + error.message);
    } finally {
        showButtonLoading(e.target.querySelector('button'), false);
    }
});

// 処理中のボタン制御
function setProcessingButtonsState(isProcessing) {
    const processingButtons = [fetchRaceBtn, fetchOverallBtn, resetScoresBtn];
    processingButtons.forEach(button => {
        if (button) {
            button.disabled = isProcessing;
        }
    });
}

// レース結果取得
fetchRaceBtn.addEventListener('click', async () => {
    try {
        console.log('Race results button clicked!');
        setProcessingButtonsState(true);
        showButtonLoading(fetchRaceBtn, true);
        showStatus(operationStatus, 'info', 'OBSからスクリーンショットを取得中...');
        
        console.log('Calling window.electronAPI.fetchRaceResults()...');
        const result = await window.electronAPI.fetchRaceResults();
        console.log('Received result from fetchRaceResults:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            showStatus(operationStatus, 'success', 'レース結果の取得が完了しました');
            showSuccessParticles(fetchRaceBtn);
        } else {
            const errorMsg = result.error || 'undefined';
            showStatus(operationStatus, 'error', `エラー: ${errorMsg}`);
            console.error('fetchRaceResults error:', result);
        }
    } catch (error) {
        showStatus(operationStatus, 'error', 'レース結果の取得に失敗しました: ' + error.message);
    } finally {
        showButtonLoading(fetchRaceBtn, false);
        setProcessingButtonsState(false);
    }
});

// チーム合計点取得
fetchOverallBtn.addEventListener('click', async () => {
    try {
        console.log('Overall scores button clicked!');
        setProcessingButtonsState(true);
        showButtonLoading(fetchOverallBtn, true);
        showStatus(operationStatus, 'info', 'チーム合計点を取得中...');
        
        console.log('Calling window.electronAPI.fetchOverallScores()...');
        const result = await window.electronAPI.fetchOverallScores();
        console.log('Received result from fetchOverallScores:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            showStatus(operationStatus, 'success', 'チーム合計点の取得が完了しました');
            showSuccessParticles(fetchOverallBtn);
        } else {
            const errorMsg = result.error || 'undefined';
            showStatus(operationStatus, 'error', `エラー: ${errorMsg}`);
            console.error('fetchOverallScores error:', result);
        }
    } catch (error) {
        showStatus(operationStatus, 'error', 'チーム合計点の取得に失敗しました: ' + error.message);
    } finally {
        showButtonLoading(fetchOverallBtn, false);
        setProcessingButtonsState(false);
    }
});

// オーバーレイを開く
openOverlayBtn.addEventListener('click', async () => {
    try {
        await window.electronAPI.openOverlay();
        showStatus(operationStatus, 'success', 'オーバーレイを開きました（ブラウザで表示）');
    } catch (error) {
        showStatus(operationStatus, 'error', 'オーバーレイの表示に失敗しました: ' + error.message);
    }
});

// 得点編集画面を開く
editScoresBtn.addEventListener('click', async () => {
    try {
        await window.electronAPI.openEditWindow();
        showStatus(operationStatus, 'success', '得点編集ウィンドウを開きました');
    } catch (error) {
        showStatus(operationStatus, 'error', '得点編集ウィンドウの表示に失敗しました: ' + error.message);
    }
});

// 接続テスト
testConnectionBtn.addEventListener('click', async () => {
    try {
        showButtonLoading(testConnectionBtn, true);
        showStatus(operationStatus, 'info', '接続をテスト中...');
        
        // 内蔵サーバーのポートを動的に取得してテスト
        const serverPort = await window.electronAPI.getServerPort();
        console.log('Testing connection with server port:', serverPort);
        
        if (!serverPort) {
            throw new Error('内蔵サーバーが起動していません');
        }
        
        // OBS接続テスト
        const obsTestResponse = await fetch(`http://localhost:${serverPort}/api/obs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (obsTestResponse.ok) {
            const obsData = await obsTestResponse.json();
            if (obsData.success) {
                showStatus(operationStatus, 'success', '✅ OBS WebSocket接続: 成功\n✅ 内蔵サーバー: 起動中\n✅ 全ての接続が正常です');
                showSuccessParticles(testConnectionBtn);
            } else {
                showStatus(operationStatus, 'error', `❌ OBS接続エラー: ${obsData.error}`);
            }
        } else {
            throw new Error(`HTTP ${obsTestResponse.status}: ${obsTestResponse.statusText}`);
        }
        
    } catch (error) {
        if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
            showStatus(operationStatus, 'error', '❌ 内蔵サーバーが起動していません\n数秒待ってから再度お試しください');
        } else {
            showStatus(operationStatus, 'error', '接続テストに失敗しました: ' + error.message);
        }
    } finally {
        showButtonLoading(testConnectionBtn, false);
    }
});

// アップデートチェックボタン
if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
        try {
            showButtonLoading(checkUpdatesBtn, true);
            showStatus(operationStatus, 'info', 'アップデートをチェック中...');
            
            const result = await window.electronAPI.checkForUpdates();
            
            if (result.success) {
                if (result.upToDate) {
                    if (result.newerVersion) {
                        // 現在のバージョンの方が新しい（開発版）
                        showStatus(operationStatus, 'info',
                            `🚀 開発版をお使いです (現在: v${result.currentVersion}, 最新安定版: v${result.latestVersion})`);
                    } else if (result.isNewerRelease) {
                        // パッケージ版で最新リリース版（GitHubより新しい正式版）
                        showStatus(operationStatus, 'success',
                            `✅ 最新バージョンをお使いです (v${result.currentVersion})`);
                    } else {
                        // 最新バージョンまたは同じバージョン
                        const message = result.latestVersion
                            ? `✅ 最新バージョンをお使いです (v${result.currentVersion})`
                            : '✅ 最新バージョンをお使いです';
                        showStatus(operationStatus, 'success', message);
                    }
                } else if (result.manualUpdate) {
                    showStatus(operationStatus, 'info', '🆕 新しいバージョンが利用可能です');
                    showManualUpdateDialog(result.latestRelease, result.currentVersion);
                } else {
                    showStatus(operationStatus, 'success', 'アップデートチェックが完了しました');
                }
                showSuccessParticles(checkUpdatesBtn);
            } else {
                showStatus(operationStatus, 'error', 'アップデートチェックに失敗しました: ' + result.error);
            }
        } catch (error) {
            showStatus(operationStatus, 'error', 'アップデートチェックに失敗しました: ' + error.message);
        } finally {
            showButtonLoading(checkUpdatesBtn, false);
        }
    });
}

// ユーティリティ関数
function showStatus(element, type, message) {
    element.className = `status ${type}`;
    
    // アイコンとメッセージを組み合わせ
    const icons = {
        success: '✅',
        error: '❌',
        info: '💡'
    };
    
    element.innerHTML = `<span style="margin-right: 8px;">${icons[type] || '📢'}</span>${message}`;
    element.style.display = 'block';
    
    // アニメーション効果を追加
    element.style.opacity = '0';
    element.style.transform = 'translateX(-20px)';
    
    // フェードイン
    setTimeout(() => {
        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';
    }, 10);
    
    // 成功・情報メッセージは7秒後に自動非表示
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '0';
            element.style.transform = 'translateX(20px)';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, 300);
        }, 7000);
    }
}

function showButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        const originalText = button.textContent;
        button.dataset.originalText = originalText;
        
        // より魅力的なローディング表示
        const loadingText = originalText.includes('レース') ? '📊 解析中...' :
                           originalText.includes('チーム') ? '🏆 計算中...' :
                           originalText.includes('オーバーレイ') ? '🖥️ 起動中...' :
                           originalText.includes('接続') ? '🔗 確認中...' :
                           '⏳ 処理中...';
        
        button.innerHTML = `<span class="loading"></span>${loadingText}`;
        button.style.transform = 'scale(0.98)';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
        button.style.transform = 'scale(1)';
        
        // 完了時の微細なアニメーション
        button.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            button.style.transform = 'scale(1.02)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 100);
        }, 50);
    }
}

// 成功時のパーティクル効果
function showSuccessParticles(button) {
    const rect = button.getBoundingClientRect();
    const particles = [];
    
    for (let i = 0; i < 6; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            width: 6px;
            height: 6px;
            background: linear-gradient(45deg, #48bb78, #38a169);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
        `;
        
        document.body.appendChild(particle);
        particles.push(particle);
        
        // パーティクルアニメーション
        const angle = (i / 6) * Math.PI * 2;
        const velocity = 50 + Math.random() * 30;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        let x = 0, y = 0, opacity = 1;
        const animate = () => {
            x += vx * 0.02;
            y += vy * 0.02 + 0.5; // 重力効果
            opacity -= 0.02;
            
            particle.style.transform = `translate(${x}px, ${y}px) scale(${opacity})`;
            particle.style.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(particle);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    showStatus(operationStatus, 'error', '予期しないエラーが発生しました');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showStatus(operationStatus, 'error', '予期しないエラーが発生しました');
    event.preventDefault();
});

// スコアリセット機能を追加
const resetScoresBtn = document.getElementById('resetScoresBtn');
const keepScoresCheckbox = document.getElementById('keepScoresOnRestart');

// スコアリセットボタンのイベントリスナー
if (resetScoresBtn) {
    resetScoresBtn.addEventListener('click', async () => {
        if (confirm('本当にスコアをリセットしますか？この操作は取り消せません。')) {
            await resetScores();
        }
    });
}

// スコア保持設定の変更イベントリスナー
if (keepScoresCheckbox) {
    keepScoresCheckbox.addEventListener('change', async () => {
        try {
            const config = await window.electronAPI.getConfig();
            config.keepScoresOnRestart = keepScoresCheckbox.checked;
            await window.electronAPI.saveConfig(config);
            
            const message = keepScoresCheckbox.checked ?
                'スコア保持設定が有効になりました' :
                'スコア保持設定が無効になりました（次回起動時にリセット）';
            showStatus(operationStatus, 'success', message);
        } catch (error) {
            console.error('設定保存エラー:', error);
            showStatus(operationStatus, 'error', '設定の保存に失敗しました');
        }
    });
}

// 残りレース数表示設定の変更イベントリスナー
const showRemainingRacesCheckbox = document.getElementById('showRemainingRaces');
if (showRemainingRacesCheckbox) {
    showRemainingRacesCheckbox.addEventListener('change', async () => {
        try {
            const config = await window.electronAPI.getConfig();
            config.showRemainingRaces = showRemainingRacesCheckbox.checked;
            await window.electronAPI.saveConfig(config);
            
            const message = showRemainingRacesCheckbox.checked ?
                'オーバーレイでの残りレース数表示が有効になりました' :
                'オーバーレイでの残りレース数表示が無効になりました';
            showStatus(operationStatus, 'success', message);
        } catch (error) {
            console.error('設定保存エラー:', error);
            showStatus(operationStatus, 'error', '設定の保存に失敗しました');
        }
    });
}

// スコアリセット機能
async function resetScores() {
    try {
        setProcessingButtonsState(true);
        showButtonLoading(resetScoresBtn, true);
        
        // サーバーポートを動的に取得
        const serverPort = await window.electronAPI.getServerPort();
        
        // 内蔵サーバーでリセット
        const response = await fetch(`http://localhost:${serverPort}/api/scores/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Next.js開発サーバーが動いているかチェック（環境に関係なく試行）
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000); // 1秒でタイムアウト
                
                const healthCheck = await fetch('http://localhost:3000/api/scores', {
                    method: 'GET',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (healthCheck.ok) {
                    await fetch('http://localhost:3000/api/scores', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify([]) // 空配列でリセット
                    });
                    console.log('Next.js app notified of score reset');
                }
            } catch (nextjsError) {
                console.log('Next.js app not available (normal in packaged app):', nextjsError.message);
                // パッケージ化環境では正常な動作なのでエラーとして扱わない
            }
            
            showStatus(operationStatus, 'success', 'スコアがリセットされました');
            showSuccessParticles(resetScoresBtn);
        } else {
            showStatus(operationStatus, 'error', 'スコアリセットに失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('スコアリセットエラー:', error);
        showStatus(operationStatus, 'error', 'スコアリセットエラー: ' + error.message);
    } finally {
        showButtonLoading(resetScoresBtn, false);
        setProcessingButtonsState(false);
    }
}

// 起動時のスコアリセット確認（設定に基づく）
async function checkInitialScoreReset() {
    try {
        const config = await window.electronAPI.getConfig();
        
        // スコア保持設定を読み込み
        if (keepScoresCheckbox) {
            keepScoresCheckbox.checked = config.keepScoresOnRestart !== false; // デフォルトはtrue
        }
        
        // 起動時のスコアリセット実行
        if (config.keepScoresOnRestart === false) {
            await resetScores();
            console.log('起動時スコアリセット実行');
        }
    } catch (error) {
        console.error('初期設定読み込みエラー:', error);
    }
}

// 初期化時にスコアリセット確認を実行
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkInitialScoreReset, 1000); // 1秒後に実行
});

// アップデート関連の機能
async function setupUpdateListeners() {
    // アップデート利用可能時
    window.electronAPI.onUpdateAvailable((event, info) => {
        console.log('アップデートが利用可能:', info);
        showUpdateAvailableDialog(info);
    });
    
    // ダウンロード進行状況
    window.electronAPI.onDownloadProgress((event, progress) => {
        console.log('ダウンロード進行状況:', Math.round(progress.percent) + '%');
        showDownloadProgress(progress);
    });
    
    // アップデートダウンロード完了
    window.electronAPI.onUpdateDownloaded((event, info) => {
        console.log('アップデートダウンロード完了:', info);
        showUpdateReadyDialog(info);
    });
    
    // カスタムダウンロード進行状況
    window.electronAPI.onDownloadProgressCustom((event, progress) => {
        console.log('カスタムダウンロード進行状況:', Math.round(progress.percent) + '%');
        
        // プログレスバーがない場合は作成
        if (!document.getElementById('updateProgress')) {
            showDownloadProgress({ percent: 0, transferred: 0, total: progress.total });
        }
        
        // プログレスバーを更新
        showDownloadProgress(progress);
        
        // ダウンロード完了時の処理
        if (progress.percent >= 100) {
            console.log('ダウンロード完了検知');
        }
    });
}

// アプリバージョンを表示
async function checkAppVersion() {
    try {
        const version = await window.electronAPI.getAppVersion();
        const versionElement = document.getElementById('appVersion');
        if (versionElement) {
            versionElement.textContent = `v${version}`;
        }
    } catch (error) {
        console.error('バージョン取得エラー:', error);
    }
}

// アップデート利用可能ダイアログ
function showUpdateAvailableDialog(info) {
    const modal = createModal({
        title: '🆕 新しいアップデートが利用可能です',
        content: `
            <div class="update-dialog">
                <p><strong>新しいバージョン:</strong> v${info.version}</p>
                <p><strong>現在のバージョン:</strong> v${info.currentVersion || 'Unknown'}</p>
                <div class="update-notes">
                    <h4>更新内容:</h4>
                    <div class="release-notes">${info.releaseNotes || '詳細な更新内容については、GitHubリリースページをご覧ください。'}</div>
                </div>
                <div class="update-actions">
                    <button id="downloadUpdateBtn" class="btn btn-primary">
                        📥 ダウンロード開始
                    </button>
                    <button id="laterBtn" class="btn btn-secondary">
                        ⏰ 後で
                    </button>
                </div>
            </div>
        `
    });
    
    document.getElementById('downloadUpdateBtn').addEventListener('click', () => {
        modal.remove();
        showStatus(operationStatus, 'info', 'アップデートのダウンロードを開始しています...');
    });
    
    document.getElementById('laterBtn').addEventListener('click', () => {
        modal.remove();
    });
}

// ダウンロード進行状況を表示
function showDownloadProgress(progress) {
    // 既存のプログレスバーを更新
    const existingProgress = document.getElementById('updateProgress');
    if (existingProgress) {
        const progressBar = existingProgress.querySelector('.progress-bar');
        const progressText = existingProgress.querySelector('.progress-text');
        if (progressBar && progressText) {
            progressBar.style.width = `${progress.percent}%`;
            progressText.textContent = `${Math.round(progress.percent)}% (${formatBytes(progress.transferred)} / ${formatBytes(progress.total)})`;
        }
        return;
    }

    // 新しいプログレスバーを作成
    const progressHTML = `
        <div id="updateProgress" class="update-progress">
            <h4>📦 アップデートをダウンロード中...</h4>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progress.percent}%"></div>
            </div>
            <div class="progress-text">${Math.round(progress.percent)}% (${formatBytes(progress.transferred)} / ${formatBytes(progress.total)})</div>
        </div>
    `;

    // ステータス領域にプログレスバーを表示
    const statusDiv = operationStatus;
    if (statusDiv) {
        statusDiv.className = 'status info';
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = progressHTML;
    }
}

// アップデート準備完了ダイアログ
function showUpdateReadyDialog(info) {
    const modal = createModal({
        title: '✅ アップデートの準備が完了しました',
        content: `
            <div class="update-dialog">
                <p>新しいバージョン <strong>v${info.version}</strong> のダウンロードが完了しました。</p>
                <p>アプリを再起動してアップデートを適用しますか？</p>
                <div class="update-actions">
                    <button id="installNowBtn" class="btn btn-primary">
                        🔄 今すぐ再起動
                    </button>
                    <button id="installLaterBtn" class="btn btn-secondary">
                        ⏰ 後で再起動
                    </button>
                </div>
            </div>
        `
    });
    
    document.getElementById('installNowBtn').addEventListener('click', async () => {
        try {
            await window.electronAPI.installUpdate();
        } catch (error) {
            console.error('アップデートインストールエラー:', error);
            showStatus(operationStatus, 'error', 'アップデートのインストールに失敗しました');
        }
    });
    
    document.getElementById('installLaterBtn').addEventListener('click', () => {
        modal.remove();
        showStatus(operationStatus, 'success', 'アップデートは次回起動時に適用されます');
    });
}

// 手動アップデートダイアログ（カスタム自動ダウンロード対応）
function showManualUpdateDialog(latestRelease, currentVersion) {
    const canAutoUpdate = latestRelease.canAutoUpdate;
    
    const modal = createModal({
        title: '🆕 新しいアップデートが利用可能です',
        content: `
            <div class="update-dialog">
                <p><strong>新しいバージョン:</strong> v${latestRelease.version}</p>
                <p><strong>現在のバージョン:</strong> v${currentVersion}</p>
                <div class="update-notes">
                    <h4>更新内容:</h4>
                    <div class="release-notes">${latestRelease.releaseNotes || '詳細な更新内容については、GitHubリリースページをご覧ください。'}</div>
                </div>
                ${canAutoUpdate ? `
                    <div class="update-success" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin: 16px 0; border-left: 4px solid var(--accent-green);">
                        <p><strong>✅ 自動アップデート:</strong> このバージョンは自動的にダウンロード・インストールできます。</p>
                    </div>
                ` : `
                    <div class="update-warning" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin: 16px 0; border-left: 4px solid var(--accent-orange);">
                        <p><strong>💡 情報:</strong> 手動でのアップデートとなります。下記ボタンからダウンロードページにアクセスしてください。</p>
                    </div>
                `}
                <div class="update-actions">
                    ${canAutoUpdate ? `
                        <button id="downloadAutoBtn" class="btn btn-primary">
                            📥 自動ダウンロード開始
                        </button>
                        <button id="downloadManualBtn" class="btn btn-secondary">
                            🌐 手動ダウンロード
                        </button>
                    ` : `
                        <button id="downloadManualBtn" class="btn btn-primary">
                            🌐 ダウンロードページを開く
                        </button>
                    `}
                    <button id="laterManualBtn" class="btn btn-secondary">
                        ⏰ 後で
                    </button>
                </div>
            </div>
        `
    });
    
    // 自動ダウンロードボタン
    const downloadAutoBtn = document.getElementById('downloadAutoBtn');
    if (downloadAutoBtn) {
        downloadAutoBtn.addEventListener('click', async () => {
            try {
                modal.remove();
                showStatus(operationStatus, 'info', 'アップデートのダウンロードを開始しています...');
                
                // ダウンロード開始前にプログレスバーを表示
                showDownloadProgress({ percent: 0, transferred: 0, total: latestRelease.installerAsset.size });
                
                const result = await window.electronAPI.downloadUpdateCustom(latestRelease.installerAsset);
                
                if (result.success) {
                    // プログレスバーを削除してからダイアログを表示
                    const progressElement = document.getElementById('updateProgress');
                    if (progressElement) {
                        progressElement.remove();
                    }
                    
                    // ダウンロード完了後に少し待ってからダイアログを表示
                    setTimeout(() => {
                        showCustomUpdateReadyDialog(result, latestRelease.version);
                    }, 500);
                } else {
                    showStatus(operationStatus, 'error', 'ダウンロードに失敗しました: ' + result.error);
                }
            } catch (error) {
                showStatus(operationStatus, 'error', 'ダウンロードに失敗しました: ' + error.message);
            }
        });
    }
    
    // 手動ダウンロードボタン
    const downloadManualBtn = document.getElementById('downloadManualBtn');
    if (downloadManualBtn) {
        downloadManualBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.openDownloadPage(latestRelease.downloadUrl);
                modal.remove();
                showStatus(operationStatus, 'success', 'ダウンロードページを開きました');
            } catch (error) {
                showStatus(operationStatus, 'error', 'ダウンロードページを開けませんでした: ' + error.message);
            }
        });
    }
    
    // 後でボタン
    const laterManualBtn = document.getElementById('laterManualBtn');
    if (laterManualBtn) {
        laterManualBtn.addEventListener('click', () => {
            modal.remove();
        });
    }
}

// カスタムアップデート準備完了ダイアログ
function showCustomUpdateReadyDialog(downloadResult, version) {
    const modal = createModal({
        title: '✅ アップデートの準備が完了しました',
        content: `
            <div class="update-dialog">
                <p>新しいバージョン <strong>v${version}</strong> のダウンロードが完了しました。</p>
                <p><strong>ファイル:</strong> ${downloadResult.fileName}</p>
                <p>インストーラーを実行してアップデートを適用しますか？</p>
                <div class="update-actions">
                    <button id="installCustomNowBtn" class="btn btn-primary">
                        🚀 今すぐインストール
                    </button>
                    <button id="installCustomLaterBtn" class="btn btn-secondary">
                        ⏰ 後でインストール
                    </button>
                </div>
            </div>
        `
    });
    
    document.getElementById('installCustomNowBtn').addEventListener('click', async () => {
        try {
            // ボタンを無効化してローディング表示
            const installBtn = document.getElementById('installCustomNowBtn');
            const originalText = installBtn.textContent;
            installBtn.disabled = true;
            installBtn.textContent = '🔄 インストーラーを起動中...';
            
            console.log('インストーラー起動開始:', downloadResult.filePath);
            
            const result = await window.electronAPI.installDownloadedUpdate(downloadResult.filePath);
            
            if (result.success) {
                modal.remove();
                showStatus(operationStatus, 'success', 'インストーラーを起動しました。アプリを終了します...');
                
                // アプリが終了するまで少し待つ
                setTimeout(() => {
                    console.log('アプリ終了処理中...');
                }, 1000);
            } else {
                // エラーの場合はボタンを復元
                installBtn.disabled = false;
                installBtn.textContent = originalText;
                showStatus(operationStatus, 'error', 'インストーラーの起動に失敗しました: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('カスタムアップデートインストールエラー:', error);
            
            // エラーの場合はボタンを復元
            const installBtn = document.getElementById('installCustomNowBtn');
            if (installBtn) {
                installBtn.disabled = false;
                installBtn.textContent = '🚀 今すぐインストール';
            }
            
            showStatus(operationStatus, 'error', 'インストーラーの起動に失敗しました: ' + error.message);
        }
    });
    
    document.getElementById('installCustomLaterBtn').addEventListener('click', () => {
        modal.remove();
        showStatus(operationStatus, 'success', `アップデートファイルは ${downloadResult.filePath} に保存されました`);
    });
}

// モーダルダイアログを作成
function createModal({ title, content }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    // 閉じるボタンのイベント
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
    return modal;
}

// バイト数をフォーマット
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}