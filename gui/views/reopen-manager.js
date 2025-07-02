// DOM要素の取得
const currentStatus = document.getElementById('currentStatus');
const slotsGrid = document.getElementById('slotsGrid');
const statusDiv = document.getElementById('status');

// セーブスロットの最大数
const MAX_SLOTS = 10;

// サーバーポート（動的に取得）
let serverPort = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Reopen Manager loaded');
    
    // サーバーポートを取得
    try {
        if (window.electronAPI && window.electronAPI.getServerPort) {
            serverPort = await window.electronAPI.getServerPort();
            console.log('Server port obtained:', serverPort);
        } else {
            // フォールバック: デフォルトポートを使用
            serverPort = 3001;
            console.log('Using fallback server port:', serverPort);
        }
    } catch (error) {
        console.error('Failed to get server port:', error);
        serverPort = 3001; // フォールバック
    }
    
    await loadCurrentStatus();
    await loadSaveSlots();
});

// 現在の状態を読み込み
async function loadCurrentStatus() {
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/scores`);
        const data = await response.json();
        
        if (data.scores && data.scores.length > 0) {
            const totalScore = data.scores.reduce((sum, team) => sum + (team.score || team.totalScore || 0), 0);
            const remainingRaces = data.remainingRaces || 0;
            
            currentStatus.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">総得点</div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--accent-blue);">${totalScore}点</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">残りレース数</div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--accent-orange);">${remainingRaces}レース</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">チーム数</div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--accent-green);">${data.scores.length}チーム</div>
                    </div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 12px; color: var(--text-primary);">チーム別得点</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                            ${data.scores.map(team => `
                                <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border);">
                                    <span style="font-weight: 500; color: var(--text-primary);">${team.name || team.team || 'Unknown'}</span>
                                    <span style="font-weight: 600; color: var(--accent-blue);">${team.score || team.totalScore || 0}点</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            `;
        } else {
            currentStatus.innerHTML = `
                <div style="text-align: center; padding: 32px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <p>まだスコアデータがありません</p>
                    <p style="font-size: 14px; margin-top: 8px;">レース結果を取得してからセーブしてください</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('現在の状態読み込みエラー:', error);
        currentStatus.innerHTML = `
            <div style="text-align: center; padding: 32px; color: var(--accent-red);">
                <p>❌ 現在の状態を読み込めませんでした</p>
                <p style="font-size: 14px; margin-top: 8px;">${error.message}</p>
            </div>
        `;
    }
}

// セーブスロットを読み込み
async function loadSaveSlots() {
    try {
        const response = await fetch(`http://localhost:${serverPort}/api/reopen-slots`);
        const slots = await response.json();
        
        slotsGrid.innerHTML = '';
        
        for (let i = 0; i < MAX_SLOTS; i++) {
            const slot = slots.find(s => s.slotId === i);
            const slotElement = createSlotElement(i, slot);
            slotsGrid.appendChild(slotElement);
        }
    } catch (error) {
        console.error('セーブスロット読み込みエラー:', error);
        showStatus('error', 'セーブスロットの読み込みに失敗しました: ' + error.message);
    }
}

