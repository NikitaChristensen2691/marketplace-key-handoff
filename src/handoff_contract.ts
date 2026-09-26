import { z } from "zod";

export const handoffRequestSchema = z.object({
  rotationId: z.string().min(3),
  oldKeyMarker: z.string().min(4),
  graceHours: z.number().int().min(1).max(168),
  sellerAssets: z.array(z.object({
    sellerId: z.string().min(1),
    assetId: z.string().min(1),
    copied: z.boolean(),
  })).min(1),
  buyerUpdates: z.array(z.object({
    buyerId: z.string().min(1),
    sent: z.boolean(),
  })).min(1),
  orders: z.array(z.object({
    orderId: z.string().min(1),
    handedOff: z.boolean(),
  })).min(1),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type HandoffDecision = {
  state: "ready_to_revoke" | "hold_overlap";
  blockers: string[];
};

export type LogSearchData = {
  results?: unknown[];
  items?: unknown[];
};
