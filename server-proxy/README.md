# Cradle brand-food lookup proxy

The Cradle PWA can talk to an optional **server proxy** that fetches
nutrition data from Woolworths and manufacturer websites and (optionally)
runs OCR on photographed cookbook pages. When deployed and configured in
Settings → Brand-food lookup, it slots in as the second tier of the
lookup chain:

```
1. Curated brand DB  (in /src/data/brandFoods.au.js, instant, offline)
2. Server proxy      (this directory — Woolworths / manufacturer)
3. Open Food Facts   (community fallback — only if 1 and 2 miss)
```

## Endpoints the app calls

| Method | Path                  | Used for |
| ------ | --------------------- | -------- |
| GET    | `/lookup?barcode=...` | Barcode scan from BrandFoodSearch |
| GET    | `/search?q=...`       | Text search top-up when curated returns < 3 hits |
| POST   | `/ocr` (multipart `image`) | Cookbook photo OCR (Recipes tab) — optional |

All responses must be JSON. CORS must allow the origin where Cradle is
hosted (`Access-Control-Allow-Origin: https://your.app` or `*` for dev).

### Response shapes

`/lookup`:

```json
{
  "found": true,
  "source": "woolworths",
  "food": {
    "id": "wool_3094501",
    "barcode": "9300675060523",
    "brand": "Chobani",
    "name": "Greek Yogurt",
    "variant": "Vanilla",
    "serving": { "size": 170, "unit": "g", "label": "1 tub (170 g)" },
    "package": { "size": 170, "unit": "g" },
    "per100":  {
      "kcal": 73, "protein": 9.7, "carbs": 4.4, "sugars": 4.4,
      "fat": 2.0, "satFat": 1.3, "fiber": 0, "sodium": 50
    },
    "group": "dairy",
    "aliases": [],
    "source": { "primary": "woolworths", "url": "https://www.woolworths.com.au/shop/productdetails/12345" },
    "qa": { "verifiedAt": "2026-04-30", "confidence": "medium", "cross": ["woolworths"] }
  }
}
```

`/search`: `{ "source": "woolworths", "results": [<food>, <food>, ...] }`

`/ocr`: `{ "text": "200 g plain flour\n2 tbsp olive oil\n..." }`

When you have no result, return `{ "found": false }` (status 200) so the
client falls through cleanly to Open Food Facts.

## Cloudflare Worker reference

`worker.js` in this directory is a starting point. Deploy with
[Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npm install -g wrangler
wrangler deploy
```

It demonstrates:
- Barcode → Woolworths product API call (graceful 404 handling)
- Text search → Woolworths search API
- OCR → forward to Google Cloud Vision (you provide the API key as a
  Wrangler secret)

⚠️ **Compliance** — Woolworths' production API is subject to their terms
of use. Respect rate limits, identify your bot in `User-Agent`, cache
aggressively (24 h), and consider applying for a developer agreement for
production use. The reference Worker is a *starting point*, not a
ready-to-deploy commercial scraper. For high volume, consider a
licensed data provider (e.g. Open Grocery, FoodSwitch).

## Local development

```bash
cd server-proxy
npm install
node dev-server.js     # serves on http://localhost:8787
```

Then in the Cradle app, open Settings → Brand-food lookup and set:

```
Server proxy URL: http://localhost:8787
```
