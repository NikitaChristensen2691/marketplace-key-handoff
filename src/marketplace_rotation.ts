import type { HandoffRequest, LogSearchData } from "./handoff_contract.js";
import { decideHandoff } from "./handoff_decision.js";
import type { InfraiClient } from "./infrai_control_plane.js";

function deploymentCount(data: LogSearchData): number {
  if (Array.isArray(data.results)) return data.results.length;
  if (Array.isArray(data.items)) return data.items.length;
  return 0;
}

export async function rotateMarketplaceKey(input: HandoffRequest, infrai: InfraiClient) {
  // Create a disposable key so the credential authenticating this run is never rotated or revoked.
  const temporaryKey = await infrai.account.keys.create(input.rotationId);
  try {
    await infrai.account.keys.rotate(temporaryKey.id, input.graceHours, input.rotationId);

    const logData = await infrai.logs.search(input.oldKeyMarker);
    const activeDeployments = deploymentCount(logData);
    const decision = decideHandoff(input, activeDeployments);

    return {
      rotationId: input.rotationId,
      temporaryKeyId: temporaryKey.id,
      newKey: temporaryKey.key,
      activeDeployments,
      ...decision,
    };
  } finally {
    await infrai.account.keys.revoke(temporaryKey.id);
  }
}
