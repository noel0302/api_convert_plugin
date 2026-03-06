/** History & Change Tracking */

import type { MappingRule } from './mapping.js';

export interface MappingHistory {
  mappingId: string;
  versions: HistoryEntry[];
}

export interface HistoryEntry {
  version: number;
  timestamp: string;
  source: ChangeSource;
  changes: FieldChange[];
  relatedVersions?: number[];
  snapshot: MappingRule;
}

export interface FieldChange {
  type: 'add' | 'modify' | 'remove';
  field: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export type ChangeSource =
  | 'conversation'
  | 'visual_editor'
  | 'json_direct'
  | 'code_sync'
  | 'cascade'
  | 'auto_regenerate';

export interface VersionDiff {
  version1: number;
  version2: number;
  changes: FieldChange[];
}
