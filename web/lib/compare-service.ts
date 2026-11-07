import { connect, keyStores } from "near-api-js";
import {
  buildScenarioSteps,
  getReasonExplanation,
  ComparisonStepResult,
  BudgetInfo,
} from "./compare-scenario";

export interface CacheEntry {
  timestamp: number;
  payload: {
    steps: ComparisonStepResult[];
    budget: BudgetInfo | null;
  };
}

let cachedResponse: CacheEntry | null = null;
const CACHE_TTL_MS = 10_000;

export let nearConnect = connect;

export function setNearConnectForTest(fn: ((...args: any[]) => Promise<any>) | null): void {
  nearConnect = (fn as any) || connect;
}

export function clearCompareCache(): void {
  cachedResponse = null;
}

export function getCachedComparison(): CacheEntry | null {
  const now = Date.now();
  if (cachedResponse && now - cachedResponse.timestamp < CACHE_TTL_MS) {
    return cachedResponse;
  }
  return null;
}

export function setCachedComparison(payload: {
  steps: ComparisonStepResult[];
  budget: BudgetInfo | null;
}): void {
  cachedResponse = {
    timestamp: Date.now(),
    payload,
  };
}
