// api/create-payment-intent.js
// Vercel Serverless Function — POST /api/create-payment-intent
// Creates a Stripe PaymentIntent for £19 (1900p) and returns the clientSecret.
//
// Required env vars:
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, product, amount } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount || 1900, // £19 in pence
      currency: 'gbp',
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        product: product || 'ciiready-r01',
      },
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[create-payment-intent]', err.message);
    return res.status(500).json({ error: 'Unable to create payment. Please try again.' });
  }
};
