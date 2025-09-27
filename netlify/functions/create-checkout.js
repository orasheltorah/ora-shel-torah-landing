// netlify/functions/create-checkout.js
// Node CommonJS
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// UE set (for shipping presets)
const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);

// Compute flat shipping by country + item mix (JDC vs DECK)
function computeShipping(country, items) {
  let qtyJDC = 0, qtyDECK = 0;
  for (const it of (items || [])) {
    if (it.type === 'JDC') qtyJDC += it.qty;
    else qtyDECK += it.qty;
  }
  const hasMix = qtyJDC>0 && qtyDECK>0;
  const isFR = country === 'FR';
  const isEU = EU.has(country);

  if (isFR)  return hasMix?8.90 : qtyJDC?7.90 : qtyDECK?4.90 : 0;
  if (isEU)  return hasMix?13.90: qtyJDC?12.90: qtyDECK?8.90 : 0;
  return hasMix?13.90: qtyJDC?12.90: qtyDECK?8.90: 0; // non-EU defaults
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { line_items, shipping_country, items_types } = JSON.parse(event.body || '{}');
    if (!Array.isArray(line_items) || line_items.length === 0) {
      return { statusCode: 400, body: 'Missing line_items' };
    }

    // items_types optional: [{type:'JDC'|'DECK', qty: number}, ...]
    const shippingAmount = computeShipping(shipping_country || 'FR', items_types || []);
    const shippingItem = shippingAmount > 0 ? [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'Frais d’expédition' },
        unit_amount: Math.round(shippingAmount * 100),
      },
      quantity: 1
    }] : [];

    const successUrl = process.env.SUCCESS_URL || 'https://orasheltorah.com/#commande-ok';
    const cancelUrl  = process.env.CANCEL_URL  || 'https://orasheltorah.com/#commande-annulee';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card','link'],
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['FR','BE','CH','CA','IL','US','AT','BG','HR','CY','CZ','DK','EE','FI','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']
      },
      line_items: [
        ...line_items,  // [{ price:'price_xxx', quantity:n }, ...]
        ...shippingItem
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { shipping_country: shipping_country || 'FR' }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Server error' };
  }
};
