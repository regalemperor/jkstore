# JKSTORE — Project Build Documentation

## 1. Document purpose

This is the living engineering record for JKSTORE. It records the product-development process, architecture decisions, implementation milestones, security hardening, deployment verification, defects found, fixes applied, and test evidence.

The document follows the agreed professional build discipline:

BUILD → DEPLOY → TEST → REVIEW → FIX → RE-TEST → MARK COMPLETE

No phase is considered complete merely because code was written. Completion requires verification.

A final PDF version will be generated after the website reaches production/live status and the final production review is complete.

## 2. Product

**Project:** JKSTORE  
**Type:** Nigerian ecommerce platform  
**Primary stack:** Next.js, TypeScript, React, Tailwind CSS, Supabase/PostgreSQL, Paystack, Vercel  
**Repository:** regalemperor/jkstore  
**Development branch:** dev/foundation  
**Production branch policy:** main is reserved for production.

### Core product goals

- Product browsing and storefront experience
- Cart management
- Secure guest checkout
- Inventory reservation
- Paystack payments
- Server-side payment verification
- Webhook reconciliation
- Secure customer order access
- Admin/store operations
- Production-grade security and operational hardening

## 3. Engineering protocol

Professional development phases:

1. Discovery
2. Research & Validation
3. Product Definition / PRD
4. Architecture
5. Design
6. Development
7. Security, Compliance & Production Considerations
8. Testing
9. Deployment
10. Production Readiness
11. Final Review

Functional phases:

1. Foundation audit
2. Product system
3. Cart system
4. Customer checkout
5. Payment
6. Order system
7. Admin/store management
8. Production hardening
9. Testing & deployment
10. Final project review

## 4. Project history and major milestones

### Foundation and repository setup

JKSTORE was established as a Next.js/TypeScript ecommerce application with GitHub and Vercel as the source/deployment workflow.

The project adopted dev/foundation for ongoing implementation, with main reserved for production.

### Supabase commerce foundation

Supabase/PostgreSQL became the transactional data layer. Product data, orders, order items, inventory/reservations and payment-related records were structured around server-side business rules.

Critical mutations were hardened so untrusted clients cannot simply manipulate transactional state.

### Cart and checkout

Checkout was designed around server-side order creation rather than trusting browser-submitted totals.

Inventory reservations were introduced to prevent checkout/payment races and protect stock from uncontrolled manipulation.

### Payment implementation

Paystack was integrated using server-side transaction initialization and verification.

The browser redirect is not treated as proof of payment. Payment confirmation depends on independent server-side Paystack verification and reconciliation.

### Payment fee incident and correction

An early test used Paystack customer-fee pass-through while the application ledger expected the order net amount.

An ₦18,000 order produced a customer charge of approximately ₦18,375.64, while the application's expected amount remained the order total. Server-side verification correctly rejected the mismatch.

The configuration was returned to fee absorption for the verified test path, and a fee-aware ledger architecture was subsequently implemented.

### Fee-aware payment ledger

A dedicated Paystack fee calculation layer now supports absorb and pass_to_customer modes.

The payment ledger records order amount, expected customer charge, fee mode and provider fee information.

Reconciliation validates order amount, expected provider/customer charge, currency, provider transaction identity and duplicate/replay conditions.

### Webhook security

The Paystack webhook endpoint was hardened using raw-body verification, HMAC SHA-512, timing-safe signature comparison, payload/reference validation, independent Paystack verification, idempotent reconciliation and controlled responses.

The deployed endpoint was independently checked and correctly returned HTTP 405 to GET requests, confirming the route is recognized while remaining POST-only.

Actual webhook delivery was subsequently confirmed successfully.

### Order access security

Guest order access does not rely on user_id.

A high-entropy opaque guest token is generated, SHA-256 hashed for database storage, and delivered through a secure HttpOnly cookie.

The order API requires the exact order ID, matching token hash and an unexpired access token. Changing an order ID alone therefore does not authorize access to another order.

Order responses are marked no-store.

### Payment redirect access issue

A real integration issue was found during testing: the guest order-access cookie could be lost across the Paystack redirect/host transition.

The insecure solution would have been to weaken authorization and rely on the order ID.

Instead, after independent server-side payment verification and reconciliation, the application issues a fresh guest order-access token for the verified order.

### Order lifecycle hardening

The order lifecycle was expanded to handle payment success/failure/reversal/refund paths and reservation release behavior.

