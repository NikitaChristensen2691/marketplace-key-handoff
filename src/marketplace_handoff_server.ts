import { createServer } from "node:http";
import { ZodError } from "zod";
import { handoffRequestSchema } from "./handoff_contract.js";
import { createInfraiClient, InfraiError } from "./infrai_control_plane.js";
import { rotateMarketplaceKey } from "./marketplace_rotation.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/rotation-runs") {
    response.writeHead(404).end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = handoffRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await rotateMarketplaceKey(input, createInfraiClient());
    response.writeHead(result.state === "ready_to_revoke" ? 200 : 202).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code, detail: error.detail }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "service_error" }));
  }
});

server.listen(port, () => console.log(`Marketplace rotation service listening on ${port}`));
