# Google Play — Store Listing Copy

Paste-ready. Character limits are Play's hard caps; counts below are current.

Compliance constraints baked into this copy (do not "improve" them away):

- **No medical claims.** FoodBuddy is a general-wellness informational tool. No
  diagnosing, treating, preventing, or curing. Keeps it outside FDA/MHRA medical
  device scope and out of Play's health-claims rejection bucket.
- **Never "healthy".** "Healthy" is an FDA-regulated nutrient-content claim
  (final rule effective Feb 2025). Use "higher-scoring", "better-rated".
- **No allergen guarantees.** Never "allergen-free", "safe to eat", "guaranteed".
  Allergen data comes from manufacturer submissions and can be wrong or stale.
- **Open Food Facts attribution** is an ODbL licence obligation, not a courtesy.

---

## App name (30 char max)

```
FoodBuddy: Food Scanner
```

23 characters.

> **Name risk — decide before launch.** A takeaway-ordering app called "Food
> Buddy" already exists on Play (`com.epostechnologies.foodbuddy`), and a food
> scanner ships under the package `com.bytes_and_pixels.food_buddy` while
> branded "Labeless". Play permits duplicate display names, but a trademark
> holder can force removal at any time. Run a UK IPO + EUIPO search before
> investing in the brand. Your **applicationId `com.aegeanpulse.foodbuddy` is
> permanent from the first upload** — the display name can change later, the
> package ID never can.

## Short description (80 char max)

```
Scan any food barcode for a clear score and a verdict that fits your diet.
```

73 characters.

## Full description (4000 char max)

```
Scan it. Understand it. Buy better.

Food labels are written for regulators, not shoppers. FoodBuddy turns any
barcode into a straight answer in the time it takes to pick the product up.

WHAT YOU GET IN ONE SCAN

• A personal verdict — Safe, Caution, or Avoid, judged against YOUR profile,
  with the exact rule that triggered it ("Contains milk — your allergy").
• A 0-100 score with an A-E grade, broken down into nutrition, additives, and
  processing level so you can see what drove it.
• Every ingredient, colour-coded by risk class, tappable for plain-English
  detail on what it is and why it is in there.
• A full nutrition panel with per-nutrient traffic lights.

SCORES YOU CAN ACTUALLY CHECK

Most scanner apps hand you a number and ask you to trust it. FoodBuddy's score
is computed on your device from published, versioned rules — nutrient
thresholds, a cited additive risk table, and NOVA processing level. The same
product always scores the same. AI is used to explain ingredients in plain
English; it never decides your score or your verdict.

BUILT AROUND YOUR RESTRICTIONS

Set your allergies with severity, intolerances, diet patterns, and your own
custom avoid-list. FoodBuddy understands derivative ingredients — whey and
casein flag your milk allergy, semolina flags gluten. When the data is
incomplete or an ingredient cannot be identified, it downgrades to Caution
rather than guessing in your favour. It errs toward telling you to look twice.

KEEP WHAT WORKS

Scan history with your verdicts, favourites, personal notes, and shopping
lists you can build straight from a scan.

WORKS IN THE AISLE

Thumb-reachable scan button, results readable at arm's length, on-device
scanning that keeps working when the supermarket wifi does not. Full dark
mode. Screen-reader labelled throughout, with manual barcode entry whenever
the camera is not an option.

YOUR DIETARY DATA STAYS YOURS

Your allergies and dietary restrictions are health-related personal data and
we treat them that way: never sold, never shared with advertisers, never
included in analytics. Analytics only run if you opt in. You can export
everything or delete your account and all its data from inside the app.

IMPORTANT

FoodBuddy provides general information about packaged food products. It is not
a medical device and does not provide medical advice. Product data comes from
the Open Food Facts community database and may be incomplete or out of date.
If you have a food allergy, always read the physical label on the product
before eating it — no app can replace that check.

Product data from Open Food Facts, used under the Open Database Licence
(ODbL).
```

~2,270 characters.

## Category & tags

- **Category:** Health & Fitness
- **Tags:** Nutrition, Food, Barcode Scanner, Allergies, Shopping
- **Contains ads:** No
- **In-app purchases:** No (v1.0 — changing this later requires a listing update)

## Contact details (required)

| Field | Value |
|---|---|
| Support email | `{{support_email}}` — a monitored address; Play publishes it |
| Website | `{{marketing_url}}` |
| Privacy policy URL | `{{privacy_policy_url}}` — must be live before submitting |

> Play displays the support email publicly. Use a role address
> (e.g. support@aegeanpulse.com), not a personal inbox.

## Graphics checklist

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG | ✅ `store/play/play-store-icon-512.png` |
| Feature graphic | 1024×500 PNG | ✅ `store/play/feature-graphic-1024x500.png` |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | ⛔ Capture on device — see RELEASE.md |
| Tablet screenshots | Optional | Not planned for v1.0 |

Play policy forbids store badges, "Download now" CTAs, and misleading device
frames in the feature graphic — the supplied file is compliant.
