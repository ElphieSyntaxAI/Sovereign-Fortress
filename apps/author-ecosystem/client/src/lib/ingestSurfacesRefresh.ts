import { getPreferredBffBearer } from "./authAccessToken";
import { bootstrapPlotEngineFromWiki } from "./plotEngineBootstrap";

/** Re-fetch wiki rows into Plot Sandbox after ingest (covers DB-only commits). */
export async function refreshIngestSurfaces(manuscriptId: string): Promise<void> {
  await bootstrapPlotEngineFromWiki(manuscriptId, () => getPreferredBffBearer(), { force: true });
}
