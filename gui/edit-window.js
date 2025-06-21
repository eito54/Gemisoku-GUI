// DOM要素の取得
const scoresContainer = document.getElementById('scoresContainer');
const statusDiv = document.getElementById('status');
const newTeamNameInput = document.getElementById('newTeamName');
const newTeamScoreInput = document.getElementById('newTeamScore');
const newTeamIsCurrentPlayerCheckbox = document.getElementById('newTeamIsCurrentPlayer');
const addTeamBtn = document.getElementById('addTeamBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const cancelBtn = document.getElementById('cancelBtn');

let currentScores = [];

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadScores();
});

// スコアを読み込み（エラーハンドリング強化版）
async function loadScores() {
    try {
        console.log('Loading scores...');
        
        // ElectronAPIの存在確認
        if (!window.electronAPI || !window.electronAPI.getScores) {
            throw new Error('Electron APIが利用できません');
        }
        
        const result = await window.electronAPI.getScores();
        
        if (result.success) {
            // データの妥当性チェック
            if (!Array.isArray(result.scores)) {
                throw new Error('スコアデータの形式が正しくありません');
            }
            
            // 各スコアアイテムの検証
            const validatedScores = result.scores.map((score, index) => {
                if (!score || typeof score !== 'object') {
                    throw new Error(`スコアデータ ${index + 1} が無効です`);
                }
                
                if (!score.team || typeof score.team !== 'string') {
                    throw new Error(`チーム名が無効です (${index + 1})`);
                }
                
                if (typeof score.score !== 'number' || isNaN(score.score)) {
                    console.warn(`Invalid score for team "${score.team}", setting to 0`);
                    score.score = 0;
                }
                
                // 必要なプロパティが存在しない場合は初期化
                return {
                    team: score.team.trim(),
                    score: score.score,
                    addedScore: score.addedScore || 0,
                    isCurrentPlayer: Boolean(score.isCurrentPlayer)
                };
            });
            
            // 重複チェック
            const teamNames = validatedScores.map(s => s.team.toLowerCase());
            const uniqueNames = new Set(teamNames);
            if (teamNames.length !== uniqueNames.size) {
                console.warn('Duplicate team names found, removing duplicates');
                const seen = new Set();
                validatedScores = validatedScores.filter(score => {
                    const lowerName = score.team.toLowerCase();
                    if (seen.has(lowerName)) {
                        return false;
                    }
                    seen.add(lowerName);
                    return true;
                });
            }
            
            // 複数の自分のチームがある場合は最初の一つだけ残す
            let currentPlayerFound = false;
            validatedScores.forEach(score => {
                if (score.isCurrentPlayer) {
                    if (currentPlayerFound) {
                        score.isCurrentPlayer = false;
                    } else {
                        currentPlayerFound = true;
                    }
                }
            });
            
            currentScores = validatedScores.sort((a, b) => b.score - a.score);
            renderScores();
            
            console.log(`Loaded ${currentScores.length} teams successfully`);
            
        } else {
            const errorMessage = result.error || '不明なエラー';
            throw new Error(`スコアの読み込みに失敗しました: ${errorMessage}`);
        }
        
    } catch (error) {
        console.error('Error in loadScores:', error);
        showStatus('error', error.message);
        
        // エラー時は空の配列で初期化
        currentScores = [];
        renderScores();
    }
}

// スコア一覧を描画
function renderScores() {
    scoresContainer.innerHTML = '';
    
    if (currentScores.length === 0) {
        scoresContainer.innerHTML = '<div style="text-align: center; color: #a0aec0; padding: 20px;">スコアがありません</div>';
        return;
    }

    currentScores.forEach((score, index) => {
        const scoreItem = document.createElement('div');
        scoreItem.className = score.isCurrentPlayer ? 'score-item current-player' : 'score-item';
        scoreItem.innerHTML = `
            <input type="text" class="team-input" value="${score.team}"
                   onchange="updateTeamName(${index}, this.value)">
            <input type="number" class="score-input" value="${score.score}"
                   onchange="updateTeamScore(${index}, this.value)">
            <button class="current-player-btn ${score.isCurrentPlayer ? 'active' : ''}"
                    onclick="toggleCurrentPlayer(${index})">
                ${score.isCurrentPlayer ? '自分のチーム' : '自分に設定'}
            </button>
            <button class="delete-btn" onclick="deleteTeam(${index})">削除</button>
        `;
        scoresContainer.appendChild(scoreItem);
    });
}