// スロット要素を作成
function createSlotElement(slotId, slotData) {
    const slotDiv = document.createElement('div');
    slotDiv.className = slotData ? 'slot-card' : 'slot-card empty';
    slotDiv.setAttribute('data-slot-id', slotId);
    
    if (slotData) {
        // データがある場合
        const saveDate = new Date(slotData.timestamp).toLocaleString('ja-JP');
        const totalScore = slotData.scores.reduce((sum, team) => sum + (team.score || team.totalScore || 0), 0);
        const remainingRaces = slotData.remainingRaces || 0;
        
        slotDiv.innerHTML = `
            <button class="delete-btn" onclick="deleteSlot(${slotId})" title="削除">×</button>
            <div class="slot-header">
                <div class="slot-title">スロット ${slotId + 1}</div>
                <div class="slot-date">${saveDate}</div>
            </div>
            <div class="slot-info">
                ${slotData.scores.length}チーム • ${totalScore}点
                <span class="remaining-races">${remainingRaces}レース残り</span>
            </div>
            <div class="slot-details">
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">チーム詳細</div>
                <div class="teams-list">
                    ${slotData.scores.map(team => `
                        <div class="team-item">
                            <span class="team-name">${team.name || team.team || 'Unknown'}</span>
                            <span class="team-score">${team.score || team.totalScore || 0}点</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="slot-actions">
                <button class="button success" onclick="loadSlot(${slotId})">🔄 ロード</button>
                <button class="button warning" onclick="addToSlot(${slotId})">➕ 加算</button>
            </div>
        `;
    } else {
        // 空のスロット
        slotDiv.innerHTML = `
            <div class="empty-slot-content">
                <div class="empty-slot-icon">💾</div>
                <div>空きスロット ${slotId + 1}</div>
                <div style="font-size: 12px; margin-top: 4px;">クリックでセーブ</div>
            </div>
        `;
        
        slotDiv.addEventListener('click', () => saveToSlot(slotId));
    }
    
    return slotDiv;
}


// 指定スロットにセーブ
async function saveToSlot(slotId) {
    try {
        showStatus('info', `スロット ${slotId + 1} にセーブ中...`);
        
        // 現在のスコアを取得
        const scoresResponse = await fetch(`http://localhost:${serverPort}/api/scores`);
        const scoresData = await scoresResponse.json();
        
        if (!scoresData.scores || scoresData.scores.length === 0) {
            showStatus('error', 'セーブするスコアデータがありません');
            return;
        }
        
        // セーブデータを作成
        const saveData = {
            slotId: slotId,
            timestamp: new Date().toISOString(),
            scores: scoresData.scores,
            remainingRaces: scoresData.remainingRaces || 0,
            sessionInfo: {
                totalScore: scoresData.scores.reduce((sum, team) => sum + (team.score || team.totalScore || 0), 0),
                teamCount: scoresData.scores.length
            }
        };
        
        // サーバーにセーブリクエストを送信
        const response = await fetch(`http://localhost:${serverPort}/api/reopen-slots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('success', `スロット ${slotId + 1} にセーブしました`);
            await loadSaveSlots(); // スロット表示を更新
        } else {
            throw new Error(result.error || 'セーブに失敗しました');
        }
    } catch (error) {
        console.error('セーブエラー:', error);
        showStatus('error', 'セーブに失敗しました: ' + error.message);
    } finally {
        // ローディング状態を終了（ボタンが削除されたため、特に処理なし）
    }
}

// スロットからロード
async function loadSlot(slotId) {
    if (!confirm(`スロット ${slotId + 1} のデータをロードしますか？\n現在のスコアは上書きされます。`)) {
        return;
    }
    
    try {
        showStatus('info', `スロット ${slotId + 1} からロード中...`);
        
        // スロットデータを取得
        const response = await fetch(`http://localhost:${serverPort}/api/reopen-slots/${slotId}`);
        const slotData = await response.json();
        
        if (!slotData.success) {
            throw new Error(slotData.error || 'スロットデータの取得に失敗しました');
        }
        
        // スコアをロード
        const loadResponse = await fetch(`http://localhost:${serverPort}/api/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(slotData.data.scores)
        });
        
        const loadResult = await loadResponse.json();
        
        if (loadResult.success) {
            showStatus('success', `スロット ${slotId + 1} からロードしました`);
            await loadCurrentStatus(); // 現在の状態を更新
        } else {
            throw new Error(loadResult.error || 'ロードに失敗しました');
        }
    } catch (error) {
        console.error('ロードエラー:', error);
        showStatus('error', 'ロードに失敗しました: ' + error.message);
    }
}

// スロットの得点を現在のスコアに加算
async function addToSlot(slotId) {
    if (!confirm(`スロット ${slotId + 1} の得点を現在のスコアに加算しますか？`)) {
        return;
    }
    
    try {
        showStatus('info', `スロット ${slotId + 1} の得点を加算中...`);
        
        // 現在のスコアを取得
        const currentResponse = await fetch(`http://localhost:${serverPort}/api/scores`);
        const currentData = await currentResponse.json();
        
        // スロットデータを取得
        const slotResponse = await fetch(`http://localhost:${serverPort}/api/reopen-slots/${slotId}`);
        const slotData = await slotResponse.json();
        
        if (!slotData.success) {
            throw new Error(slotData.error || 'スロットデータの取得に失敗しました');
        }
        
        // 得点を加算
        const mergedScores = mergeScores(currentData.scores, slotData.data.scores);
        
        // 加算結果を保存
        const saveResponse = await fetch(`http://localhost:${serverPort}/api/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mergedScores)
        });
        
        const saveResult = await saveResponse.json();
        
        if (saveResult.success) {
            showStatus('success', `スロット ${slotId + 1} の得点を加算しました`);
            await loadCurrentStatus(); // 現在の状態を更新
        } else {
            throw new Error(saveResult.error || '加算結果の保存に失敗しました');
        }
    } catch (error) {
        console.error('加算エラー:', error);
        showStatus('error', '得点の加算に失敗しました: ' + error.message);
    }
}

// スコアをマージ（同じチーム名の得点を加算）
function mergeScores(currentScores, slotScores) {
    const merged = [...currentScores];
    
    slotScores.forEach(slotTeam => {
        const teamName = slotTeam.name || slotTeam.team;
        const teamScore = slotTeam.score || slotTeam.totalScore || 0;
        
        const existingTeam = merged.find(team => (team.name || team.team) === teamName);
        if (existingTeam) {
            const existingScore = existingTeam.score || existingTeam.totalScore || 0;
            existingTeam.score = existingScore + teamScore;
            // totalScoreがある場合は削除してscoreに統一
            if (existingTeam.totalScore) {
                delete existingTeam.totalScore;
            }
        } else {
            merged.push({
                name: teamName,
                score: teamScore
            });
        }
    });
    
    return merged;
}

// スロットを削除
async function deleteSlot(slotId) {
    if (!confirm(`スロット ${slotId + 1} を削除しますか？\nこの操作は取り消せません。`)) {
        return;
    }
    
    try {
        showStatus('info', `スロット ${slotId + 1} を削除中...`);
        
        const response = await fetch(`http://localhost:${serverPort}/api/reopen-slots/${slotId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('success', `スロット ${slotId + 1} を削除しました`);
            await loadSaveSlots(); // スロット表示を更新
        } else {
            throw new Error(result.error || '削除に失敗しました');
        }
    } catch (error) {
        console.error('削除エラー:', error);
        showStatus('error', 'スロットの削除に失敗しました: ' + error.message);
    }
}

// ステータス表示
function showStatus(type, message) {
    statusDiv.className = `status ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: '💡'
    };
    
    statusDiv.innerHTML = `<span style="margin-right: 8px;">${icons[type] || '📢'}</span>${message}`;
    statusDiv.style.display = 'block';
    
    // アニメーション効果
    statusDiv.style.opacity = '0';
    statusDiv.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
        statusDiv.style.transition = 'all 0.3s ease';
        statusDiv.style.opacity = '1';
        statusDiv.style.transform = 'translateX(0)';
    }, 10);
    
    // 成功・情報メッセージは5秒後に自動非表示
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            statusDiv.style.transition = 'all 0.3s ease';
            statusDiv.style.opacity = '0';
            statusDiv.style.transform = 'translateX(20px)';
            
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 300);
        }, 5000);
    }
}

// ボタンローディング表示
function showButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        const originalText = button.textContent;
        button.dataset.originalText = originalText;
        button.innerHTML = `<span class="loading"></span>処理中...`;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
    }
}

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    showStatus('error', '予期しないエラーが発生しました');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showStatus('error', '予期しないエラーが発生しました');
    event.preventDefault();
});