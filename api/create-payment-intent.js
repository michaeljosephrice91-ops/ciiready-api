const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const TIER_CONFIG = {
  'r01-only': {
    amount: 1900,
    product: 'r0ready-r01',
    stripeName: 'R0Ready R01',
  },
  'full-access': {
    amount: 2900,
    product: 'r0ready-full',
    stripeName: 'R0Ready Full Access',
  },
};

function resolveTier(body = {}) {
  if (body.tier && TIER_CONFIG[body.tier]) return body.tier;
  if (body.product === 'r0ready-full') return 'full-access';
  if (body.product === 'r0ready-r01' || body.product === 'ciiready-r01') return 'r01-only';
  return 'r01-only';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required.' });
    }

    const tier = resolveTier(req.body);
    const config = TIER_CONFIG[tier];

    const paymentIntent = await stripe.paymentIntents.create({
      amount: config.amount,
      currency: 'gbp',
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        tier: tier,
        product: config.product,
      },
      description: config.stripeName,
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      tier,
      amount: config.amount,
      product: config.product,
    });
  } catch (err) {
    console.error('[create-payment-intent]', err.message);
    return res.status(500).json({ error: 'Unable to create payment. Please try again.' });
  }
};
