import { Redis } from '@upstash/redis';

// Upstash Redis接続設定
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SAROWIN_AUTH_TOKEN = 'sarowin-team';
const REDIS_KEY = 'sarowin-recruitment-positions';

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 簡単な認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${SAROWIN_AUTH_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
      // データ保存
      const { data, timestamp, userId } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'Data is required' });
      }

      // Redisに保存
      await redis.set(REDIS_KEY, JSON.stringify({
        data: data,
        timestamp: timestamp || new Date().toISOString(),
        userId: userId || 'anonymous',
        lastUpdate: new Date().toISOString()
      }));

      res.status(200).json({ 
        success: true, 
        message: 'Data saved successfully',
        timestamp: new Date().toISOString()
      });

    } else if (req.method === 'GET') {
      // データ取得
      const result = await redis.get(REDIS_KEY);
      
      if (!result) {
        // 初回アクセス時はnullを返す
        return res.status(200).json({ 
          data: null, 
          timestamp: null,
          message: 'No data found' 
        });
      }

      // 文字列の場合はパース、オブジェクトの場合はそのまま返す
      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
      
      res.status(200).json({
        data: parsedResult.data,
        timestamp: parsedResult.timestamp,
        lastUpdate: parsedResult.lastUpdate
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
