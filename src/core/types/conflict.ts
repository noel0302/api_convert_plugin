/** Conflict Resolution - N:1 매핑 충돌 해소 */

export type ConflictStrategy = 'priority' | 'latest' | 'custom' | 'ask_user' | 'highest_confidence' | 'first_match' | 'merge' | 'user_choice';

export interface ConflictResolution {
  targetField: string;
  strategy: ConflictStrategy;
  resolvedSource: string;
  confidence: number;
  sources?: {
    apiProfileId: string;
    sourceField: string;
    priority: number;
  }[];
  customLogic?: string;
}

/** Visual Editor round-trip types */
export interface EditorModification {
  targetField: string;
  action: 'add' | 'modify' | 'remove';
  before?: {
    sourceField: string | string[] | null;
    transformation: string;
  };
  after?: {
    sourceField: string | string[] | null;
    transformation: string;
    config?: Record<string, unknown>;
  };
}

export interface EditorExport {
  mappingId: string;
  mappingVersion?: number;
  modifications: EditorModification[];
  exportedAt: string;
  editorVersion: string;
}
