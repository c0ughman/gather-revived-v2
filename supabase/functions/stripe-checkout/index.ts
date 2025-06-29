import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Gather AI',
    version: '1.0.0',
  },
});

// Helper function to create responses with CORS headers
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  // For 204 No Content, don't include Content-Type or body
  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const { price_id, success_url, cancel_url, mode } = await req.json();

    const error = validateParameters(
      { price_id, success_url, cancel_url, mode },
      {
        cancel_url: 'string',
        price_id: 'string',
        success_url: 'string',
        mode: { values: ['payment', 'subscription'] },
      },
    );

    if (error) {
      return corsResponse({ error }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header is required' }, 401);
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the token and get the user
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError) {
      console.error('Auth error:', getUserError);
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }

    if (!user) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    // Check if customer already exists
    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database', getCustomerError);
      return corsResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId;

    // Create new customer if one doesn't exist
    if (!customer || !customer.customer_id) {
      try {
        // Create customer in Stripe
        const newCustomer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });

        console.log(`Created new Stripe customer ${newCustomer.id} for user ${user.id}`);

        // Insert customer record in database
        const { error: createCustomerError } = await supabase
          .from('stripe_customers')
          .insert({
            user_id: user.id,
            customer_id: newCustomer.id,
          });

        if (createCustomerError) {
          console.error('Failed to save customer information in the database', createCustomerError);
          
          // Clean up the Stripe customer
          await stripe.customers.del(newCustomer.id);
          
          return corsResponse({ error: 'Failed to create customer mapping' }, 500);
        }

        // For subscription mode, create initial subscription record
        if (mode === 'subscription') {
          try {
            const { error: createSubscriptionError } = await supabase
              .from('stripe_subscriptions')
              .insert({
                customer_id: newCustomer.id,
                status: 'not_started',
              });

            if (createSubscriptionError) {
              console.error('Failed to save subscription in the database', createSubscriptionError);
              
              // Clean up the Stripe customer and customer record
              await stripe.customers.del(newCustomer.id);
              await supabase.from('stripe_customers').delete().eq('customer_id', newCustomer.id);
              
              return corsResponse({ error: 'Unable to save the subscription in the database' }, 500);
            }
          } catch (subError) {
            console.error('Exception creating subscription record:', subError);
            
            // Clean up the Stripe customer and customer record
            await stripe.customers.del(newCustomer.id);
            await supabase.from('stripe_customers').delete().eq('customer_id', newCustomer.id);
            
            return corsResponse({ error: 'Exception creating subscription record' }, 500);
          }
        }

        customerId = newCustomer.id;
      } catch (error) {
        console.error('Error creating customer:', error);
        return corsResponse({ error: 'Failed to create customer' }, 500);
      }
    } else {
      customerId = customer.customer_id;

      // For existing customers with subscription mode, ensure subscription record exists
      if (mode === 'subscription') {
        // Check if subscription record exists
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .select('id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information', getSubscriptionError);
          return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
        }

        // Create subscription record if it doesn't exist
        if (!subscription) {
          try {
            // Insert without ON CONFLICT clause
            const { error: createSubscriptionError } = await supabase
              .from('stripe_subscriptions')
              .insert({
                customer_id: customerId,
                status: 'not_started',
              });

            if (createSubscriptionError) {
              // If it's a duplicate key error, we can ignore it as the record already exists
              if (createSubscriptionError.message.includes('duplicate key')) {
                console.log('Subscription record already exists, continuing...');
              } else {
                console.error('Failed to create subscription record', createSubscriptionError);
                return corsResponse({ error: 'Failed to create subscription record' }, 500);
              }
            }
          } catch (subError) {
            console.error('Exception creating subscription record for existing customer:', subError);
            return corsResponse({ error: 'Exception creating subscription record for existing customer' }, 500);
          }
        }
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      // Add payment_behavior to ensure immediate charging
      payment_behavior: 'default_incomplete',
      // Set subscription_data to ensure immediate invoicing
      ...(mode === 'subscription' ? {
        subscription_data: {
          trial_period_days: 0,
          billing_cycle_anchor: 'now',
        }
      } : {})
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };

function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  for (const parameter in expected) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) {
        return `Missing required parameter ${parameter}`;
      }
      if (typeof value !== 'string') {
        return `Expected parameter ${parameter} to be a string got ${JSON.stringify(value)}`;
      }
    } else {
      if (!expectation.values.includes(value)) {
        return `Expected parameter ${parameter} to be one of ${expectation.values.join(', ')}`;
      }
    }
  }

  return undefined;
}