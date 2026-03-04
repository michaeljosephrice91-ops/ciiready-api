import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, progress, seen, streak, mockResults } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      token,
      progress: progress || {},
      seen: seen || [],
      streak: streak || { count: 0, lastDate: null },
      mock_results: mockResults || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' });

  if (error) {
    console.error('Save progress error:', error);
    return res.status(500).json({ error: 'Failed to save progress' });
  }

  return res.status(200).json({ ok: true });
}