Stale checkout reservations are released before appropriate retry checks.

Legacy checkout RPC access was removed/restricted after the hardened RPC was established.

Payment reconciliation was restricted to the service role.

### Admin authentication foundation

A separate admin security boundary was introduced.

The admin_roles table stores user ID, role and timestamps. Supported roles are owner, admin and operations.

RLS is enabled and authenticated users can only read their own role. Public clients cannot insert/update/delete admin roles.

Admin access is based on Supabase Auth plus a database role record.

The admin route uses server-side authorization rather than relying only on UI visibility.

Next.js 16 proxy.ts is used for authentication/session handling on admin routes, while page-level authorization remains the authoritative admin-role gate.

### Build defects and corrections

The first admin-auth deployment attempts exposed integration issues caused by the asynchronous Supabase server client migration and Next.js 16 requirements.

Issues included server Supabase client callers that needed to await the new async factory, and a Next.js production prerender failure caused by useSearchParams in the admin login page without a Suspense boundary.

The affected callers were corrected. The admin login page was wrapped in a Suspense boundary.

The corrected deployment successfully completed production compilation, TypeScript checking, static generation and deployment.

### Admin logout

An explicit admin sign-out control was added to the dashboard. Logout uses Supabase Auth's browser client, redirects to admin login and refreshes the route.

This remains subject to authenticated-session testing before Phase 7.1 is marked complete.

## 5. Current architecture

### Frontend

- Next.js 16.3.3
- React 19.2.0
- TypeScript 5.9.2
- Tailwind CSS 4.1.13
- App Router

### Backend/data

- Supabase
- PostgreSQL
- server-side RPCs for sensitive transactional operations
- RLS and database grants for authorization boundaries

### Payments

- Paystack
- server-side initialization
- server-side verification
- HMAC SHA-512 webhook verification
- idempotent reconciliation
- fee-aware amount ledger

### Deployment

- GitHub
- Vercel
- preview deployments from development work
- production reserved for the production branch

## 6. Security architecture principles

1. Never trust browser-calculated payment totals.
2. Never treat a payment redirect as payment proof.
3. Verify payments independently on the server.
4. Verify webhook authenticity before parsing/trusting the event.
5. Keep payment reconciliation restricted to trusted server credentials.
6. Do not expose service-role secrets to the browser.
7. Do not authorize guest orders by sequential/public order ID alone.
8. Use high-entropy opaque access tokens and store hashes where appropriate.
9. Use database constraints/RPCs to protect transactional invariants.
10. Keep admin authorization separate from customer access.
11. Enforce authorization server-side for every sensitive admin API.
12. Add rate limiting and abuse controls before production.
13. Do not claim the system is hacker-proof; security is continuously tested and hardened.

## 7. Deployment record

### Successful admin-auth deployment

Commit: 9f61dfa81f2a63b69ec6b2e8a34d0f7c549f915f  
Message: fix: wrap admin login search params in suspense  
Branch: dev/foundation  
Vercel deployment: dpl_C7cHqDNnTkwMxAwavvyEMnXiNeNM  
State: READY

Build evidence:
- Next.js 16.3.3 detected
- production build compiled successfully
- TypeScript completed successfully
- 11/11 static pages generated
- route optimization completed
- deployment completed successfully

The checked 24-hour Vercel runtime-error window reported no runtime errors.

### Important implementation commits

- b24f0447b47c8ada613620c11dd58e46cb530591 — admin role database foundation
- 0193ba8b038c5e92f1eec60601ff7408549bf1df — browser Supabase client
- f54ddcfbfe62fb4588b0f728ff2c78b8311f5d21 — async server Supabase client
- ed9095fe01581a2e7e112fb6405125c380ca754a — admin authorization helpers
- 888e6ce1f2ab5c986cad482f6db5f99a4eab0b32 — admin proxy/auth foundation
- 781cfe59c86dba45845accfeb44eb581b76bf0c8 — admin dashboard foundation
- d6ed942cb14df89064b1148f85f6dd477f60047b — async server client fix in checkout
- fe384e44a0f96c97f2136dee09f4cd249c8b5693 — async server client fix in product repository
- f148aeecfb5b83d74d788c26dcdb0a16e8173021 — refresh guest order access after payment verification
- 5add640c54a24df1d3e3f11c0133c640a78e44a1 — hardened checkout/order lifecycle
- 547d0132aac3ae0bb3badb254b6c73c51f53eb91 — admin logout control

