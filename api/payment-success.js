const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

const FULL_MODULE_ACCESS = ['r01', 'r02', 'r03', 'r04', 'r05'];

const TIER_CONFIG = {
  'r01-only': {
    product: 'r0ready-r01',
    modules: ['r01'],
    emailSubject: 'Your R0Ready R01 access link',
    emailIntro: 'Your R0Ready R01 access is ready. Bookmark the link below - it is your personal key to the app.',
    successTitle: "You're in. R01 access.",
    successText: 'You have full access to the R01 module: Financial services, regulation and ethics.',
  },
  'full-access': {
    product: 'r0ready-full',
    modules: FULL_MODULE_ACCESS,
    emailSubject: 'Your R0Ready full access link',
    emailIntro: 'Your R0Ready full access is ready. Bookmark the link below - it opens the live R01 module plus the current beta versions of R02 to R05.',
    successTitle: "You're in. Full access — all modules.",
    successText: 'You have access to R01 (live) plus R02, R03, R04, and R05 (currently in beta). You will automatically receive all updates and new content as modules are completed.',
  },
};

function inferTierFromIntent(paymentIntent, fallbackTier, fallbackProduct) {
  const metaTier = paymentIntent?.metadata?.tier;
  if (metaTier && TIER_CONFIG[metaTier]) return metaTier;

  const metaProduct = paymentIntent?.metadata?.product || fallbackProduct;
  if (metaProduct === 'r0ready-full') return 'full-access';
  if (metaProduct === 'r0ready-r01' || metaProduct === 'ciiready-r01') return 'r01-only';

  if (fallbackTier && TIER_CONFIG[fallbackTier]) return fallbackTier;
  if (paymentIntent?.amount === 2900) return 'full-access';
  return 'r01-only';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { paymentIntentId, email, name, tier: requestedTier, product: requestedProduct } = req.body || {};

    if (!paymentIntentId || !email) {
      return res.status(400).json({ error: 'paymentIntentId and email are required.' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not confirmed. Status: ' + paymentIntent.status });
    }

    const tier = inferTierFromIntent(paymentIntent, requestedTier, requestedProduct);
    const config = TIER_CONFIG[tier];
    const accessToken = crypto.randomUUID();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[supabase-config] Missing Supabase environment variables');
      return res.status(500).json({
        error: 'Payment succeeded, but we could not prepare your access automatically. Please contact hello@ciiready.com.',
      });
    }

    try {
      const insertRes = await fetch(supabaseUrl + '/rest/v1/purchases', {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          email: email,
          name: name || null,
          payment_intent_id: paymentIntentId,
          product: config.product,
          access_token: accessToken,
          access_tier: tier,
          modules_access: config.modules,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[supabase-insert]', insertRes.status, errText);
        return res.status(500).json({
          error: 'Payment succeeded, but we could not prepare your access automatically. Please contact hello@ciiready.com.',
        });
      }
    } catch (supabaseErr) {
      console.error('[supabase-insert]', supabaseErr.message);
      return res.status(500).json({
        error: 'Payment succeeded, but we could not prepare your access automatically. Please contact hello@ciiready.com.',
      });
    }

    const appUrl = process.env.APP_URL || 'https://app.r0ready.com';
    const accessLink = appUrl + '?token=' + accessToken;
    const fromEmail = process.env.FROM_EMAIL || 'R0Ready <hello@ciiready.com>';
    const firstName = name ? name.split(' ')[0] : '';

    const emailHtml = [
      '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">',
      '<div style="margin-bottom:32px">',
      '<span style="display:inline-block;background:#0D0F14;color:#00E676;font-weight:700;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">R0</span>',
      '<span style="font-size:18px;font-weight:600;margin-left:8px;color:#0c1421">R0Ready</span>',
      '</div>',
      '<h1 style="font-size:24px;font-weight:600;color:#0c1421;margin:0 0 12px;line-height:1.3">',
      firstName ? ('You\'re in, ' + firstName + '.') : 'You\'re in.',
      '</h1>',
      '<p style="font-size:15px;color:#5e6878;line-height:1.7;margin:0 0 28px">',
      config.emailIntro,
      '</p>',
      '<a href="' + accessLink + '" style="display:inline-block;background:#00E676;color:#0D0F14;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;margin-bottom:28px">',
      'Open R0Ready &rarr;',
      '</a>',
      '<p style="font-size:13px;color:#8d95a3;line-height:1.6;margin-top:28px">',
      'This link is unique to you. Save it somewhere safe - you can use it on any device.<br>If you have any questions, reply to this email.',
      '</p>',
      '<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e4e7ec">',
      '<p style="font-size:12px;color:#8d95a3;margin:0">',
      '&copy; 2026 R0Ready &middot; Not affiliated with the Chartered Insurance Institute',
      '</p></div></div>',
    ].join('\n');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: config.emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('[resend-email]', emailRes.status, errText);
      return res.status(200).json({
        success: true,
        accessToken: accessToken,
        tier: tier,
        product: config.product,
        emailSent: false,
        warning: 'Payment confirmed. Your email did not send, so open the app below and bookmark that link. If you need help, contact hello@ciiready.com.',
        successTitle: config.successTitle,
        successText: config.successText,
      });
    }

    return res.status(200).json({
      success: true,
      accessToken: accessToken,
      tier: tier,
      product: config.product,
      emailSent: true,
      successTitle: config.successTitle,
      successText: config.successText,
    });
  } catch (err) {
    console.error('[payment-success]', err.message);
    return res.status(500).json({ error: 'Internal error. Contact hello@ciiready.com' });
  }
};
