const { createClient } = require('@supabase/supabase-js');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, action } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const supabase = getSupabaseClient();
    const mode = action === 'complete' ? 'complete' : 'start';
    const payload =
      mode === 'complete'
        ? { email: normalizedEmail, started_demo: true, completed_demo: true }
        : { email: normalizedEmail, started_demo: true };

    const { error } = await supabase
      .from('demo_leads')
      .upsert(payload, { onConflict: 'email' });

    if (error) {
      console.error('[demo-lead]', error.message);
      return res.status(500).json({ error: 'We could not save your demo access right now. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      email: normalizedEmail,
      action: mode,
    });
  } catch (err) {
    console.error('[demo-lead]', err.message);
    return res.status(500).json({ error: 'Internal error. Please try again.' });
  }
};