## 8. Defects found and how they were handled

### Paystack fee mismatch
Problem: provider charged a fee-inclusive amount while application expected the net order amount.  
Control: server-side amount verification rejected the mismatch.  
Fix: fee-aware ledger and explicit fee-mode architecture.

### Guest access lost after payment redirect
Problem: secure guest access cookie was not available after the payment host transition.  
Unsafe alternative rejected: weakening authorization to rely on order ID.  
Fix: rotate/reissue guest order access after independent payment verification.

### Legacy checkout RPC exposure
Problem: old RPC access remained broader than the hardened checkout path.  
Fix: revoke/remove legacy access and restrict the hardened RPC.

### Next.js 16 admin login build failure
Problem: production prerender failed because useSearchParams lacked a Suspense boundary.  
Fix: isolate the search-param-dependent form and wrap it in Suspense.

### Async Supabase server client migration
Problem: existing callers used the server client synchronously after the factory became async.  
Fix: update affected callers to await the client.

## 9. Completed functional phases

### Phase 5 — Payments
Status: COMPLETE

Verified:
- Paystack initialization
- payment flow
- callback confirmation
- server-side verification
- amount protection
- fee-aware ledger
- webhook deployment
- webhook HMAC verification
- idempotent reconciliation design
- actual webhook delivery

### Phase 6 — Order System
Status: COMPLETE

Verified:
- order model/lifecycle
- secure guest order access
- order details
- order timeline
- payment success/failure lifecycle handling
- reservation release behavior
- authorization hardening
- legacy RPC restriction

### Phase 7.1 — Admin Identity & Authorization
Status: COMPLETE

Implemented:
- admin role table
- RLS
- admin role helper
- auth proxy
- admin login
- server-side role gate
- admin dashboard foundation
- logout control

Verified:
- official owner account provisioned
- authenticated admin login
- owner role resolution
- session persistence after refresh
- logout
- unauthenticated redirect back to admin login
- admin boundary acceptance testing

## 10. Remaining roadmap

### Phase 7 — Admin / Store Management

7.1 Admin identity & authorization — COMPLETE  
7.2 Dashboard architecture — COMPLETE  
7.3 Order management  
7.4 Inventory management  
7.5 Product management  
7.6 Customer/order operations  
7.7 Admin audit/security  
7.8 Admin testing

### Phase 8 — Production hardening

- rate limiting
- abuse protection
- input/request-size validation
- auth abuse controls
- security headers
- controlled error handling
- observability/monitoring
- database grants/RLS audit
- secret exposure audit
- IDOR and privilege-escalation testing
- payment replay/idempotency tests
- inventory manipulation tests

### Phase 9 — Testing & deployment

- unit tests where useful
- integration tests
- end-to-end checkout/payment tests
- negative security tests
- cross-device/browser checks
- production deployment rehearsal
- rollback/recovery checks

### Phase 10 — Production readiness

- production environment variables
- production Paystack configuration
- domain/DNS
- final database migration verification
- backup/recovery verification
- monitoring/alerting
- operational runbook
- customer-facing policies
- privacy/security review

### Phase 11 — Final review

- complete architecture audit
- requirements traceability
- security review
- UX review
- performance review
- deployment verification
- live-site smoke tests
- final documentation
- generate final PDF project record



## 10.1 Phase 7.2 — Dashboard architecture

### Architectural decision

The admin dashboard is the operational control surface for JKSTORE. It is protected by the existing server-side admin authorization boundary and uses a server-only data layer for dashboard reads.

The dashboard deliberately does not expose a public dashboard API at this stage. Server Components call the server-only admin data layer after `requireAdmin()` succeeds. This keeps service-role access off the browser and avoids adding an unnecessary public attack surface.

### Information architecture

The admin workspace is organized around:

- Dashboard
- Orders
- Inventory
- Products
- Customers

The navigation shell is established now, while future operational sections remain intentionally disabled until their dedicated phases are implemented.

### Dashboard metrics

The first dashboard view exposes:

- Revenue from successfully paid orders
- Total order count
- Pending payment count
- Fulfillment counts by lifecycle state
- Low-stock product count
- Out-of-stock product count
- Currently reserved inventory units
- Recent order/payment/system events

Revenue is calculated from the order ledger rather than the Paystack customer charge. This keeps business revenue distinct from provider fee pass-through amounts.

