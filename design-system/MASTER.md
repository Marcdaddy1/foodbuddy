# FoodBuddy Design System — MASTER

Source of truth for all UI. Page-specific overrides live in `design-system/pages/<route>.md` (override wins). Brand palette is fixed by the PRD — never substitute it.

## Style direction

**Organic Health-Tech**: flat-design foundation (fast, WCAG AAA-friendly, no gradients-for-decoration) with organic-biophilic warmth (rounded corners, soft natural shadows, nature greens). The app must read as *trustworthy and calm*, not gamified. Verdicts are the hero of every screen they appear on.

## Color tokens (Tailwind v4 `@theme` in `src/index.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-brand-700` | `#2D5016` | `#A5D66E` (on dark, brand text/icons lighten) | Headers, primary text accents, active tab |
| `--color-brand-400` | `#7CB342` | `#8BC34A` | Fills, progress, decorative — **never body text on white (2.4:1)** |
| `--color-accent-500` | `#FF6B35` | `#FF8A5C` | Primary CTA (scan), highlights — **large text/graphics only on white (3:1)** |
| `--color-surface` | `#FFFFFF` | `#151915` | Cards, sheets |
| `--color-surface-muted` | `#F5F5F5` | `#0D110D` | App background |
| `--color-danger-500` | `#E53E3E` | `#F87171` | Errors, Avoid verdict |
| `--color-verdict-safe` | `#2F7D32` | `#66BB6A` | Safe verdict (icon+label+bg tint) |
| `--color-verdict-caution` | `#B45309` | `#F59E0B` | Caution verdict |
| `--color-verdict-avoid` | `#C62828` | `#EF5350` | Avoid verdict |
| text primary | `#171D14` | `#ECF2E8` | 15:1+ |
| text muted | `#4A5546` | `#9DAA98` | ≥4.6:1 |

Verdict banners use a tinted background (e.g. `safe/10`), a 1px border of the verdict color, dark verdict text, **and always an icon + text label** — color is never the only signal (color-blind requirement).

## Typography

- Headings: **Inter** via `@fontsource-variable/inter` (self-hosted — the Capacitor app must not depend on a font CDN offline). Weights 600–800, tracking-tight.
- Body: system stack (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`), 16px minimum on mobile, line-height 1.5–1.6.
- Score display: Inter 700+, tabular-nums.

## Shape, depth, spacing

- Radius: cards/sheets `rounded-2xl` (16px), buttons/inputs `rounded-xl` (12px), verdict banner `rounded-2xl`, FAB circle.
- Shadows (light mode): `shadow-[0_8px_32px_rgba(23,29,20,0.08)]` for elevated cards; nothing harsher. Dark mode: rely on surface contrast, minimal shadow.
- Spacing: 4px grid; screen gutter `px-4`; section gaps `gap-4`–`gap-6`; generous whitespace over dividers.
- No emoji as icons. Icons: **lucide-react**, 24px default, `stroke-width={2}`, consistent set.

## Touch & one-handed use

- Every target ≥44×44px (`min-h-11 min-w-11`), ≥8px between adjacent targets.
- Bottom tab bar: 5 slots — Home, History, **Scan (center FAB, 64px, accent orange, raised)**, Lists, Profile. Labels always visible under icons (10–11px). Active = brand-700 + filled icon feel; inactive = muted.
- Safe areas: pad tab bar with `env(safe-area-inset-bottom)`; header with `env(safe-area-inset-top)`.
- Primary actions live in the bottom half of the screen.

## Motion

- 150–250ms, `transition-colors`/`transform`/`opacity` only. No layout-shifting hover scale.
- Respect `prefers-reduced-motion: reduce` (media query wrapper on any keyframe animation).
- Press feedback on cards/buttons: `active:scale-[0.98]` (transform, not size) + color shift.

## Component canon

- **VerdictBanner**: icon (ShieldCheck / AlertTriangle / OctagonX) + label ("Safe for you" / "Caution" / "Avoid") + triggering rule line ("Contains milk — your allergy"). Tinted bg, colored border, dark text.
- **ScoreRing**: 0–100 with grade band letter (A 80+, B 60–79, C 40–59, D 20–39, E <20), ring color = band, number + letter inside, `tabular-nums`.
- **IngredientRow**: name + risk chip (icon+label, tinted) — tappable → detail sheet.
- **Card**: surface, rounded-2xl, soft shadow, `p-4`.
- **ListItemRow**: 44px min, checkbox 24px inside 44px target, checked = muted + strikethrough.

## Anti-patterns (from ui-ux-pro-max, enforced)

- No emojis as icons; no gradient-heavy decoration; no `bg-white/10` glass in light mode; no borders below `gray-200` visibility; no text below 4.5:1; no scale-on-hover layout shift; no content hidden behind the fixed tab bar (pad `pb-[calc(96px+env(safe-area-inset-bottom))]`).

## Accessibility gates (WCAG 2.2 AA)

Focus-visible rings (`ring-2 ring-brand-700 ring-offset-2`) on all interactive elements; aria-labels on icon-only buttons; verdicts announced via text; keyboard/tab order = visual order; `prefers-reduced-motion` respected; contrast per the table above.
