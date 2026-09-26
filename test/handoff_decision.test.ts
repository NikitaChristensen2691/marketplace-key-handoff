import assert from "node:assert/strict";
import test from "node:test";
import type { HandoffRequest } from "../src/handoff_contract.js";
import { decideHandoff } from "../src/handoff_decision.js";

const completedHandoff: HandoffRequest = {
  rotationId: "rotation-17",
  oldKeyMarker: "old-key-marker",
  graceHours: 24,
  sellerAssets: [{ sellerId: "seller-2", assetId: "listing-8", copied: true }],
  buyerUpdates: [{ buyerId: "buyer-3", sent: true }],
  orders: [{ orderId: "order-5", handedOff: true }],
};

test("keeps the overlap while one deployment still reports the old key", () => {
  assert.deepEqual(decideHandoff(completedHandoff, 1), {
    state: "hold_overlap",
    blockers: ["old_key_deployments_active"],
  });
});

test("allows revocation after commerce handoff and deployment migration complete", () => {
  assert.deepEqual(decideHandoff(completedHandoff, 0), {
    state: "ready_to_revoke",
    blockers: [],
  });
});
