# CiteScan

**Snap a photo of your essay. See which sentences need a source, and get real, verified papers, reports and articles to cite.**

CiteScan is a mobile app (iOS and Android) for students. Point your camera at a printed or handwritten essay, or upload a PDF or Word file, and CiteScan:

1. **Finds the sentences that need a citation**: statistics, specific facts, quotations, research findings, and other people's ideas. It skips opinions and common knowledge, and explains *why* each flagged sentence needs a source.
2. **Finds real sources for each one**: academic papers from OpenAlex and Crossref (250M+ works), plus news, official statistics and reports via web search for Pro users.
3. **Gives ready-to-paste APA 7 and MLA 9 citations**, built only from real metadata, with a link to open every source.

Existing citation tools expect your essay to be typed on a computer already. CiteScan starts from paper: handwritten drafts, printed essays with teacher feedback, practice answers.

## Features

| | Free | CiteScan Pro |
|---|---|---|
| Scan printed/handwritten pages, or upload PDF / Word / text | ✅ | ✅ |
| Flag sentences that need citing, with reasons | ✅ | ✅ |
| Academic paper suggestions with APA & MLA citations | ✅ | ✅ |
| Essay checks | 3 free, plus Essay Packs | Unlimited |
| **Advanced search**: news, reports and official statistics | | ✅ (30 essays/month) |
| **Full history**: open and search essays older than 7 days | | ✅ |
| **Waiting game** instead of the ad space while sources load | | ✅ |
| **Custom themes**: 9 accent colours × 6 backgrounds, light and dark | | ✅ |
| **Custom app icon**: 8 icons, each with light and dark versions | | ✅ |

Plus: light/dark/system appearance, searchable and renamable history, and expandable result cards showing every source.

## Monetisation (RevenueCat)

Everything purchase-related runs through the **RevenueCat SDK** (`react-native-purchases`):

- **Entitlement:** `CiteScan Pro`, unlocked by two subscriptions in one offering: **Pro monthly ($3.99)** and **Pro yearly ($24.99, 48% cheaper)**.
- **Consumable:** **Essay Pack ($1.99, 3 more checks)** for students who only need one essay done before a deadline. It isn't attached to the entitlement, and credits are counted from `nonSubscriptionTransactions`.
- **Custom paywall** (`mobile/src/app/paywall.tsx`) built from the current offering, so prices and plans can change from the RevenueCat dashboard without an app update. The "Save 48%" badge is calculated from real prices, and prices show in the user's local currency via the stores.
- **Contextual upgrade prompts** rather than nagging: when free checks run out, on a result where Advanced search could find a stronger source, on a locked older essay, and on Pro-only settings.
- **Restore purchases**, a **Manage subscription** link, and an account screen with plan and renewal date.
- **Why subscriptions and not a lifetime purchase:** every essay check has a real per-use AI cost, so recurring revenue matches recurring cost. The consumable covers occasional users without undercutting Pro.

Development uses RevenueCat's **Test Store**, which simulates purchases in Expo Go without App Store or Google Play accounts.

## How it works

```
 Phone (Expo / React Native)                   Server (Node + Express)
 ───────────────────────────                   ───────────────────────
 camera / photos / PDF / Word ─ POST /claims ─▶ Stage 1 (~10 s, cheap): Claude reads the essay
                                                 (vision for photos and handwriting) and returns the
                                                 claims needing citation, using structured output
 review screen: user unticks  ◀──────────────
 sentences they don't need
 chosen sentences ──────────── POST /sources ─▶ Stage 2 (costly, only for chosen sentences):
                                                 1. search OpenAlex + Crossref (batched, retried)
                                                 2. Claude picks candidates that genuinely support
                                                    each claim, formats APA/MLA from real metadata
                                                 3. Pro only: claims without a strong match get a
                                                    Claude web search; a source is only accepted if
                                                    its URL appeared in the actual search results
 results, history, themes     ◀── JSON ──────
```

**Design decisions:**

- **No invented citations.** Large language models are known to make up references. CiteScan only suggests sources that came back from a real database or search result, and citations are formatted from that metadata. The model is told to return nothing rather than something misleading.
- **The API key lives on the server.** Anything shipped inside an app binary can be extracted, so the phone never holds the Anthropic key.
- **Resilient search.** The free scholarly indexes often rate-limit, so searches are batched and retried with backoff. In testing this took an essay from 2/4 to 4/4 sentences with sources, and web search covers statistics that academic databases don't index.
- **Two stages so the user stays in control and costs stay down.** Finding sentences is quick and cheap; searching and matching sources is where most of the cost is. Users untick sentences they've already cited before stage 2, and an essay check is only used when they confirm.
- **The right model for each job, measured.** Reading the essay (including handwriting) uses Claude Opus 5.5. Judging candidate sources and web searching use Claude Haiku 4.5, and APA/MLA citations are built in code rather than written by the model. Every request logs its cost per stage (`server/src/cost.ts`). Together these cut a Pro check with web search from **$0.46 to about $0.10**, and a free check to **about $0.02**, with every test sentence still getting a strong source.
- **Pricing that covers costs.** Pro is $3.99/month, and Advanced (web) search has a fair-use limit of 30 essays a month; after that, checks carry on with academic papers only. So even heavy users stay profitable.

## Tech stack

- **App:** Expo SDK 57, React Native, Expo Router, TypeScript, `react-native-purchases`, `expo-image-picker`, `expo-document-picker`, `expo-image-manipulator`, `react-native-svg`, `expo-alternate-app-icons`
- **Server:** Node.js, Express, TypeScript, Anthropic SDK (`@anthropic-ai/sdk`: Claude Opus 5.5 + Claude Haiku 4.5), Zod, Mammoth (Word files)
- **Data:** OpenAlex, Crossref, Claude web search
- **Payments:** RevenueCat (entitlements, offerings, consumables, Test Store)

## Project structure

```
mobile/                 the app
  src/app/              screens (Expo Router): home, results, history, paywall, settings, pro
  src/components/       ClaimCard, ResultView, LogoMark, Confetti
  src/lib/              purchases (RevenueCat), themes, storage, API client
  scripts/make-icons.mjs  generates every app icon variant from the logo geometry
server/
  src/analyze.ts        claim extraction and source matching
  src/sources.ts        OpenAlex + Crossref search
  src/websearch.ts      Pro web-search fallback with URL verification
test-essays/            sample essays for testing (text, Word, PDF)
```

## Running it locally

Requires Node.js 20+.

```sh
# Server
cd server
cp .env.example .env          # add your ANTHROPIC_API_KEY
npm install
npm run dev                   # http://localhost:3000

# App (in a second terminal)
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL to http://<your computer's LAN IP>:3000
                              # and EXPO_PUBLIC_REVENUECAT_API_KEY to a RevenueCat Test Store key
npm install --legacy-peer-deps
npx expo start
```

Scan the QR code with **Expo Go** on a phone on the same network.

## Roadmap

- Verify Pro status on the server (RevenueCat REST API) before running Advanced search, and move the free-check counter server-side
- Automatic page edge detection and cropping when scanning
- Chicago and Harvard citation styles, and export of a full bibliography
- App Store and Google Play release

## Licence

[MIT](LICENSE)
