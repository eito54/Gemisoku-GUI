const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');

class EmbeddedServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 3001; // メインの開発サーバーと重複しないポート
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    //静的ファイルの提供
    this.app.use(express.static(path.join(__dirname, 'static')));
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // CORS設定
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  setupRoutes() {
    // メインページ
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });

    // 静的ページ（オーバーレイ用）
    this.app.get('/static/', (req, res) => {
      res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });

    // OBS API
    this.app.post('/api/obs', async (req, res) => {
      try {
        const OBSWebSocket = require('obs-websocket-js').default;
        const obs = new OBSWebSocket();

        // 設定ファイルを動的に読み込み
        let config;
        try {
          const fs = require('fs');
          
          // ユーザーデータディレクトリから読み込み
          const { app } = require('electron');
          const userDataPath = app ? app.getPath('userData') : __dirname;
          const configPath = path.join(userDataPath, 'config.json');
          
          console.log('Looking for config file at:', configPath);
          
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
            console.log('Config loaded successfully:', JSON.stringify(config, null, 2));
          } else {
            console.log('Config file not found, using default settings');
            throw new Error('設定ファイルが見つかりません');
          }
        } catch (configError) {
          console.error('Config loading error:', configError.message);
          return res.json({
            success: false,
            error: `設定読み込みエラー: ${configError.message}`
          });
        }

        // OBS WebSocketのURL構築（ポート設定対応、IPv4強制）
        const obsPort = config.obsPort || '4455';
        // localhostの場合は明示的に127.0.0.1を使用してIPv6を回避
        const obsIp = config.obsIp === 'localhost' ? '127.0.0.1' : config.obsIp;
        const obsUrl = `ws://${obsIp}:${obsPort}`;
        console.log('Using OBS config:', {
          ip: config.obsIp,
          port: obsPort,
          hasPassword: !!(config.obsPassword && config.obsPassword.trim()),
          sourceName: config.obsSourceName
        });
        
        try {
          console.log(`Connecting to OBS at ${obsUrl}...`);
          
          if (config.obsPassword && config.obsPassword.trim() !== '') {
            console.log('Connecting to OBS with password authentication...');
            await obs.connect(obsUrl, config.obsPassword);
          } else {
            console.log('Connecting to OBS without authentication...');
            // パスワードが設定されていない場合は認証なしで接続
            await obs.connect(obsUrl);
          }
          
          console.log('OBS connection successful');
        } catch (connectError) {
          console.error('OBS connection failed:', connectError.message);
          console.error('Full error:', connectError);
          
          // 認証エラーの場合、異なるアプローチを試行
          if (connectError.message.includes('authentication')) {
            console.log('Authentication error detected, trying alternative methods...');
            
            // パスワードが設定されている場合でも、一度認証なしを試行
            try {
              console.log('Retrying without authentication...');
              await obs.connect(obsUrl);
              console.log('Connection successful without authentication');
            } catch (retryError) {
              console.error('Retry without auth failed:', retryError.message);
              // 空文字でのパスワード認証を試行
              try {
                console.log('Retrying with empty password...');
                await obs.connect(obsUrl, '');
                console.log('Connection successful with empty password');
              } catch (finalError) {
                console.error('Final retry failed:', finalError.message);
                throw new Error(`OBS接続に失敗しました。設定を確認してください。詳細: ${finalError.message}`);
              }
            }
          } else {
            throw connectError;
          }
        }

        const screenshot = await obs.call('GetSourceScreenshot', {
          sourceName: config.obsSourceName,
          imageFormat: 'jpg',
          imageWidth: 1920,
          imageHeight: 1080,
          imageCompressionQuality: 80
        });

        await obs.disconnect();

        res.json({
          success: true,
          screenshot: screenshot.imageData
        });
      } catch (error) {
        console.error('OBS API Error:', error);
        res.json({
          success: false,
          error: error.message
        });
      }
    });

    // Gemini API
    this.app.post('/api/gemini', async (req, res) => {
      try {
        const { GoogleGenerativeAI, GoogleGenerativeAIError } = require('@google/generative-ai');
        
        // 設定ファイルを動的に読み込み
        let config;
        try {
          const fs = require('fs');
          const { app } = require('electron');
          const userDataPath = app ? app.getPath('userData') : __dirname;
          const configPath = path.join(userDataPath, 'config.json');
          
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
          } else {
            throw new Error('設定ファイルが見つかりません');
          }
        } catch (configError) {
          return res.json({
            success: false,
            error: `設定読み込みエラー: ${configError.message}`
          });
        }
        
        if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
          return res.json({
            success: false,
            error: 'Gemini APIキーが設定されていません'
          });
        }
        
        console.log('Using Gemini API key (first 10 chars):', config.geminiApiKey.substring(0, 10) + '...');
        
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const { prompt, imageData } = req.body;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageData.replace(/^data:image\/[a-z]+;base64,/, ''),
              mimeType: "image/jpeg"
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();

        res.json({
          success: true,
          response: text
        });
      } catch (error) {
        console.error('Gemini API Error:', error);
        
        let errorMessage = error.message;
        let statusCode = 500;
        
        // GoogleGenerativeAIErrorの詳細処理
        if (error instanceof GoogleGenerativeAIError) {
          console.error('Gemini API specific error:', error);
          
          if (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID')) {
            errorMessage = 'APIキーが無効です。正しいGemini APIキーを設定してください。';
            statusCode = 400;
          } else if (error.message.includes('quota') || error.message.includes('RATE_LIMIT')) {
            errorMessage = 'API使用量の上限に達しました。しばらく待ってから再試行してください。';
            statusCode = 429;
          } else {
            errorMessage = `Gemini APIエラー: ${error.message}`;
          }
        }
        
        res.status(statusCode).json({
          success: false,
          error: errorMessage
        });
      }
    });

    // レース結果取得API
    this.app.post('/api/fetch-race-results', async (req, res) => {
      try {
        const { imageUrl } = req.body;
        const useTotalScore = req.query.useTotalScore === 'true';

        const prompt = useTotalScore ?
          `## instruction ##
  これは「マリオカート8DX」のレース結果画面の画像です。
  画像を解析して、全プレイヤーのユーザー名、チーム情報、および画面右端に表示されている総合得点を抽出してください。
  総合得点は、各プレイヤーの行の一番右に表示されている数字です。
  指定されたJSON形式で出力してください。

  ## extraction_rules ##
  - [name]: プレイヤーのユーザー名をそのまま抽出してください。
  - [team]: 以下の厳格なルールでチーム名を識別してください：
    
    **基本方針：最長共通先頭部分を優先し、一度決定したら変更しない**
    
    **ステップ1：同じ先頭文字のプレイヤーをグループ化**
    - 先頭文字が同じプレイヤーを全て特定する
    - アルファベットは大文字で統一（「a」と「A」は同じ）
    
    **ステップ2：各グループ内で最長共通先頭部分を決定**
    - 同じ先頭文字のプレイヤー同士で、何文字まで共通しているかを確認
    - 例：「パンチ」「パンダ」→ 共通部分「パン」（2文字）
    - 例：「ABC」「ABD」→ 共通部分「AB」（2文字）
    - 例：「レッドゾーンX」「レッドゾーンZ」→ 共通部分「レッドゾーン」
    
    **ステップ3：チーム名を決定**
    - 共通部分が2文字以上ある場合：その共通部分をチーム名とする
    - 共通部分が1文字のみの場合：先頭1文字をチーム名とする
    
    **重要：一貫性の絶対保持**
    - 一度「パ」チームと決定されたら、今後「パン」に変更しない
    - 一度「パン」チームと決定されたら、今後「パ」に短縮しない
    - 初回で決定されたチーム名の長さと内容を維持する
    - 新しいプレイヤーが追加されても、既存のチーム名は変更しない
    
    **具体例**：
    - 「パンチ」「パンダ」が最初に検出 → 「パン」チーム確定
    - 後に「パトロール」が追加されても → 「パ」チームではなく「パン」チームを維持
    - 「RS」「RZ」が最初に検出 → 「R」チーム確定
    - 後に「RED」が追加されても → 「R」チームを維持
    
    **例外処理**
    - 空白や特殊文字のみの場合は "UNKNOWN"
  - [total_score]: プレイヤーの総合得点を整数で抽出してください。これは通常、各プレイヤー行の最も右側に表示される数字です。
  - [isCurrentPlayer]: プレイヤーの行の背景が黄色かどうかを判別してください。
    - 黄色背景は、そのプレイヤーが操作プレイヤー（マイプレイヤー）であることを示します。
    - 黄色背景が検出された場合、true を設定してください。それ以外の場合は false を設定してください。(boolean値で返す)
    - 背景色は完全な黄色 (#FFFF00) ではない可能性があります。濃い黄色やオレンジに近い黄色も黄色背景とみなしてください。
    - 透明度や他の色との混合により、判別が難しい場合があるため、慎重に判断してください。明らかに黄色系の背景と識別できる場合にのみ true としてください。

  ## output_format ##
  以下のJSON形式で、全プレイヤーの情報を "results" 配列に含めてください。
  もし、提供された画像が「マリオカート8DX」のリザルト画面ではない、またはリザルト情報を読み取れない場合は、代わりに以下の形式のエラーJSONを出力してください:
  {
    "error": "リザルト画面ではないか、情報を読み取れませんでした。"
  }

  リザルト情報が読み取れる場合のJSON形式 (キーと値はダブルクォートで囲んでください):
  {
    "results": [
      {
        "name": "[name]",
        "team": "[team]",
        "score": [total_score],
        "isCurrentPlayer": [isCurrentPlayer]
      }
    ]
  }
  ## important_notes ##
  - 必ず指定されたJSON形式のいずれかで応答してください。
  - ユーザー名は画像に表示されている通りに正確に抽出してください。
  - プレイヤーは最大12人です。画像に表示されている全プレイヤーの情報を抽出してください。
  - 総合得点の抽出を最優先してください。
  - チーム名の判別は非常に重要です。同じチームに所属するプレイヤーが同じチーム名になるよう注意してください。` : `
  ## instruction ##
  これは「マリオカート8DX」のレース結果画面の画像です。
  画像を解析して、全プレイヤーの順位、ユーザー名、チーム情報、および合計得点を抽出し、指定されたJSON形式で出力してください。

  結果画面には通常、各プレイヤーについて左から以下の情報が含まれています（レイアウトは若干異なる場合があります）：
  1. 順位 (例: 1st, 2nd, 3rd... または単に数字)
  2. ユーザー名
  3. プレイヤーごとの合計得点 (例: 1500, 1250...)

  ## extraction_rules ##
  - [rank]: プレイヤーの順位を整数で抽出してください (例: 1, 2, 3, ..., 12)。
  - [name]: プレイヤーのユーザー名をそのまま抽出してください。
  - [totalScore]: プレイヤーの合計得点を整数で抽出してください (例: 1500, 1250)。
  - [team]: 以下の厳格なルールでチーム名を識別してください：
    
    **基本方針：最長共通先頭部分を優先し、一度決定したら変更しない**
    
    **ステップ1：同じ先頭文字のプレイヤーをグループ化**
    - 先頭文字が同じプレイヤーを全て特定する
    - アルファベットは大文字で統一（「a」と「A」は同じ）
    
    **ステップ2：各グループ内で最長共通先頭部分を決定**
    - 同じ先頭文字のプレイヤー同士で、何文字まで共通しているかを確認
    - 例：「パンチ」「パンダ」→ 共通部分「パン」（2文字）
    - 例：「ABC」「ABD」→ 共通部分「AB」（2文字）
    - 例：「レッドゾーンX」「レッドゾーンZ」→ 共通部分「レッドゾーン」
    
    **ステップ3：チーム名を決定**
    - 共通部分が2文字以上ある場合：その共通部分をチーム名とする
    - 共通部分が1文字のみの場合：先頭1文字をチーム名とする
    
    **重要：一貫性の絶対保持**
    - 一度「パ」チームと決定されたら、今後「パン」に変更しない
    - 一度「パン」チームと決定されたら、今後「パ」に短縮しない
    - 初回で決定されたチーム名の長さと内容を維持する
    - 新しいプレイヤーが追加されても、既存のチーム名は変更しない
    
    **具体例**：
    - 「パンチ」「パンダ」が最初に検出 → 「パン」チーム確定
    - 後に「パトロール」が追加されても → 「パ」チームではなく「パン」チームを維持
    - 「RS」「RZ」が最初に検出 → 「R」チーム確定
    - 後に「RED」が追加されても → 「R」チームを維持
    
    **例外処理**
    - 空白や特殊文字のみの場合は "UNKNOWN"
  - [isCurrentPlayer]: プレイヤーの行の背景が黄色かどうかを判別してください。
    - 黄色背景は、そのプレイヤーが操作プレイヤー（マイプレイヤー）であることを示します。
    - 黄色背景が検出された場合、true を設定してください。それ以外の場合は false を設定してください。(boolean値で返す)
    - 背景色は完全な黄色 (#FFFF00) ではない可能性があります。濃い黄色やオレンジに近い黄色も黄色背景とみなしてください。
    - 透明度や他の色との混合により、判別が難しい場合があるため、慎重に判断してください。明らかに黄色系の背景と識別できる場合にのみ true としてください。

  ## output_format ##
  以下のJSON形式で、全プレイヤーの情報を "results" 配列に含めてください。
  もし、提供された画像が「マリオカート8DX」のリザルト画面ではない、またはリザルト情報を読み取れない場合は、代わりに以下の形式のエラーJSONを出力してください:
  {
    "error": "リザルト画面ではないか、情報を読み取れませんでした。"
  }

  リザルト情報が読み取れる場合のJSON形式 (キーと値はダブルクォートで囲んでください):
  {
    "results": [
      {
        "rank": "[rank]",
        "name": "[name]",
        "team": "[team]",
        "totalScore": "[totalScore]",
        "isCurrentPlayer": [isCurrentPlayer] // boolean (true/false) を直接記述
      }
      // ... 他のプレイヤー情報が続く
    ]
  }
  ## important_notes ##
  - 必ず指定されたJSON形式のいずれかで応答してください。
  - ユーザー名は画像に表示されている通りに正確に抽出してください。
  - プレイヤーは最大12人です。画像に表示されている全プレイヤーの情報を抽出してください。
  - チーム名の判別は非常に重要です。同じチームに所属するプレイヤーが同じチーム名になるよう注意してください。
  
  ## チーム名判別例 ##
  例1: 以下のような結果の場合
  1. チーズバーガー
  2. てりやきバーガー
  3. つるみバーガー
  → 全て「バーガー」というチーム名を使用

  例2: 以下のような結果の場合
  5. レッドゾーンX
  6. レッドゾーンZ
  7. レッドゾーン☆
  12. レッドゾーンF
  → 全て「レッドゾーン」というチーム名を使用

  例3: 以下のような結果の場合
  4. I'm Kotaro
  8. I'm Masaya
  11. I'm Tomoya
  → 全て「I'm」というチーム名を使用
`;

        // Gemini APIを直接呼び出し（設定からAPIキーを使用）
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        
        // 設定ファイルを読み込み
        let config;
        try {
          const fs = require('fs');
          const { app } = require('electron');
          const userDataPath = app ? app.getPath('userData') : __dirname;
          const configPath = path.join(userDataPath, 'config.json');
          
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
          } else {
            throw new Error('設定ファイルが見つかりません');
          }
        } catch (configError) {
          throw new Error(`設定読み込みエラー: ${configError.message}`);
        }
        
        if (!config.geminiApiKey) {
          throw new Error('Gemini APIキーが設定されていません');
        }
        
        console.log('Using Gemini API key (first 10 chars):', config.geminiApiKey.substring(0, 10) + '...');
        
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        // Base64データからGemini用のパートを作成
        function fileToGenerativePart(base64Data) {
          const match = base64Data.match(/^data:(.+);base64,(.+)$/);
          if (!match || match.length !== 3) {
            throw new Error("Invalid base64 data URL format.");
          }
          return {
            inlineData: {
              data: match[2],
              mimeType: match[1],
            },
          };
        }
        
        const imagePart = fileToGenerativePart(imageUrl);
        
        let geminiResponse;
        
        try {
          console.log('Calling Gemini API directly...');
          const result = await model.generateContent([prompt, imagePart]);
          const response = result.response;
          const text = response.text();
          
          if (!text) {
            throw new Error('Gemini APIからレスポンスが取得できませんでした');
          }
          
          console.log('Gemini API raw response:', text);
          
          // JSONレスポンスをクリーンアップ
          const cleanedText = text
            .replaceAll("\n", "")
            .replaceAll("```json", "")
            .replaceAll("```", "");
          
          geminiResponse = {
            success: true,
            response: cleanedText
          };
          
          console.log('Gemini API call successful');
        } catch (geminiError) {
          console.error('Gemini API Error:', geminiError);
          throw new Error(`Gemini APIエラー: ${geminiError.message}`);
        }

        // レスポンスをパース
        try {
          const cleanText = geminiResponse.response.replace(/```json\s*|\s*```/g, '').trim();
          console.log('Gemini API raw response (cleaned):', cleanText);
          const parsedResponse = JSON.parse(cleanText);
          
          res.json({
            success: true,
            response: parsedResponse
          });
        } catch (parseError) {
          console.error('Response parsing error:', parseError);
          console.error('Raw response:', geminiResponse.response);
          throw new Error('レスポンスのパースに失敗しました');
        }

      } catch (error) {
        console.error('Race Results API Error:', error);
        res.json({
          success: false,
          error: error.message
        });
      }
    });

    // 共通関数: スコアファイルパスを取得
    const getScoresPath = () => {
      try {
        const { app } = require('electron');
        if (app && app.getPath) {
          // Electronアプリの場合はユーザーデータディレクトリを使用
          const userDataPath = app.getPath('userData');
          return path.join(userDataPath, 'scores.json');
        }
      } catch (electronError) {
        // Electronが利用できない場合のフォールバック
      }
      // フォールバック: 開発環境用
      return path.join(__dirname, 'scores.json');
    };

    // スコア保存/取得API（アニメーション制御フラグ対応）
    this.app.get('/api/scores', (req, res) => {
      try {
        const fs = require('fs');
        const scoresPath = getScoresPath();
        const metaPath = path.join(path.dirname(scoresPath), 'scores-meta.json');
        
        let scores = [];
        let isOverallUpdate = false;
        let showRemainingRaces = true;
        
        if (fs.existsSync(scoresPath)) {
          scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
        }
        
        // メタデータから更新種別を読み取り
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            isOverallUpdate = meta.isOverallUpdate || false;
            
            // フラグを読み取った後、リセット
            if (isOverallUpdate) {
              fs.writeFileSync(metaPath, JSON.stringify({ isOverallUpdate: false }, null, 2));
            }
          } catch (metaError) {
            console.log('Meta file read error (non-critical):', metaError.message);
          }
        }
        
        // 設定から残りレース数表示設定を取得
        try {
          const { app } = require('electron');
          const userDataPath = app ? app.getPath('userData') : __dirname;
          const configPath = path.join(userDataPath, 'config.json');
          
          if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            showRemainingRaces = config.showRemainingRaces !== false; // デフォルトはtrue
          }
        } catch (configError) {
          console.log('Config read error (non-critical):', configError.message);
          showRemainingRaces = true; // デフォルト値
        }
        
        // 残りレース数を計算
        // 12レース完了時の総合計点数は984点（82 × 12）
        // 残りレース数 = (984 - 現在の全プレイヤーの合計点数) ÷ 82
        const totalScores = scores.reduce((sum, team) => sum + (team.score || 0), 0);
        const remainingRaces = Math.max(0, Math.floor((984 - totalScores) / 82));
        
        res.json({
          scores,
          isOverallUpdate,
          remainingRaces: showRemainingRaces ? remainingRaces : null, // 設定に応じて表示制御
          showRemainingRaces
        });
      } catch (error) {
        console.error('Error reading scores:', error);
        res.json({ scores: [], isOverallUpdate: false, remainingRaces: null, showRemainingRaces: true });
      }
    });

    this.app.post('/api/scores', (req, res) => {
      try {
        const fs = require('fs');
        const scoresPath = getScoresPath();
        const metaPath = path.join(path.dirname(scoresPath), 'scores-meta.json');
        const scores = req.body;
        const isOverallUpdate = req.query.isOverallUpdate === 'true';
        
        // ディレクトリが存在しない場合は作成
        const scoreDir = path.dirname(scoresPath);
        if (!fs.existsSync(scoreDir)) {
          fs.mkdirSync(scoreDir, { recursive: true });
        }
        
        // スコアデータを保存
        fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
        
        // メタデータを保存（合計点計測の場合）
        if (isOverallUpdate) {
          fs.writeFileSync(metaPath, JSON.stringify({ isOverallUpdate: true }, null, 2));
        }
        
        console.log('Scores saved with metadata:', { isOverallUpdate });
        res.json({ success: true });
      } catch (error) {
        console.error('Error saving scores:', error);
        res.json({ success: false, error: error.message });
      }
    });

    // 設定保存API
    this.app.post('/api/config', async (req, res) => {
      try {
        const fs = require('fs');
        const ConfigManager = require('./config-manager');
        const configManager = new ConfigManager();
        
        // 実行時の正確なパスを確認
        console.log('Current __dirname:', __dirname);
        console.log('Process cwd:', process.cwd());
        console.log('App path:', process.execPath);
        
        // ユーザーデータディレクトリを使用（Electronアプリの場合）
        const { app } = require('electron');
        const userDataPath = app ? app.getPath('userData') : __dirname;
        const configPath = path.join(userDataPath, 'config.json');
        
        const config = req.body;
        console.log('Setting save request received:', JSON.stringify(config, null, 2));
        console.log('Config will be saved to:', configPath);
        
        // 設定の検証（OBSパスワードは必須ではない）
        if (!config.obsIp || !config.obsPort || !config.obsSourceName || !config.geminiApiKey) {
          console.log('Validation failed - missing required fields');
          return res.json({
            success: false,
            error: 'OBS IPアドレス、ポート、ソース名、Gemini APIキーは必須です'
          });
        }
        
        // Gemini APIキーの有効性をテスト
        console.log('Testing Gemini API key...');
        const apiKeyTest = await configManager.testGeminiApiKey(config.geminiApiKey);
        if (!apiKeyTest.isValid) {
          console.log('API key validation failed:', apiKeyTest.error);
          return res.json({
            success: false,
            error: apiKeyTest.error
          });
        }
        console.log('API key validation successful');
        
        console.log('Writing config to:', configPath);
        
        // ディレクトリが存在しない場合は作成
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          console.log('Creating config directory:', configDir);
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Config file written successfully');
        
        // .envファイルも更新
        await configManager.updateEnvFile(config);
        
        // ファイルが実際に作成されたか確認
        if (fs.existsSync(configPath)) {
          const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          console.log('Saved config verification:', JSON.stringify(savedConfig, null, 2));
        } else {
          console.error('Config file was not created!');
        }
        
        res.json({ success: true, message: 'APIキーが有効で、設定が正常に保存されました' });
      } catch (error) {
        console.error('Config save error:', error);
        res.json({ success: false, error: error.message });
      }
    });

    // 設定取得API
    this.app.get('/api/config', (req, res) => {
      try {
        const fs = require('fs');
        
        // ユーザーデータディレクトリから読み込み
        const { app } = require('electron');
        const userDataPath = app ? app.getPath('userData') : __dirname;
        const configPath = path.join(userDataPath, 'config.json');
        
        console.log('Config retrieval from:', configPath);
        
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData);
          console.log('Config retrieved:', JSON.stringify(config, null, 2));
          res.json(config);
        } else {
          console.log('Config file not found, returning defaults');
          // デフォルト設定を返す
          res.json({
            obsIp: '127.0.0.1',
            obsPort: '4455',
            obsPassword: '',
            obsSourceName: '映像キャプチャデバイス',
            geminiApiKey: '',
            theme: 'light',
            showRemainingRaces: true
          });
        }
      } catch (error) {
        console.error('Config retrieval error:', error);
        res.json({
          obsIp: '127.0.0.1',
          obsPort: '4455',
          obsPassword: '',
          obsSourceName: '映像キャプチャデバイス',
          geminiApiKey: '',
          theme: 'light',
          showRemainingRaces: true
        });
      }
    });

    // ローカルIP取得API
    this.app.get('/api/localIp', (req, res) => {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      let localIP = 'localhost';

      for (const interfaceName of Object.keys(interfaces)) {
        for (const iface of interfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
      }

      res.json({ ip: localIP });
    });

    // スコアリセットAPI
    this.app.post('/api/scores/reset', (req, res) => {
      try {
        const fs = require('fs');
        const scoresPath = getScoresPath();
        
        console.log('Resetting scores at path:', scoresPath);
        
        // ディレクトリが存在しない場合は作成
        const scoreDir = path.dirname(scoresPath);
        if (!fs.existsSync(scoreDir)) {
          fs.mkdirSync(scoreDir, { recursive: true });
          console.log('Created scores directory:', scoreDir);
        }
        
        // 空の配列でリセット
        fs.writeFileSync(scoresPath, JSON.stringify([], null, 2));
        console.log('Scores reset successfully at:', scoresPath);
        
        res.json({
          success: true,
          message: 'スコアがリセットされました'
        });
      } catch (error) {
        console.error('Score reset error:', error);
        console.error('Error details:', error.message);
        res.status(500).json({
          success: false,
          error: `スコアリセットに失敗しました: ${error.message}`
        });
      }
    });
  }

  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      
      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`Embedded server running on http://127.0.0.1:${this.port}`);
        resolve(this.port);
      });
      
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.port += 1;
          this.start().then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Embedded server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort() {
    return this.port;
  }
}

module.exports = EmbeddedServer;