// チーム名を更新（エラーハンドリング強化版）
function updateTeamName(index, newName) {
    try {
        // インデックスの妥当性チェック
        if (index < 0 || index >= currentScores.length) {
            throw new Error('無効なチームインデックスです');
        }
        
        // 入力値の検証
        const trimmedName = newName.trim();
        if (trimmedName === '') {
            throw new Error('チーム名を空にすることはできません');
        }
        
        if (trimmedName.length > 50) {
            throw new Error('チーム名は50文字以内で入力してください');
        }
        
        // 特殊文字のチェック
        if (!/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-_]+$/.test(trimmedName)) {
            throw new Error('チーム名に使用できない文字が含まれています');
        }
        
        // 重複チェック（大文字小文字を無視）
        const duplicateIndex = currentScores.findIndex((score, i) =>
            i !== index && score.team.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (duplicateIndex !== -1) {
            throw new Error('そのチーム名は既に存在します');
        }
        
        // 元の値を保存（復旧用）
        const originalName = currentScores[index].team;
        
        // 名前を更新
        currentScores[index].team = trimmedName;
        
        console.log(`Team name updated: "${originalName}" -> "${trimmedName}"`);
        
    } catch (error) {
        console.error('Error in updateTeamName:', error);
        showStatus('error', error.message);
        renderScores(); // 元の値に戻す
    }
}

// スコアを更新（エラーハンドリング強化版）
function updateTeamScore(index, newScore) {
    try {
        // インデックスの妥当性チェック
        if (index < 0 || index >= currentScores.length) {
            throw new Error('無効なチームインデックスです');
        }
        
        // スコア値の検証
        const score = parseInt(newScore);
        if (isNaN(score)) {
            throw new Error('スコアは数値で入力してください');
        }
        
        if (score < -999999 || score > 999999) {
            throw new Error('スコアは-999999から999999の範囲で入力してください');
        }
        
        // 元の値を保存（復旧用）
        const originalScore = currentScores[index].score;
        const teamName = currentScores[index].team;
        
        // スコアを更新
        currentScores[index].score = score;
        
        // スコア順で再ソート（isCurrentPlayerを保持）
        currentScores.sort((a, b) => b.score - a.score);
        renderScores();
        
        console.log(`Score updated for "${teamName}": ${originalScore} -> ${score}`);
        
    } catch (error) {
        console.error('Error in updateTeamScore:', error);
        showStatus('error', error.message);
        renderScores(); // 元の値に戻す
    }
}

// チームを削除
function deleteTeam(index) {
    if (confirm(`"${currentScores[index].team}" を削除しますか？`)) {
        currentScores.splice(index, 1);
        renderScores();
    }
}

// 自分のチームを切り替え（エラーハンドリング強化版）
function toggleCurrentPlayer(index) {
    try {
        // インデックスの妥当性チェック
        if (index < 0 || index >= currentScores.length) {
            throw new Error('無効なチームインデックスです');
        }
        
        // データ整合性チェック
        if (!currentScores[index] || !currentScores[index].team) {
            throw new Error('チームデータが破損しています');
        }
        
        const selectedTeam = currentScores[index];
        const teamName = selectedTeam.team;
        
        // 現在の自分のチームを記録（復旧用）
        const previousCurrentPlayerIndex = currentScores.findIndex(score => score.isCurrentPlayer);
        
        // 他の全てのチームのisCurrentPlayerをfalseに設定
        currentScores.forEach((score, i) => {
            score.isCurrentPlayer = (i === index);
        });
        
        // データ整合性の再チェック
        const currentPlayerCount = currentScores.filter(score => score.isCurrentPlayer).length;
        if (currentPlayerCount !== 1) {
            // 整合性エラーの場合、元に戻す
            currentScores.forEach((score, i) => {
                score.isCurrentPlayer = (i === previousCurrentPlayerIndex);
            });
            throw new Error('データの整合性エラーが発生しました');
        }
        
        renderScores();
        showStatus('success', `"${teamName}" を自分のチームに設定しました`);
        
        console.log(`Current player changed to: ${teamName} (index: ${index})`);
        
    } catch (error) {
        console.error('Error in toggleCurrentPlayer:', error);
        showStatus('error', `チーム設定に失敗しました: ${error.message}`);
        
        // エラー時は画面を再描画して状態を復旧
        renderScores();
    }
}

