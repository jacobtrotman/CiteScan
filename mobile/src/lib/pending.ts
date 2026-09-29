// Hands the stage-1 results (sentences found) from the home screen to the review screen.
// Kept in memory only: if the user leaves without finding sources, nothing is saved or charged.
import type { CheckMode } from './purchases';
import type { DraftClaim } from './types';

export interface PendingCheck {
  title: string;
  claims: DraftClaim[];
  fileName: string;
  sourceKind: 'scan' | 'file';
  /** How this check is paid for (decided before stage 1). */
  mode: Exclude<CheckMode, 'none'>;
}

let pending: PendingCheck | null = null;

export function setPendingCheck(check: PendingCheck) {
  pending = check;
}

export function getPendingCheck() {
  return pending;
}

export function clearPendingCheck() {
  pending = null;
}