The current low-stock threshold is 5 units for active products. This is an operational default and can be made configurable during inventory management work.

### Role model

Current roles:

| Role | Dashboard | Orders | Inventory | Products | Customers | Role administration |
|---|---|---|---|---|---|---|
| owner | read/write | read/write | read/write | read/write | read/write | yes |
| admin | read/write | read/write | read/write | read/write | read/write | no |
| operations | read | read/write | read/write | read | read | no |

This matrix is an authorization design target for the remaining Phase 7 work. UI visibility will never be treated as the security boundary; every sensitive server operation must enforce the role independently.

### Security boundary

The dashboard data layer uses the server-only Supabase administrative client. It must only be reached after server-side admin authorization. Service-role credentials are never sent to the browser.

Supabase's current guidance supports using `getClaims()` to verify sessions for protected pages and `getUser()` when a fresh Auth-server user record is specifically needed. The existing admin helper currently uses `getUser()`; this remains valid but will be reviewed for optimization and consistency during the Phase 8 security audit.

### Phase 7.2 implementation status

Implemented:

- protected admin layout
- desktop admin navigation shell
- role/email context in shell
- dashboard metric data layer
- revenue/order/payment metrics
- fulfillment overview
- inventory health overview
- recent-activity data foundation
- responsive dashboard cards

Still required before Phase 7.2 can be marked complete:

- production-quality responsive/mobile admin navigation
- dashboard error/empty/loading states
- final visual/UX review
- verification against live data
- role-aware navigation/access behavior
- automated/manual regression testing
- deployment verification
- documentation update with test evidence

## 11. Documentation policy going forward

Every material implementation change should be recorded with:
- date
- phase
- objective
- architectural reason
- implementation
- tests performed
- defects discovered
- fixes
- deployment/commit evidence
- remaining risks
- completion status

When a phase is completed, its completion must be based on evidence rather than assumption.

The final PDF will be generated only after JKSTORE is live and the final production review is complete.

## 12. Current status

Project is actively under development.

Current phase: Phase 7.2 — Admin Dashboard Architecture

Phase 7.1 is COMPLETE. The remaining 7.2 gate is authenticated UI/UX acceptance plus final deployment verification after the latest dashboard hardening changes.

Production status: Not yet declared live/production-ready.


## 13. Phase completion record — Phase 7.2

### Date
2026-09-25

### Objective
Establish and validate the JKSTORE admin dashboard architecture as the operational control surface for store management.

### Completion evidence
- Dashboard implementation deployed successfully on the dev/foundation branch.
- Vercel deployment reached READY state.
- Owner authenticated successfully.
- Dashboard metrics and recent activity were visually accepted.
- Desktop and iPhone/mobile navigation were accepted.
- Store navigation was accepted.
- Session persistence after refresh was accepted.
- Logout and post-logout protection were accepted.

### Result
**Phase 7.2 — COMPLETE**

### Remaining risks
- The admin navigation currently exposes future operational areas as disabled placeholders until their dedicated phases are implemented.
- Role permissions remain a design target until each operational area is implemented and tested.
- Production hardening, rate limiting, abuse controls, security headers, observability and final production-readiness work remain outstanding.

### Next phase
**Phase 7.3 — Order Management**

Phase 7.3 will cover order discovery, search/filtering, order detail operations, payment/fulfillment state visibility, customer information handling, and server-side role enforcement. No order-management mutation will be treated as secure merely because the corresponding UI control is hidden.

## 14. Phase 7.3 — Order Management architecture

### Objective
Provide authorized store operators with a secure operational view of orders without turning the admin interface into unrestricted database CRUD.

### Scope
- Bounded, paginated order list
- Search by order ID, payment reference, customer email/name/phone
- Fulfillment and payment filters
- Order detail view
- Customer/delivery information
- Items and monetary totals
- Payment transaction visibility without secrets
- Order timeline
- Controlled fulfillment transitions
- Server-side role enforcement
- Audit events for admin fulfillment actions

### State transitions
Customer payment state remains authoritative from server-side Paystack verification/reconciliation. Admin fulfillment transitions are limited to:
- `paid → processing`
- `processing → shipped`
- `shipped → delivered`

The admin interface will not mark payments successful, alter payment amounts, issue refunds, or bypass payment reconciliation. Cancellation/refund workflows remain separate concerns.

