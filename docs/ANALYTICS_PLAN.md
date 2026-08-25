# Plan — Order Tracking & Analytics

> Written against the codebase as it stands. Every "today" below was verified,
> not assumed. Implementation happens in the next run.

---

## 0. What exists today

| Capability | State |
|---|---|
| `orders.tracking_number` | Exists. Generated once, on the first transition into a shipped state. |
| `shipping_methods.tracking_url_template` | Exists, populated for UPS: `https://www.ups.com/track?tracknum={tracking}` |
| Order status lifecycle | 9-value enum; 6 in use (`processing → packed → shipped → out_for_delivery → delivered`, plus `cancelled`) |
| **Package journey** | **None.** The order row holds one current status — no checkpoints, no locations, no timestamps, nothing a progress bar could render. |
| **Public tracking page** | **None.** Tracking is visible only at `/account/orders/[id]`, which requires a login. |
| Status-change email | Sends the tracking *number* as plain text. No link, no timeline. |
| `/admin/analytics` | Loads **every order and every order_item into Node** and aggregates in JavaScript. |
| Dashboard | Four static counts: products, published, categories, orders. |
| **Page/visitor analytics** | **None whatsoever.** No pageview table, no beacon, no third-party tag. |

Two of these are the real problems: **there is no journey history to render**,
and **analytics aggregates in memory**. Everything else builds on fixing those.

---

## Part 1 — Package journey tracking

The AliExpress/Jumia experience: a progress bar the customer can watch, with
dated checkpoints underneath — *"Arrived at Lagos sorting centre · 14 Aug,
09:32"* — and an estimated delivery date.

That is **not** the same as an order-status audit trail, and the difference
drives the whole design. A status trail records *what the shop did*
(`packed`, `shipped`). A journey records *where the package is*, which is a
stream of dated, located events arriving from outside the shop.

### 1.1 Two channels, two sources of truth

This is the constraint everything else follows from. The store ships two ways:

| Channel | Coverage | Where checkpoints come from |
|---|---|---|
| **UPS Express** | International, `carrier_code = 'ups'`, tracking URL already configured | **UPS Track API** — UPS owns the movement data; we poll and mirror it |
| **Nigeria local** | 53 destinations across 37 states | **Nobody.** This is own-dispatch. If a human does not enter a checkpoint, one does not exist |

Designing for one and retrofitting the other is how this goes wrong. The event
table must accept both from day one — an automated feed and a human tap — and
the customer-facing timeline must not care which it is looking at.

### 1.2 Data model

**`order_tracking_events`** — the journey itself:

| Column | Type | Why |
|---|---|---|
| `id` | uuid pk | |
| `order_id` | uuid → orders, cascade | |
| `stage` | enum | The progress-bar step: `confirmed · packed · dispatched · in_transit · out_for_delivery · delivered · exception` |
| `description` | text | The human line: *"Departed Lagos sorting centre"* |
| `location` | text null | *"Lagos, NG"*. Null for stages that have no place (`confirmed`) |
| **`occurred_at`** | timestamptz | **When it actually happened** |
| `created_at` | timestamptz | When we learned about it |
| `source` | enum | `manual` · `ups` · `system` |
| `external_id` | text null | Carrier's event id — the dedupe key when polling |
| `created_by` | uuid → auth_user, null | Who entered it; null for automated |

**`occurred_at` separate from `created_at` is the single most important column
here.** A carrier poll at 14:00 returns events that happened at 09:32 and 11:15.
Sorting or displaying by `created_at` would show the customer a journey in the
order *we found out*, not the order things happened — and would make every
delivery-time metric wrong. The timeline sorts by `occurred_at`; `created_at`
exists only to debug a lagging feed.

Unique on `(order_id, source, external_id)` where `external_id` is not null —
polling UPS every 30 minutes must not create a duplicate checkpoint each time.

