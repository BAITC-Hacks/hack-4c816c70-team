import { getAlternatives } from "@/lib/api/client";
import type { AlternativesLoader } from "./types";

/** Browser request to the published C# alternatives endpoint. */
export const alternativesLoader: AlternativesLoader = getAlternatives;
