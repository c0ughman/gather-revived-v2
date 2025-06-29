export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'payment' | 'subscription';
  features?: string[];
  popular?: boolean;
}

export const PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_SaWFAs1WpWiMrM',
    priceId: 'price_1RfLCZCHpOkAgMGGUtW046jz',
    name: 'Standard',
    description: 'Dipping your toes in the water of seamless AI interaction.',
    price: 20,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Call time: 20min / day',
      'Agents: 7',
      'All Integrations',
      'Storage: 5GB',
      'Chat Tokens: 4M'
    ]
  },
  {
    id: 'prod_SaWGBcl0IQpjeY',
    priceId: 'price_1RfLEACHpOkAgMGGl3yIkLiX',
    name: 'Premium',
    description: 'For the real Gather experience, providing very powerful functionality.',
    price: 80,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Call time: 100min / day',
      'Agents: up to 50',
      'All Integrations',
      'Storage: 50GB',
      'Chat Tokens: 15M',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'prod_SaWH26nuYdsChT',
    priceId: 'price_1RfLFJCHpOkAgMGGtGJlOf2I',
    name: 'Pro',
    description: 'For practitioners and professionals looking to maximize their AI use. Including custom integrations and much more.',
    price: 250,
    currency: 'USD',
    mode: 'subscription',
    features: [
      'Call time: Unlimited*',
      'Agents: Unlimited*',
      'Custom Integrations',
      'Storage: Unlimited*',
      'Chat Tokens: Unlimited*',
      'Dedicated account manager'
    ]
  }
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return PRODUCTS.find(product => product.priceId === priceId);
}

export function getProductById(productId: string): StripeProduct | undefined {
  return PRODUCTS.find(product => product.id === productId);
}