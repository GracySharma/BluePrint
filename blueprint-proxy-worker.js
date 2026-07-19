/**
 * Blueprint API Proxy — Cloudflare Worker
 * ----------------------------------------
 * This is the piece that makes Blueprint's AI features (copy generation,
 * the AI Assistant's Ideas/Ask/Review tools) work once you host the
 * Blueprint HTML file yourself, outside Claude.ai.
 *
 * WHY THIS EXISTS
 * Blueprint calls the Anthropic API from the browser. That call needs an
 * API key. Your API key must NEVER be embedded in the Blueprint HTML file
 * or any other client-side code — anyone who views your page's source or
 * opens their browser's network tab could copy it and run up charges on
 * your account. Instead, this tiny server sits between your visitors and
 * Anthropic: it holds your key privately (as a secret, never shipped to
 * the browser) and forwards requests on your visitors' behalf.
 *
 * WHAT IT DOES
 * - Accepts POST requests shaped exactly like Anthropic's /v1/messages API
 * - Attaches your real API key server-side
 * - Forwards the request to Anthropic and returns the response
 * - Adds CORS headers so your hosted Blueprint page can call it
 * - Nothing else. No storage, no logging beyond Cloudflare's defaults.
 *
 * DEPLOY THIS IN ABOUT 5 MINUTES (free tier, no credit card required)
 * 1. Go to https://dash.cloudflare.com/ and sign up / log in (free).
 * 2. In the sidebar, go to Workers & Pages -> Create -> Create Worker.
 * 3. Give it any name (e.g. "blueprint-proxy") and click Deploy.
 * 4. Click "Edit code", delete the placeholder code, and paste in this
 *    entire file. Click "Deploy" again.
 * 5. Go to Settings -> Variables and Secrets for this Worker, and add a
 *    secret named ANTHROPIC_API_KEY with your real Anthropic API key as
 *    the value (get one at https://console.anthropic.com/settings/keys).
 * 6. Copy the Worker's URL (shown at the top of the Worker's page, looks
 *    like https://blueprint-proxy.<your-subdomain>.workers.dev).
 * 7. Open your hosted Blueprint page, click the "⚙ API" button in the top
 *    bar, paste that URL in, and click Save. Done — the AI features now
 *    work on your self-hosted copy too.
 *
 * COST
 * Cloudflare Workers' free tier covers 100,000 requests/day, which is far
 * more than a typical Blueprint deployment needs. You only pay Anthropic
 * for the tokens your visitors' generations actually use — check current
 * pricing at https://www.anthropic.com/pricing before deploying somewhere
 * with a lot of traffic, since every visitor who generates a page or uses
 * the AI Assistant will consume your API credits.
 *
 * SECURITY NOTE
 * Because this proxy has no per-visitor rate limiting or auth by default,
 * anyone who finds your Worker URL could send it requests and spend your
 * API credits. For a personal or low-traffic site this is usually fine.
 * For anything public-facing at scale, consider adding your own request
 * cap (see the optional block below) or Cloudflare's built-in rate
 * limiting rules (Security -> WAF -> Rate limiting rules, free to set up).
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight requests.
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Only POST requests are supported.' }, 405);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse(
        { error: 'Server misconfigured: ANTHROPIC_API_KEY secret is not set on this Worker.' },
        500
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    // ---- Optional: simple per-request size guard ----
    // Uncomment to cap how large a single generation request can be, as a
    // basic safeguard against abuse (adjust the number to taste).
    // if (body.max_tokens && body.max_tokens > 8192) {
    //   return jsonResponse({ error: 'max_tokens exceeds this proxy\'s limit.' }, 400);
    // }

    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const responseBody = await anthropicResponse.text();
      return new Response(responseBody, {
        status: anthropicResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(),
        },
      });
    } catch (err) {
      return jsonResponse({ error: 'Failed to reach Anthropic API: ' + err.message }, 502);
    }
  },
};

function corsHeaders() {
  return {
    // For tighter security, replace '*' with your actual site's origin,
    // e.g. 'https://yourdomain.com', once you know where you're hosting.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
