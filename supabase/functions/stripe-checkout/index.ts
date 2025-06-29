import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.18.0";

// Initialize Stripe
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is required");
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

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { price_id, success_url, cancel_url, mode = "subscription" } = await req.json();

    // Validate required parameters
    if (!price_id || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: price_id, success_url, cancel_url" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate mode
    if (mode !== "subscription" && mode !== "payment") {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Must be 'subscription' or 'payment'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user from auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Creating checkout session for user: ${user.id}`);

    // Check if user already has a Stripe customer
    const { data: existingCustomer, error: customerError } = await supabase
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError) {
      console.error("Error fetching customer:", customerError);
      return new Response(JSON.stringify({ error: "Error fetching customer data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerId;

    if (existingCustomer?.customer_id) {
      // Use existing customer
      customerId = existingCustomer.customer_id;
      console.log(`Using existing Stripe customer: ${customerId}`);
    } else {
      // Create new Stripe customer
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            user_id: user.id,
          },
        });
        customerId = customer.id;
        console.log(`Created new Stripe customer: ${customerId}`);

        // Store customer in database
        const { error: insertError } = await supabase.from("stripe_customers").insert({
          user_id: user.id,
          customer_id: customerId,
        });

        if (insertError) {
          console.error("Error storing customer:", insertError);
          return new Response(JSON.stringify({ error: "Error storing customer data" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // For subscriptions, create a subscription record
        if (mode === "subscription") {
          const { error: subError } = await supabase.from("stripe_subscriptions").insert({
            customer_id: customerId,
            status: "not_started",
          });

          if (subError) {
            console.error("Error creating subscription record:", subError);
            // Continue anyway - this is not critical
          }
        }
      } catch (stripeError) {
        console.error("Stripe error:", stripeError);
        return new Response(JSON.stringify({ error: "Error creating Stripe customer" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create Stripe checkout session
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
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
        payment_behavior: "default_incomplete",
        // Set subscription_data to ensure immediate invoicing
        ...(mode === "subscription"
          ? {
              subscription_data: {
                trial_period_days: 0,
                billing_cycle_anchor: "now",
              },
            }
          : {}),
      });

      console.log(`Created checkout session: ${session.id}`);

      return new Response(
        JSON.stringify({
          sessionId: session.id,
          url: session.url,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (stripeError) {
      console.error("Stripe checkout error:", stripeError);
      return new Response(
        JSON.stringify({
          error: stripeError.message || "Error creating checkout session",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});