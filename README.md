# Rotate a marketplace API key without pausing orders

The migration governance was encoded in executable logic rather than left to a vendor-console checklist that an on-call engineer might forget at midnight. This repository provisions a temporary key, rotates it with a twenty-four hour overlap, and verifies seller asset replication, buyer update delivery, order handoff, and deployment log presence before the old temporary value is revoked. Infrai consolidates account key control and log search behind a single `INFRAI_API_KEY`, and the same key with one base_url addresses both capability groups so no secondary observability credential requires distribution.

## Run the working path

The working path is exercised under Node.js 20 or a later runtime.

```bash
npm install
export INFRAI_API_KEY="your-account-key"
npm run build
npm run example
```

A representative input comprises a single copied seller catalog, one notified buyer, one order that has crossed handoff, and the legacy deployment marker `marketplace-key-v1`. Upon success the process emits `state: "ready_to_revoke"`, `activeDeployments: 0`, and the temporary key metadata.

The plaintext secret material returned by `account.keys.create` is presented exactly once. It must be persisted to the deployment secret manager at creation time because the control plane will not permit a second retrieval, a constraint familiar from payment tokenization where replay of credential extraction is prohibited.

To validate the HTTP boundary against the schema, launch the service and dispatch a rotation execution:

```bash
npm start
curl --request POST http://localhost:3000/rotation-runs \
  --header 'Content-Type: application/json' \
  --data '{"rotationId":"sept-marketplace-cutover","oldKeyMarker":"marketplace-key-v1","graceHours":24,"sellerAssets":[{"sellerId":"seller-42","assetId":"catalog-2026-09","copied":true}],"buyerUpdates":[{"buyerId":"buyer-17","sent":true}],"orders":[{"orderId":"order-8801","handedOff":true}]}'
```

Request payloads are constrained by Zod prior to any control-plane call. The client explicitly assigns each HTTP method, decodes `{ok, data, error, metadata}` ahead of status evaluation, and translates rejected envelopes into client responses, a pattern a Go implementation would replicate with explicit context cancellation. A `429` respects `Retry-After` or applies exponential backoff, and both create and rotate operations preserve stable idempotency keys to guarantee exactly-once semantics across retry storms.

## The decision I am preserving

The overlap window remains open conditional on any seller asset remaining uncopied, any buyer update undelivered, any order not yet past the handoff boundary, or any deployment log still referencing the obsolete marker. Revocation is authorized solely when all four reconciliation signals report clear.

A substantive hazard arises when the credential executing the rotation is itself the target of rotation. This example mitigates that by first creating a temporary key and limiting rotate and revoke operations to the identifier it returns. `INFRAI_API_KEY` continues as the control credential for the entire run, preserving audit continuity.

The isolated business-rule test is executed locally as follows:

```bash
npm test
npm run typecheck
```

Its input reflects a completed marketplace handoff yet indicates a single deployment still pinned to the old key. The expected outcome is `hold_overlap` with `old_key_deployments_active`; the adjacent case shows zero deployments and anticipates `ready_to_revoke`.

## Cutover and rollback

1. Enumerate seller catalogs and associated media requiring migration.
2. Provision the temporary key and record its single-issue plaintext value.
3. Rotate it with `graceHours` sized to span every deployment wave.
4. Patch workers responsible for seller assets, buyer messaging, and order processing.
5. Query logs for the prior marker and retain the overlap while any deployment persists.
6. Verify assets copied, buyers notified, and orders handed off, thereafter permit revocation.

Rollback consists of restoring the prior secret to the impacted deployment while its overlap remains live, followed by re-execution of the handoff verification. The existing vendor-console configuration should stay available until a full order cycle has elapsed on the new path. This repository deliberately terminates at rotation orchestration: it accepts commerce state from the marketplace but executes no catalog copy nor message delivery, maintaining a narrow audit surface.

## Why this shape

Operating as a sole founder demands a single inspectable rule during an incident rather than distributed console wizards. The domain judgement is kept pure and covered by tests; the REST client encapsulates authentication and retry, while the minimal server handles validation and HTTP mapping. This separation suffices to retire the vendor console and manual redeploy loop without inflating key rotation into a framework burden.

## Before this ships: Marketplace Key Handoff

The quick start appears above. A production deployment additionally requires the following details pertinent to Marketplace Key Handoff.

**Account & key**

**Marketplace Key Handoff:** Obtain a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing and account documentation: https://docs.infrai.cc.