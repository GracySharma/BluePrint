# Running Blueprint outside Claude.ai

Blueprint (`blueprint-landing-page-studio.html`) works standalone — you can open
it directly in a browser or host it on any static site host (GitHub Pages,
Netlify, Vercel, S3, your own server, anywhere). Most of it needs nothing else.

**Works immediately, no setup:** the step-by-step wizard, design styles,
fonts, image uploads (logo/hero/gallery), all the toggleable page sections,
the live preview, view-code, and download.

**Needs one extra step:** anything that calls Claude —
- Generating the actual page copy (headlines, features, testimonials, etc.)
- The AI Assistant panel (Ideas / Ask / Review tabs)

These call the Anthropic API directly from the browser. That call needs an
API key, and your key must never be embedded in the HTML file itself —
anyone who views your page's source, or opens their browser's network tab,
could copy it out and spend your API credits. So instead, you run a tiny
proxy server that holds your key privately and Blueprint talks to that.

## Setup (about 5 minutes)

1. Deploy `blueprint-proxy-worker.js` as a Cloudflare Worker. Full
   step-by-step instructions are in the comment at the top of that file —
   short version: create a free Cloudflare account, create a Worker, paste
   in the code, add your Anthropic API key as a secret named
   `ANTHROPIC_API_KEY`.
2. Cloudflare gives you a URL like
   `https://blueprint-proxy.yoursubdomain.workers.dev`.
3. Open your hosted copy of `blueprint-landing-page-studio.html`, click the
   **⚙ API** button in the top bar, paste that URL in, and click Save.

That's it — the AI features now work on your self-hosted copy too. The
setting is saved in each visitor's browser (`localStorage`), so you'd
either tell people to do this once, or bake the URL into the file yourself
before you publish it (see "Baking in the URL" below) so visitors don't
have to configure anything.

## Why a Cloudflare Worker specifically?

It's free for the traffic levels a tool like this typically sees (100,000
requests/day on the free tier), requires no server to maintain, and takes
a few minutes to set up. You can use any other backend you prefer instead
(a Node/Express server, an AWS Lambda, a Vercel/Netlify function, etc.) —
the only requirement is that it accepts a POST request shaped like
Anthropic's `/v1/messages` API, attaches your key server-side, and forwards
it to `https://api.anthropic.com/v1/messages`. The Worker file is a
reference implementation of exactly that.

## Baking in the URL (skip the settings step for visitors)

If you don't want visitors to ever see or need the ⚙ API settings panel,
open `blueprint-landing-page-studio.html`, find this line near the top of
the `<script>` block:

```js
function getApiEndpoint(){
  try{ return localStorage.getItem('blueprint_api_endpoint') || 'https://api.anthropic.com/v1/messages'; }
  catch(e){ return 'https://api.anthropic.com/v1/messages'; }
}
```

and replace both occurrences of `'https://api.anthropic.com/v1/messages'`
with your own proxy URL. Save the file and re-host it — it'll use your
proxy by default with no configuration needed from visitors.

## Cost

Cloudflare Workers' free tier is generous, but Anthropic itself bills per
token. Every page generation and every AI Assistant interaction consumes
API credits on your account. Check current pricing at
https://www.anthropic.com/pricing before putting this somewhere with
meaningful traffic, and consider adding rate limiting (Cloudflare's
dashboard has a free, no-code option under Security → WAF → Rate limiting
rules) so a single visitor — or a bot — can't run up an unexpectedly large
bill.
