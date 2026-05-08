import { Router, type Request, type Response } from "express";

/**
 * Root HTTP surface: health and status for probes (MSGF `probe-author-ecosystem.mjs`).
 */
export const rootController = Router();

rootController.get("/api/ping", (_req: Request, res: Response) => {
  res.json({ pong: true, service: "author-ecosystem" });
});

rootController.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "author-ecosystem",
    version: "0.1.0",
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
