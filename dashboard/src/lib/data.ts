import type { OrgScanResults } from "./types";
import sampleData from "../../public/sample-data.json";

/**
 * Load scan data from the configured source
 * In development, uses sample data from public folder
 * In production, could fetch from URL or API
 */
export function loadScanData(): OrgScanResults {
  // For now, use sample data directly
  // In production, this could fetch from a URL
  return sampleData as OrgScanResults;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Calculate percentage with one decimal place
 */
export function calculatePercentage(value: number, total: number): string {
  if (total === 0) return "0";
  return ((value / total) * 100).toFixed(1);
}
