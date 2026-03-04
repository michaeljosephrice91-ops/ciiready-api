import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const { data, error } = await supabase
    .from('user_progress')
    .select('progress, seen, streak, mock_results')
    .eq('token', token)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = row not found (fine for new users)
    console.error('Load progress error:', error);
    return res.status(500).json({ error: 'Failed to load progress' });
  }

  if (!data) {
    // New user — return empty state
    return res.status(200).json({
      progress: {},
      seen: [],
      streak: { count: 0, lastDate: null },
      mockResults: {},
    });
  }

  return res.status(200).json({
    progress: data.progress || {},
    seen: data.seen || [],
    streak: data.streak || { count: 0, lastDate: null },
    mockResults: data.mock_results || {},
  });
}
