import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.18.0";

// Initialize Stripe
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is required");
}
if (!stripeWebhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will be skipped.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the signature from the header
    const signature = req.headers.get("stripe-signature");
    
    // Get the raw body
    const body = await req.text();
    
    let event;
    
    // Verify webhook signature if secret is available
    if (stripeWebhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
      } catch (err) {
        console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      // If no webhook secret, parse the event without verification
      try {
        event = JSON.parse(body);
      } catch (err) {
        console.error(`⚠️ Invalid webhook payload: ${err.message}`);
        return new Response(JSON.stringify({ error: "Invalid payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Received event: ${event.type}`);

    // Process the event asynchronously
    const eventPromise = handleStripeEvent(event);
    
    // Use waitUntil to allow the function to return while processing continues
    if (typeof Deno !== "undefined" && "env" in Deno) {
      // @ts-ignore: Deno-specific API
      Deno.env.get("DENO_DEPLOYMENT_ID") && eventPromise.catch(console.error);
    }

    // Return a 200 response immediately
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`❌ Webhook error: ${error.message}`);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function handleStripeEvent(event) {
  try {
    const eventObject = event.data.object;
    
    // Skip events without customer ID
    if (!eventObject.customer) {
      console.log("Event has no customer ID, skipping");
      return;
    }
    
    const customerId = eventObject.customer;
    
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(eventObject);
        break;
        
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(customerId);
        break;
        
      case "invoice.payment_succeeded":
        if (eventObject.subscription) {
          await syncSubscription(customerId);
        }
        break;
        
      case "payment_intent.succeeded":
        // Handle one-time payments
        if (!eventObject.invoice) {
          await handlePaymentIntentSucceeded(eventObject);
        }
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling event: ${error.message}`);
    throw error;
  }
}

async function handleCheckoutSessionCompleted(session) {
  try {
    const customerId = session.customer;
    const mode = session.mode;
    
    console.log(`Checkout session completed: ${session.id}, mode: ${mode}`);
    
    if (mode === "subscription") {
      // Sync subscription data
      await syncSubscription(customerId);
    } else if (mode === "payment" && session.payment_status === "paid") {
      // Handle one-time payment
      await handleOneTimePayment(session);
    }
  } catch (error) {
    console.error(`Error handling checkout session: ${error.message}`);
    throw error;
  }
}

async function syncSubscription(customerId) {
  try {
    console.log(`Syncing subscription for customer: ${customerId}`);
    
    // Get latest subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: "all",
      expand: ["data.default_payment_method"],
    });
    
    if (subscriptions.data.length === 0) {
      console.log(`No subscriptions found for customer: ${customerId}`);
      
      // Update database to show no active subscription
      const { error } = await supabase
        .from("stripe_subscriptions")
        .upsert(
          {
            customer_id: customerId,
            subscription_id: null,
            status: "not_started",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_id" }
        );
        
      if (error) {
        console.error(`Error updating subscription status: ${error.message}`);
        throw error;
      }
      
      return;
    }
    
    const subscription = subscriptions.data[0];
    
    // Get payment method details if available
    let paymentMethodBrand = null;
    let paymentMethodLast4 = null;
    
    if (subscription.default_payment_method && typeof subscription.default_payment_method !== "string") {
      const paymentMethod = subscription.default_payment_method;
      if (paymentMethod.card) {
        paymentMethodBrand = paymentMethod.card.brand;
        paymentMethodLast4 = paymentMethod.card.last4;
      }
    }
    
    // Update subscription in database
    const { error } = await supabase
      .from("stripe_subscriptions")
      .upsert(
        {
          customer_id: customerId,
          subscription_id: subscription.id,
          price_id: subscription.items.data[0].price.id,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          payment_method_brand: paymentMethodBrand,
          payment_method_last4: paymentMethodLast4,
          status: subscription.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" }
      );
      
    if (error) {
      console.error(`Error updating subscription: ${error.message}`);
      throw error;
    }
    
    console.log(`Subscription synced successfully: ${subscription.id}`);
  } catch (error) {
    console.error(`Error syncing subscription: ${error.message}`);
    throw error;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log(`Payment intent succeeded: ${paymentIntent.id}`);
    
    // Find the checkout session that created this payment
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1,
    });
    
    if (sessions.data.length === 0) {
      console.log(`No checkout session found for payment intent: ${paymentIntent.id}`);
      return;
    }
    
    const session = sessions.data[0];
    
    // Store order in database
    const { error } = await supabase.from("stripe_orders").insert({
      customer_id: paymentIntent.customer,
      checkout_session_id: session.id,
      payment_intent_id: paymentIntent.id,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      status: "completed",
    });
    
    if (error) {
      console.error(`Error storing order: ${error.message}`);
      throw error;
    }
    
    console.log(`Order stored successfully for payment intent: ${paymentIntent.id}`);
  } catch (error) {
    console.error(`Error handling payment intent: ${error.message}`);
    throw error;
  }
}

async function handleOneTimePayment(session) {
  try {
    console.log(`Processing one-time payment for session: ${session.id}`);
    
    // Store order in database
    const { error } = await supabase.from("stripe_orders").insert({
      customer_id: session.customer,
      checkout_session_id: session.id,
      payment_intent_id: session.payment_intent,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      status: "completed",
    });
    
    if (error) {
      console.error(`Error storing order: ${error.message}`);
      throw error;
    }
    
    console.log(`Order stored successfully for session: ${session.id}`);
  } catch (error) {
    console.error(`Error handling one-time payment: ${error.message}`);
    throw error;
  }
}