Each transition must lock the order, validate the current state and successful payment, validate the actor's active admin role, update atomically, and append an `order_events` audit record.

### Authorization and data access
Admin reads and mutations require the server-side admin boundary. Mutation requests also use an origin check. The database transition function independently validates the actor's admin role and state transition. The server-only admin data layer never returns guest access tokens/hashes or provider secrets.

### Acceptance criteria
- Owner can open Orders.
- Search/filter/pagination work with bounded queries.
- Order details show items, customer/delivery data, payment state and timeline.
- Valid fulfillment transitions succeed; invalid/unpaid transitions fail.
- Unauthorized users cannot access admin order APIs.
- Database rejects non-admin transition actors.
- Successful transitions create audit events.
- UI works on desktop and iPhone.

### Remaining risks
Rate limiting and abuse controls remain Phase 8. Refund/cancellation and inventory mutation remain outside this phase.


## 15. Phase 7.3 implementation checkpoint

### Implemented
- Admin Orders navigation enabled on desktop and mobile.
- Bounded order list API with 25-row default page size and 100-row hard maximum.
- Search by order ID, payment reference, customer email/name/phone.
- Fulfillment and payment-status filters.
- Admin order detail API.
- Order items, customer/delivery information, payment summary and event timeline.
- Payment transaction presentation excludes verification metadata and secrets.
- Atomic database fulfillment transition function.
- Database role validation for transition actors.
- Origin validation on browser mutation requests.
- Valid transition enforcement: paid → processing → shipped → delivered.
- Successful transition audit events.
- Admin order list/detail UI responsive for desktop and iPhone.

### Completion record

Deployment/build verification:
- Latest Phase 7.3 deployment reached READY on Vercel.
- Production build compiled successfully.
- TypeScript checking completed successfully.
- All Phase 7.3 admin order routes were included in the production build.
- No Vercel runtime errors were found in the selected 24-hour verification window.

Database verification:
- `supabase/migrations/20260925_admin_order_management.sql` was successfully applied.
- The atomic fulfillment transition function is therefore available for the acceptance path.

Authenticated acceptance:
- Admin Orders list loaded successfully.
- Search, filters and pagination passed.
- Order detail view passed.
- Customer/delivery information, payment summary and timeline passed.
- Valid fulfillment transition testing passed.
- Status persistence after refresh passed.
- Desktop and iPhone acceptance passed.

### Result

**Phase 7.3 — COMPLETE**

### Remaining risks
- Rate limiting and broader abuse controls remain Phase 8.
- Refund/cancellation workflows remain separate from fulfillment progression.
- Inventory mutation and stock-adjustment operations remain Phase 7.4.

## 16. Phase 7.4 — Inventory Management architecture

### Objective
Build a secure inventory control system that makes stock availability, reservations and adjustments operationally manageable without allowing the admin UI to bypass the transactional protections already used by checkout and payment reconciliation.

### Architecture issue → Why it matters
JKSTORE already has product stock and temporary inventory reservations. Inventory is therefore not simply a CRUD field on the product record.

If an administrator can directly overwrite stock while customers are checking out, the system can create overselling, reservation inconsistencies, negative available stock, or unexplained inventory changes.

### Professional approach
Inventory must be treated as a transactional subsystem with:
- authoritative product stock
- active reservation accounting
- available-stock calculation
- controlled adjustments
- immutable audit history
- server-side role enforcement
- database-level invariants
- atomic updates

The customer checkout path remains responsible for creating/releasing reservations. The admin inventory system must not silently modify or delete customer reservations.

### Inventory model

For each active product:

`available_stock = inventory_quantity - active_reserved_quantity`

where active reservations are records with:
- `status = 'reserved'`
- `expires_at > now()`

Operational states:
- **In stock** — available quantity above threshold
- **Low stock** — available quantity at or below the configured threshold
- **Out of stock** — available quantity is zero
- **Reserved** — units temporarily committed to active checkout sessions

The UI will show both physical inventory and available inventory so operators can distinguish actual stock from stock temporarily held by checkout sessions.

### Adjustment model

Admin inventory changes will use explicit adjustment operations rather than unrestricted product updates.

Each adjustment should record:
- product ID
- quantity delta
- previous inventory quantity
- resulting inventory quantity
- reason/category
- optional operator note
- actor ID
- actor role
- timestamp
- source/reference when applicable

Suggested adjustment reasons:
- stock received
- stock count correction
- damaged/lost stock
- returned stock
- manual correction

