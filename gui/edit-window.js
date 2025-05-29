// DOM要素の取得
const scoresContainer = document.getElementById('scoresContainer');
const statusDiv = document.getElementById('status');
const newTeamNameInput = document.getElementById('newTeamName');
const newTeamScoreInput = document.getElementById('newTeamScore');
const addTeamBtn = document.getElementById('addTeamBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const cancelBtn = document.getElementById('cancelBtn');

let currentScores = [];

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadScores();
});

// スコアを読み込み
async function loadScores() {
    try {
        const result = await window.electronAPI.getScores();
        if (result.success) {
            currentScores = result.scores.sort((a, b) => b.score - a.score);
            renderScores();
        } else {
            showStatus('error', 'スコアの読み込みに失敗しました: ' + result.error);
        }
    } catch (error) {
        showStatus('error', 'スコアの読み込みに失敗しました: ' + error.message);
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
        scoreItem.className = 'score-item';
        scoreItem.innerHTML = `
            <input type="text" class="team-input" value="${score.team}" 
                   onchange="updateTeamName(${index}, this.value)">
            <input type="number" class="score-input" value="${score.score}" 
                   onchange="updateTeamScore(${index}, this.value)">
            <button class="delete-btn" onclick="deleteTeam(${index})">削除</button>
        `;
        scoresContainer.appendChild(scoreItem);
    });
}

// チーム名を更新
function updateTeamName(index, newName) {
    if (newName.trim() === '') {
        showStatus('error', 'チーム名を空にすることはできません');
        renderScores(); // 元の値に戻す
        return;
    }
    currentScores[index].team = newName.trim();
}

// スコアを更新
function updateTeamScore(index, newScore) {
    const score = parseInt(newScore) || 0;
    currentScores[index].score = score;
    // スコア順で再ソート
    currentScores.sort((a, b) => b.score - a.score);
    renderScores();
}

// チームを削除
function deleteTeam(index) {
    if (confirm(`"${currentScores[index].team}" を削除しますか？`)) {
        currentScores.splice(index, 1);
        renderScores();
    }
}

// 新しいチームを追加
addTeamBtn.addEventListener('click', () => {
    const teamName = newTeamNameInput.value.trim();
    const teamScore = parseInt(newTeamScoreInput.value) || 0;

    if (teamName === '') {
        showStatus('error', 'チーム名を入力してください');
        return;
    }

    // 同じチーム名があるかチェック
    if (currentScores.some(score => score.team === teamName)) {
        showStatus('error', 'そのチーム名は既に存在します');
        return;
    }

    const newTeam = {
        team: teamName,
        score: teamScore,
        addedScore: 0,
        isCurrentPlayer: false
    };

    currentScores.push(newTeam);
    currentScores.sort((a, b) => b.score - a.score);
    
    // 入力欄をクリア
    newTeamNameInput.value = '';
    newTeamScoreInput.value = '0';
    
    renderScores();
    showStatus('success', `"${teamName}" を追加しました`);
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

// 保存
saveBtn.addEventListener('click', async () => {
    try {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        
        const result = await window.electronAPI.saveScores(currentScores);
        
        if (result.success) {
            showStatus('success', 'スコアを保存しました');
            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            showStatus('error', 'スコアの保存に失敗しました: ' + result.error);
        }
    } catch (error) {
        showStatus('error', 'スコアの保存に失敗しました: ' + error.message);
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