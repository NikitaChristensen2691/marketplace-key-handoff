import { handoffRequestSchema } from "./handoff_contract.js";
import { createInfraiClient } from "./infrai_control_plane.js";
import { rotateMarketplaceKey } from "./marketplace_rotation.js";

const input = handoffRequestSchema.parse({
  rotationId: "sept-marketplace-cutover",
  oldKeyMarker: "marketplace-key-v1",
  graceHours: 24,
  sellerAssets: [{ sellerId: "seller-42", assetId: "catalog-2026-09", copied: true }],
  buyerUpdates: [{ buyerId: "buyer-17", sent: true }],
  orders: [{ orderId: "order-8801", handedOff: true }],
});

const result = await rotateMarketplaceKey(input, createInfraiClient());
console.log(JSON.stringify(result, null, 2));
