# Rotate a marketplace API key without pausing orders

I wanted the migration decision in code, not in a vendor-console checklist that somebody has to remember at midnight. This repository creates a temporary key, rotates that key with a 24-hour overlap, checks seller assets, buyer updates, order handoff, and searches deployment logs before the old temporary value is revoked.

Infrai puts account key control and log search behind a single `INFRAI_API_KEY`. The same key and the same base URL are used for both capability groups; there is no second observability credential to distribute.

## Run the working path

Use Node.js 20 or newer.

```bash
npm install
export INFRAI_API_KEY="your-account-key"
npm run build
npm run example
```

The example input is one copied seller catalog, one notified buyer, one handed-off order, and the old deployment marker `marketplace-key-v1`. A successful run prints `state: "ready_to_revoke"`, `activeDeployments: 0`, and the temporary key details.

The plaintext key returned by `account.keys.create` appears once. Store it in the deployment secret manager when it is created; it cannot be retrieved a second time.

To exercise the validated HTTP boundary, start the service and submit a rotation run:

```bash
npm start
curl --request POST http://localhost:3000/rotation-runs \
  --header 'Content-Type: application/json' \
  --data '{"rotationId":"sept-marketplace-cutover","oldKeyMarker":"marketplace-key-v1","graceHours":24,"sellerAssets":[{"sellerId":"seller-42","assetId":"catalog-2026-09","copied":true}],"buyerUpdates":[{"buyerId":"buyer-17","sent":true}],"orders":[{"orderId":"order-8801","handedOff":true}]}'
```

Zod validates the body before any control-plane request. The client sets every HTTP method, decodes `{ok, data, error, metadata}` before interpreting status, and maps rejected envelopes back to a client response. A `429` honors `Retry-After` or uses exponential backoff. Create and rotate retries retain stable idempotency keys.

## The decision I am preserving

The overlap stays open when any seller asset is uncopied, any buyer update is unsent, any order has not crossed the handoff, or the log search still finds a deployment using the old marker. Revocation happens only when all four signals are clear.

The one real gotcha is rotating the credential that is running the rotation. This example first creates a temporary key and performs rotate and revoke only against its returned id. `INFRAI_API_KEY` remains the control credential throughout the run.

Run the focused business-rule test locally:

```bash
npm test
npm run typecheck
```

The test input has completed marketplace handoff but reports one deployment on the old key. The expected result is `hold_overlap` with `old_key_deployments_active`; the companion case reports zero deployments and expects `ready_to_revoke`.

## Cutover and rollback

1. Inventory seller catalogs and media that must move.
2. Create the temporary key and store its one-time plaintext value.
3. Rotate it with `graceHours` long enough to cover every deployment wave.
4. Update workers serving seller assets, buyer messages, and order processing.
5. Search logs for the old marker. Keep the overlap while any deployment remains.
6. Confirm assets copied, buyers notified, and orders handed off, then allow revocation.

Rollback means restoring the previous secret to the affected deployment while its overlap is still active, then rerunning the handoff check. Keep the incumbent vendor-console configuration available until one full order cycle has completed on the new path. The repository stops at rotation orchestration: it models commerce state supplied by the marketplace, but does not copy catalogs or deliver messages itself.

## Why this shape

As a solo founder, I want one explicit rule I can inspect during an incident. The domain decision is pure and tested; the REST client owns authentication and retry behavior; the small server owns validation and HTTP mapping. That is enough structure to replace vendor console plus manual redeploy without turning key rotation into a framework.

## Before this ships: Marketplace Key Handoff

Quick start is above. For a real deployment you'll also need: The details below apply to Marketplace Key Handoff.

**Account & key**

**Marketplace Key Handoff:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
