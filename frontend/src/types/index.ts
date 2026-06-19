export interface Sequence {
  id: string;
  name: string;
  data: string;  // ACGT nucleotides
  length: number;
}

export type DiffType = 'match' | 'mismatch' | 'gap1' | 'gap2';

export interface DiffRegion {
  start: number;
  end: number;
  type: 'mismatch' | 'gap' | 'mixed';
  length: number;
}

export interface AlignmentStats {
  totalLength: number;
  matches: number;
  mismatches: number;
  gaps: number;
  gapOpens: number;
  transitions: number;
  transversions: number;
  diffRegions: DiffRegion[];
  perBaseDiff: boolean[];
}

export interface AlignmentResult {
  seq1: string;
  seq2: string;
  aligned1: string;  // with gaps '-'
  aligned2: string;
  score: number;
  identity: number;  // percentage
  gaps: number;
  algorithm: string;
  stats?: AlignmentStats;
}

export interface PhyloNode {
  name: string;
  branchLength: number;
  children: PhyloNode[];
  x?: number;
  y?: number;
}

export interface GCContent {
  window: number;
  position: number;
  gc: number;
}
