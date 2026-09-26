import type { HandoffDecision, HandoffRequest } from "./handoff_contract.js";

export function decideHandoff(input: HandoffRequest, deploymentsOnOldKey: number): HandoffDecision {
  const blockers: string[] = [];
  if (input.sellerAssets.some((asset) => !asset.copied)) blockers.push("seller_assets_pending");
  if (input.buyerUpdates.some((update) => !update.sent)) blockers.push("buyer_updates_pending");
  if (input.orders.some((order) => !order.handedOff)) blockers.push("orders_pending");
  if (deploymentsOnOldKey > 0) blockers.push("old_key_deployments_active");

  return {
    state: blockers.length === 0 ? "ready_to_revoke" : "hold_overlap",
    blockers,
  };
}
