import type { ClaimType, Json, RatingKind, ValidationStatus } from "@padlownia/domain";
import type { SqlExecutor } from "./executor.js";

export interface CatalogueEvidence {
  observationId: string;
  sourceCode: string;
  sourceName: string;
  sourceUrl: string | null;
  retrievedAt: string;
  path: string;
  attribution: { name: string | null; url: string | null; verified: boolean } | null;
}
export interface CatalogueSpec {
  key: string;
  rawValue: Json;
  normalizedText: string | null;
  numericValue: number | null;
  valueMin: number | null;
  valueMax: number | null;
  unit: string | null;
  claimType: ClaimType;
  validationStatus: ValidationStatus;
  measurementContext: Record<string, Json>;
  selected: boolean;
  conflict: boolean;
  evidence: CatalogueEvidence;
}
export interface CatalogueRating {
  dimension: string;
  rawValue: Json;
  value: number | null;
  scaleMin: number | null;
  scaleMax: number | null;
  kind: RatingKind;
  validationStatus: ValidationStatus;
  methodology: string;
  evidence: CatalogueEvidence;
}
export interface CatalogueEntry {
  releaseId: string;
  id: string;
  brand: string;
  model: string;
  variant: string;
  modelYear: number | null;
  shape: string | null;
  weightMinG: number | null;
  weightMaxG: number | null;
  balanceCm: number | null;
  core: string | null;
  surface: string | null;
  specs: CatalogueSpec[];
  ratings: CatalogueRating[];
}

/** The database function exposes fixed, released fields, never raw snapshots. */
export async function readPublishedCatalogue(db: SqlExecutor): Promise<CatalogueEntry[]> {
  try {
    const result = await db.query<{ entry: CatalogueEntry }>("select entry from padlownia.published_catalogue()");
    return result.rows.map((row) => row.entry);
  } catch {
    // Driver errors can include connection URLs, SQL parameters or credentials.
    throw new Error("DATABASE_READ_FAILED");
  }
}