**`orders`** gains:
- `estimated_delivery_at` — the date shown to the customer. Seeded from the
  courier's `min_days`/`max_days` (already in `shipping_methods`) at dispatch,
  and overwritten by the carrier's own estimate when UPS provides one.
- `delivered_at` — denormalised from the final event, because "how long do
  deliveries take" should not scan the events table.

**`stage` is deliberately separate from `orders.status`.** Status is the shop's
workflow and drives admin filters; stage is the customer's progress bar. They
mostly move together, but not always — a package can sit `in_transit` for five
days across three checkpoints without the order status changing at all. Conflating
them is why the current single-status column cannot express a journey.

### 1.3 UPS integration

`shipping_methods.carrier_code = 'ups'` already exists and is unused. The
integration is a poller, not a webhook: UPS does offer push, but it requires a
publicly reachable endpoint per account and is more setup than a shop this size
needs.

- A cron entry alongside the existing two in `ofelia`, every 30 minutes.
- Polls only orders that are **dispatched and not yet delivered** — never the
  whole table. That set is small by definition.
- Maps UPS activity codes onto our `stage` enum, keeps the carrier's own
  description and location text verbatim (customers recognise carrier wording),
  and dedupes on `external_id`.
- **Fails soft**: UPS being down must leave the existing timeline intact and
  visible, never blank it or error the page.
- Stops polling an order once `delivered`, or after 60 days — otherwise the
  poll set grows forever.

Needs a UPS developer account and `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` (OAuth).
**Until those exist, UPS orders simply behave like local ones — manual
checkpoints.** Nothing is blocked on the credentials.

### 1.4 Admin: entering checkpoints for local delivery

This is the part that decides whether the feature is actually used, because for
Nigeria local delivery **every checkpoint is a human action**. If it takes six
clicks, the timeline will be empty and the feature is decoration.

- On the order page: a one-tap row of the next likely stages. Tapping
  *"Out for delivery"* writes the checkpoint with `occurred_at = now` and a
  sensible default description — no form.
