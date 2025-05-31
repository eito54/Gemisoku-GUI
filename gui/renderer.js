// ダークモード切り替え機能
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // アイコンを更新
    const themeToggle = document.querySelector('.theme-toggle');
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌓';
    themeToggle.title = newTheme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
}

// 保存されたテーマを読み込み
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌓';
        themeToggle.title = savedTheme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
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

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('GUI renderer loaded, initializing...');
    loadTheme(); // テーマを読み込み
    await loadConfig();
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
        showStatus(configStatus, 'error', '設定の読み込みに失敗しました: ' + error.message);
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
        showStatus(configStatus, 'error', 'OBS IPアドレス、ポート、ソース名、Gemini APIキーは必須です');
        return;
    }
    
    try {
        showButtonLoading(e.target.querySelector('button'), true);
        
        const result = await window.electronAPI.saveConfig(config);
        
        if (result.success) {
            showStatus(configStatus, 'success', '設定が保存されました');
            showSuccessParticles(document.querySelector('button[type="submit"]'));
        } else {
            showStatus(configStatus, 'error', '設定の保存に失敗しました');
        }
    } catch (error) {
        showStatus(configStatus, 'error', '設定の保存に失敗しました: ' + error.message);
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