Direct browser writes to `products.inventory_quantity` will not be permitted.

### Transactional safety

An inventory adjustment must:
1. authenticate the admin session;
2. verify the actor's active admin role;
3. lock the product row;
4. calculate the resulting quantity;
5. reject any result below active reserved quantity;
6. update inventory atomically;
7. create an immutable audit event;
8. return the resulting inventory state.

This prevents an administrator from reducing physical stock below units currently reserved for customers.

### Role model

Initial permissions:
- **owner** — full inventory management
- **admin** — inventory management
- **operations** — inventory management
- customer/guest — no inventory mutation access

UI visibility will not be treated as authorization. Every inventory mutation will enforce the role server-side and at the database operation boundary.

### Inventory dashboard scope

Phase 7.4 will provide:
- inventory list
- search by product name/category
- active/inactive filtering
- stock quantity
- reserved quantity
- available quantity
- low-stock/out-of-stock indicators
- configurable/default low-stock threshold
- product detail inventory view
- controlled stock adjustment
- adjustment history/audit trail

### Concurrency requirements

Checkout and admin inventory adjustments can occur concurrently.

The inventory adjustment transaction must lock the relevant product row before calculating the new quantity. Checkout already locks product rows while creating reservations. Both paths therefore participate in a consistent database locking strategy.

The system must never rely on a browser-calculated "available stock" value for mutation.

### Reservation handling

Phase 7.4 will expose reservation visibility but will not give administrators arbitrary reservation-edit/delete controls.

Reservation lifecycle remains:
- `reserved` during active checkout
- `fulfilled` after verified successful payment
- `released` after expiry/failure/reversal

Expired reservations may be released by trusted server operations. Manual reservation deletion is out of scope unless a separate audited operational requirement is established.

### Inventory audit

Every admin stock adjustment must produce an audit record.

The audit should be represented through the existing `order_events` only when an adjustment is directly order-related; otherwise Phase 7.4 should introduce a dedicated inventory adjustment ledger/table. A dedicated ledger is preferred because inventory changes are not inherently order events.

Recommended table concept:
`inventory_adjustments`

Core fields:
- id
- product_id
- actor_id
- actor_role
- quantity_delta
- quantity_before
- quantity_after
- reason
- note
- reference
- created_at

The adjustment ledger should be append-only from the application perspective. Administrative corrections should create compensating entries rather than rewriting history.

### Security requirements

Phase 7.4 must explicitly prevent:
- unauthenticated inventory reads where sensitive operational data would be exposed
- customer/guest inventory mutation
- direct client writes to product stock
- negative inventory
- reducing stock below active reservations
- bypassing role checks
- forged actor identity
- duplicate adjustment execution
- race-condition overselling
- exposing internal admin notes unnecessarily

Rate limiting remains a Phase 8 concern but inventory mutation endpoints must be designed so rate limiting can be added without changing the authorization model.

### Acceptance criteria

Phase 7.4 will not be marked complete until:
- inventory list loads for authorized admins;
- stock/reserved/available values are correct;
- low-stock and out-of-stock states are correct;
- inventory search/filtering works;
- valid adjustments succeed atomically;
- invalid adjustments are rejected;
- stock cannot be reduced below active reservations;
- unauthorized users receive 401/403;
- database-level authorization rejects unauthorized mutation attempts;
- concurrent adjustment/checkout scenarios preserve invariants;
- every successful adjustment creates an audit record;
- adjustment history is immutable from the normal admin UI;
- desktop and iPhone acceptance passes;
- deployment/build/runtime verification passes.

### Out of scope for 7.4
- product creation/editing
- pricing changes
- product media
- supplier management
- purchase orders
- automated replenishment
- refunds/returns workflow
- warehouse/multi-location inventory
- barcode/scanner integration
- advanced inventory forecasting

### Phase 7.4 implementation gate
Architecture is defined. No inventory code should be accepted until the database model, adjustment invariants, role permissions and audit strategy are reviewed against the existing checkout/reservation implementation.

## 17. Current status

Project is actively under development.

Current phase: **Phase 7.4 — Inventory Management architecture**

Phase 7.3 is **COMPLETE**.

Production status: Not yet declared live/production-ready.

Next build action: implement the Phase 7.4 inventory ledger and transactional adjustment foundation only after the architecture above has been validated against the existing schema and checkout locking behavior.