- Location pre-filled from the order's `shipping_state`, editable.
- Optional note for the exception case (*"Customer not available, retrying
  tomorrow"*) — the one checkpoint that genuinely needs free text.
- **Bulk action on the orders list**: select several, mark them all dispatched.
  Real dispatch happens in batches; making it one-at-a-time guarantees it is
  done late or not at all.
- Backdating allowed on `occurred_at` — a rider reports at end of day, and
  forcing "now" would make every delivery-time metric wrong.

### 1.5 Customer-facing

**Progress bar + checkpoint list**, the AliExpress/Jumia shape:

```
 ●━━━━━━━●━━━━━━━●━━━━━━━○━━━━━━━○
 Confirmed  Packed  Dispatched  In transit  Delivered

 14 Aug 09:32  Departed Lagos sorting centre        Lagos, NG
 13 Aug 17:04  Package handed to courier            Lagos, NG
 13 Aug 11:20  Order packed                         —
 12 Aug 20:15  Order confirmed                      —
```

- Newest first, dated, with location where there is one.
- Estimated delivery shown prominently — it is the question being asked.
- `exception` renders in amber with its description, never silently.
- Deep-link to UPS's own page from the existing `tracking_url_template`.
- One shared component, used on both the public `/track/[token]` page and
  `/account/orders/[id]`.

**Public access** — the security point from the original plan stands and matters
more here, because this page is designed to be reachable without a login: the
order id must not be the key. Signed HMAC token in the emailed link, plus a
rate-limited reference+email form as the manual fallback. The page shows the
journey and item names — never the full address, phone, or payment detail.

### 1.6 Notifications

A checkpoint the customer never sees is worth much less. Email on the stages
that matter — `dispatched`, `out_for_delivery`, `delivered`, `exception` — and
deliberately **not** on every `in_transit` scan, which on an international
shipment can be a dozen and trains people to ignore the mail.

Uses the existing branded shell with a **Track your package** button.

### 1.7 Effort

| | |
|---|---|
| Schema, events table, backfill, write path | 1 day |
| Admin checkpoint entry + bulk dispatch | 1 day |
| Customer timeline + public tracking page | 1.5 days |
| UPS poller | 1.5 days *(skippable until credentials exist)* |
| Notifications | 0.5 day |
| **Total** | **~5.5 days**, or **4 without UPS** |

### 1.8 Decisions needed

1. **Is Nigeria local delivery your own riders, or a third party?** If it is a
   third party with any kind of API or even a CSV export, that changes 1.4 from
   manual entry into a second integration — and it is the higher-volume channel,
   so it matters more than UPS.
2. **Do you have UPS API credentials**, or should the poller wait?
3. **Should customers see an estimated delivery date before dispatch?** Showing
   one early sets an expectation from `min_days`/`max_days` that nothing has
   verified yet.

---

## Part 2 — Page & visitor analytics

### 2.1 Decision: build it, don't bolt on Google Analytics

The whole point of this migration was owning the stack. GA also needs a cookie
banner in the EU, and the questions actually worth answering here ("which
products get looked at but not bought?") are join-with-orders questions that a
third-party tool cannot answer without exporting the catalogue to it.

**A first-party pageview table answers them with a JOIN.** That is the argument
for building rather than integrating — not ideology.

### 2.2 Collection

**New table** — `page_views`:

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial pk | high write volume; uuid is wasteful here |
| `path` | text | normalised — `/products/[slug]`, never the raw URL |
| `product_id` | uuid null | set on product pages, so views JOIN to sales |
| `referrer_host` | text null | host only; a full referrer URL is PII-adjacent |
| `visitor_hash` | text | see below |
| `session_id` | text | 30-minute window |
| `country` | text null | from the Caddy/CF header if present |
| `device` | text | phone / tablet / desktop, from UA |
| `is_bot` | boolean | filtered out of every report, kept for debugging |
| `created_at` | timestamptz | |

**`visitor_hash` — privacy by construction.** `sha256(ip + user_agent +
IP_HASH_SALT + date)`. Rotating the salt daily means a visitor cannot be tracked
across days, which keeps this out of "persistent identifier" territory and means
**no cookie banner**. The same technique is already used for newsletter signup
IPs (`hashIp`), so it is consistent with what the codebase already does.

**Where the hit is recorded — this is the key design decision:**

| Option | Verdict |
|---|---|
| In `proxy.ts` | **No.** Next's own docs warn against I/O in Proxy; it runs on every request including assets, and a slow write would slow every page. |
| Server Component on each page | **No.** Pollutes 40 pages and misses client navigations entirely. |
| **Client beacon → `POST /api/track`** | **Yes.** Fires after paint via `navigator.sendBeacon`, so it never blocks render; catches client-side route changes; trivially skipped for bots that do not run JS. |

The route must be **rate-limited and fire-and-forget** — analytics must never be
able to 500 a page or become a write-amplification DoS.

### 2.3 Bot filtering

Two layers: a UA denylist on the way in (`bot|crawl|spider|preview|monitor`),
and — because the beacon requires JS, which most crawlers do not run — most bots
never arrive at all. Rows are flagged rather than dropped, so a
misclassification is recoverable.

### 2.4 Rollups — the thing that stops this rotting

Querying raw `page_views` is fine at 10k rows and unusable at 10M. A nightly
job (the `ofelia` container already runs) collapses yesterday into
`daily_page_stats(date, path, product_id, views, unique_visitors, sessions)`.

Dashboards read the rollup; only "today" touches raw rows. Raw rows are pruned
after **90 days**; rollups are kept forever, because they are small.

**Effort: ~2.5 days.**

---

## Part 3 — Dashboard analytics

### 3.1 First: fix what is already broken

`/admin/analytics` loads every order and every order_item into Node and
aggregates with JavaScript `Map`s. At today's 1 order that is invisible. At
50,000 orders it is hundreds of megabytes and a timeout.

**Rewrite every figure as a SQL aggregate.** The queries are simple
`GROUP BY`s; the current code is doing by hand what Postgres does in one pass.
This is a correctness-at-scale fix, not an optimisation, and it should land
before anything new is added on top.

### 3.2 What the dashboard should show

Grouped by the question each answers:

**Money** — revenue for today / 7d / 30d, **bucketed by currency**. Never summed
across: the codebase already gets this right and the new code must not regress
it. Plus average order value, and orders by payment status.

**Fulfilment** (needs Part 1's events) — orders awaiting action, median
processing→shipped time, median shipped→delivered, and anything stuck in a
state beyond a threshold. That last one is the most operationally useful number
on the page and is impossible without status history.

**Demand** — units sold, top products by revenue, top by favourites (already
built), and **viewed-but-never-bought**: the join that justifies Part 2.

**Traffic** (needs Part 2) — visitors, views, top pages, referrers, device split.

**Funnel** — views → product views → checkout started → paid, with drop-off at
each step. Honest gap: *add-to-cart* cannot be measured until the cart is
server-side; the cart lives in `localStorage` today. Either instrument it as a
beacon event, or accept a three-stage funnel initially. **Flagging this rather
than quietly showing a broken funnel.**

### 3.3 Charts

`recharts` — already React, composes with Server Components fetching the data
and a thin client component drawing it. Sparklines on stat tiles, a revenue line
chart, a funnel bar. Follow the `dataviz` skill's palette guidance so the charts
read as one system in both themes.

### 3.4 Caching

Dashboard aggregates go through the existing Redis layer
(`src/infrastructure/cache/cache.ts`), 5-minute TTL, invalidated on order
status change. An admin refreshing a dashboard should not re-run six aggregates.

**Effort: ~3 days.**

---

## Sequencing

Deliberate order — each part unlocks the next:

1. **Part 1.2** — `order_tracking_events` + write path + backfill.
   *Everything fulfilment-related depends on this, and it is cheap.*
2. **Part 3.1** — rewrite `/admin/analytics` as SQL aggregates.
   *Do this before building on top of it.*
3. **Part 1.4–1.6** — admin checkpoint entry, customer timeline, public
   tracking page, notifications. *Customer-visible value, and it cuts support
   load.* The UPS poller (1.3) follows whenever credentials exist.
4. **Part 2** — collection, bot filtering, rollups.
   *Starts gathering data immediately; the longer it runs the more it is worth.*
5. **Part 3.2–3.4** — dashboard, charts, caching.
   *Last, because it presents what the earlier parts collect.*

**Total: ~11 days** (~9.5 without the UPS poller). Parts 1 and 2 are
independent and can run in parallel.

---

## Architecture rules this must follow

The ESLint layer rules will enforce most of it, but to be explicit:

- Pageview and analytics **types live in `src/domain/entities/`**, not in a
  service. That is the leak this migration spent days undoing.
- Aggregation queries live in `src/infrastructure/db/analytics-service.ts`.
  **Pages must not import `db` or the schema** — the rule fails the build.
- The tracking token helper and the UPS-code → `stage` mapping are pure
  functions and belong in `src/domain/`, with the secret injected rather than
  read from `process.env` inside them.
- New tables go in `src/infrastructure/db/schema/` and are migrated with
  `npm run db:generate`. **Watch the migration prefix** — the runner now refuses
  duplicates, which is exactly how the last collision was caught.

## Decisions needed before starting

1. **Tracking page auth** — signed token, reference+email, or both? *(Recommend both.)*
2. **Pageview retention** — 90 days of raw rows, or longer? Affects disk on a VPS.
3. **Funnel completeness** — instrument add-to-cart via beacon now, or ship a
   three-stage funnel and add it when the cart becomes server-side?
4. **Chart library** — `recharts`, or keep the dashboard numeric for now?
