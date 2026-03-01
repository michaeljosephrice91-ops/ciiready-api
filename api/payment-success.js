// api/payment-success.js
// Vercel Serverless Function — POST /api/payment-success
// 1. Verifies the Stripe PaymentIntent succeeded
// 2. Generates a UUID access token
// 3. Sends an access email via Resend with a tokenised link
// 4. Logs the purchase to a Supabase table
//
// Required env vars:
//   STRIPE_SECRET_KEY   — sk_live_... or sk_test_...
//   RESEND_API_KEY      — re_...
//   SUPABASE_URL        — https://xxxx.supabase.co
//   SUPABASE_ANON_KEY   — eyJ...
//   APP_URL             — https://app.ciiready.co.uk (no trailing slash)
//   FROM_EMAIL          — CIIReady <hello@ciiready.co.uk>

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { paymentIntentId, email, name, product } = req.body || {};

    if (!paymentIntentId || !email) {
      return res.status(400).json({ error: 'paymentIntentId and email are required.' });
    }

    // 1. Verify the PaymentIntent succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not confirmed. Status: ' + paymentIntent.status });
    }

    // 2. Generate access token
    const accessToken = crypto.randomUUID();

    // 3. Log to Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const insertRes = await fetch(supabaseUrl + '/rest/v1/purchases', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          email: email,
          name: name || null,
          payment_intent_id: paymentIntentId,
          product: product || 'ciiready-r01',
          access_token: accessToken,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[supabase-insert]', insertRes.status, errText);
      }
    }

    // 4. Send access email via Resend
    const appUrl = process.env.APP_URL || 'https://app.ciiready.co.uk';
    const accessLink = appUrl + '?token=' + accessToken;
    const fromEmail = process.env.FROM_EMAIL || 'CIIReady <hello@ciiready.co.uk>';
    const firstName = name ? name.split(' ')[0] : '';

    const emailHtml = [
      '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">',
      '<div style="margin-bottom:32px">',
      '<span style="display:inline-block;background:#3b6cf5;color:#fff;font-weight:700;font-size:13px;padding:6px 12px;border-radius:8px">CR</span>',
      '<span style="font-size:18px;font-weight:600;margin-left:8px;color:#0c1421">CIIReady</span>',
      '</div>',
      '<h1 style="font-size:24px;font-weight:600;color:#0c1421;margin:0 0 12px;line-height:1.3">',
      firstName ? ('You\'re in, ' + firstName + '.') : 'You\'re in.',
      '</h1>',
      '<p style="font-size:15px;color:#5e6878;line-height:1.7;margin:0 0 28px">',
      'Your CIIReady R01 access is ready. Bookmark the link below — it\'s your personal key to the app. No password needed.',
      '</p>',
      '<a href="' + accessLink + '" style="display:inline-block;background:#3b6cf5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;margin-bottom:28px">',
      'Open CIIReady R01 &rarr;',
      '</a>',
      '<p style="font-size:13px;color:#8d95a3;line-height:1.6;margin-top:28px">',
      'This link is unique to you. Save it somewhere safe — you can use it on any device.<br>If you have any questions, reply to this email.',
      '</p>',
      '<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e4e7ec">',
      '<p style="font-size:12px;color:#8d95a3;margin:0">',
      '&copy; 2026 CIIReady &middot; Not affiliated with the Chartered Insurance Institute',
      '</p></div></div>',
    ].join('\n');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Your CIIReady R01 access link',
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('[resend-email]', emailRes.status, errText);
      return res.status(500).json({ error: 'Payment succeeded but email failed. Contact hello@ciiready.co.uk' });
    }

    return res.status(200).json({ success: true, accessToken: accessToken });
  } catch (err) {
    console.error('[payment-success]', err.message);
    return res.status(500).json({ error: 'Internal error. Contact hello@ciiready.co.uk' });
  }
};