// 新しいチームを追加
addTeamBtn.addEventListener('click', () => {
    const teamName = newTeamNameInput.value.trim();
    const teamScore = parseInt(newTeamScoreInput.value) || 0;
    const isCurrentPlayer = newTeamIsCurrentPlayerCheckbox.checked;

    if (teamName === '') {
        showStatus('error', 'チーム名を入力してください');
        return;
    }

    // 同じチーム名があるかチェック
    if (currentScores.some(score => score.team === teamName)) {
        showStatus('error', 'そのチーム名は既に存在します');
        return;
    }

    // 新しいチームを自分のチームにする場合、他のチームのisCurrentPlayerをfalseに
    if (isCurrentPlayer) {
        currentScores.forEach(score => {
            score.isCurrentPlayer = false;
        });
    }

    const newTeam = {
        team: teamName,
        score: teamScore,
        addedScore: 0,
        isCurrentPlayer: isCurrentPlayer
    };

    currentScores.push(newTeam);
    currentScores.sort((a, b) => b.score - a.score);
    
    // 入力欄をクリア
    newTeamNameInput.value = '';
    newTeamScoreInput.value = '0';
    newTeamIsCurrentPlayerCheckbox.checked = false;
    
    renderScores();
    const message = isCurrentPlayer ?
        `"${teamName}" を追加し、自分のチームに設定しました` :
        `"${teamName}" を追加しました`;
    showStatus('success', message);
});

// Enterキーで追加
newTeamNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTeamBtn.click();
    }
});

newTeamScoreInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTeamBtn.click();
    }
});

// 保存（エラーハンドリング強化版）
saveBtn.addEventListener('click', async () => {
    try {
        // 保存前の検証
        if (!currentScores || !Array.isArray(currentScores)) {
            throw new Error('保存するデータが無効です');
        }
        
        // データ整合性の最終チェック
        const currentPlayerCount = currentScores.filter(score => score.isCurrentPlayer).length;
        if (currentPlayerCount > 1) {
            throw new Error('複数のチームが自分のチームに設定されています');
        }
        
        // 空のチーム名チェック
        const emptyTeams = currentScores.filter(score => !score.team || score.team.trim() === '');
        if (emptyTeams.length > 0) {
            throw new Error('チーム名が空のデータがあります');
        }
        
        // 重複チーム名チェック
        const teamNames = currentScores.map(s => s.team.toLowerCase());
        const uniqueNames = new Set(teamNames);
        if (teamNames.length !== uniqueNames.size) {
            throw new Error('重複するチーム名があります');
        }
        
        console.log('Saving scores...', currentScores);
        
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        
        // ElectronAPIの存在確認
        if (!window.electronAPI || !window.electronAPI.saveScores) {
            throw new Error('Electron APIが利用できません');
        }
        
        // タイムアウト付きで保存実行
        const savePromise = window.electronAPI.saveScores(currentScores);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('保存がタイムアウトしました')), 10000);
        });
        
        const result = await Promise.race([savePromise, timeoutPromise]);
        
        if (result.success) {
            showStatus('success', 'スコアを保存しました');
            console.log('Scores saved successfully');
            
            // 保存成功後、1秒待ってからウィンドウを閉じる
            setTimeout(() => {
                try {
                    window.close();
                } catch (closeError) {
                    console.error('Error closing window:', closeError);
                    showStatus('error', 'ウィンドウを閉じることができませんでした');
                }
            }, 1000);
        } else {
            const errorMessage = result.error || '不明なエラー';
            throw new Error(`スコアの保存に失敗しました: ${errorMessage}`);
        }
        
    } catch (error) {
        console.error('Error in save operation:', error);
        showStatus('error', error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 保存';
    }
});

// 全削除
resetBtn.addEventListener('click', () => {
    if (confirm('全てのスコアを削除しますか？この操作は取り消せません。')) {
        currentScores = [];
        renderScores();
        showStatus('success', '全てのスコアを削除しました');
    }
});

// キャンセル
cancelBtn.addEventListener('click', () => {
    window.close();
});

// ステータス表示
function showStatus(type, message) {
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    // 成功メッセージは3秒後に自動で非表示
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// ウィンドウを閉じる前の確認
window.addEventListener('beforeunload', (e) => {
    // 変更があった場合の確認は簡略化（必要に応じて実装）
});

// ESCキーでウィンドウを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.close();
    }
});