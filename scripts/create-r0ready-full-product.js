const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }

  const product = await stripe.products.create({
    name: 'R0Ready Full Access',
    description: 'Full access to all R0Ready modules (R01-R05) including all future updates',
    metadata: {
      lookup_key: 'r0ready-full',
    },
  });

  const price = await stripe.prices.create({
    unit_amount: 2900,
    currency: 'gbp',
    product: product.id,
    lookup_key: 'r0ready-full',
    nickname: 'R0Ready Full Access',
  });

  console.log(JSON.stringify({
    approach: 'programmatic setup script',
    productId: product.id,
    priceId: price.id,
    lookupKey: 'r0ready-full',
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
