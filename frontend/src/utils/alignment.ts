import type { AlignmentResult, GCContent, PhyloNode, AlignmentStats, DiffRegion, DiffType } from '../types';

/**
 * Needleman-Wunsch global alignment algorithm
 */
export function needlemanWunsch(
  seq1: string,
  seq2: string,
  match = 1,
  mismatch = -1,
  gap = -2
): AlignmentResult {
  const n = seq1.length;
  const m = seq2.length;

  // Initialize scoring matrix
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) score[i][0] = i * gap;
  for (let j = 0; j <= m; j++) score[0][j] = j * gap;

  // Fill scoring matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch);
      const deleteScore = score[i - 1][j] + gap;
      const insertScore = score[i][j - 1] + gap;
      score[i][j] = Math.max(matchScore, deleteScore, insertScore);
    }
  }

  // Traceback from bottom-right
  let aligned1 = '';
  let aligned2 = '';
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && score[i][j] === score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch)) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      i--;
      j--;
    } else if (i > 0 && score[i][j] === score[i - 1][j] + gap) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = '-' + aligned2;
      i--;
    } else {
      aligned1 = '-' + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      j--;
    }
  }

  const finalScore = score[n][m];
  const matches = countMatches(aligned1, aligned2);
  const gaps = countGaps(aligned1, aligned2);
  const identity = aligned1.length > 0 ? (matches / aligned1.length) * 100 : 0;
  const stats = computeAlignmentStats(aligned1, aligned2);

  return {
    seq1,
    seq2,
    aligned1,
    aligned2,
    score: finalScore,
    identity: Math.round(identity * 100) / 100,
    gaps,
    algorithm: 'Needleman-Wunsch (全局比对)',
    stats
  };
}

/**
 * Smith-Waterman local alignment algorithm
 */
export function smithWaterman(
  seq1: string,
  seq2: string,
  match = 2,
  mismatch = -1,
  gap = -2
): AlignmentResult {
  const n = seq1.length;
  const m = seq2.length;

  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  // Fill scoring matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch);
      const deleteScore = score[i - 1][j] + gap;
      const insertScore = score[i][j - 1] + gap;
      score[i][j] = Math.max(0, matchScore, deleteScore, insertScore);

      if (score[i][j] > maxScore) {
        maxScore = score[i][j];
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback from max score cell, stop at 0
  let aligned1 = '';
  let aligned2 = '';
  let i = maxI;
  let j = maxJ;

  while (i > 0 && j > 0 && score[i][j] > 0) {
    if (score[i][j] === score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch)) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      i--;
      j--;
    } else if (score[i][j] === score[i - 1][j] + gap) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = '-' + aligned2;
      i--;
    } else {
      aligned1 = '-' + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      j--;
    }
  }

  const matches = countMatches(aligned1, aligned2);
  const gaps = countGaps(aligned1, aligned2);
  const identity = aligned1.length > 0 ? (matches / aligned1.length) * 100 : 0;
  const stats = computeAlignmentStats(aligned1, aligned2);

  return {
    seq1,
    seq2,
    aligned1,
    aligned2,
    score: maxScore,
    identity: Math.round(identity * 100) / 100,
    gaps,
    algorithm: 'Smith-Waterman (局部比对)',
    stats
  };
}

/**
 * Calculate GC content using sliding window
 */
export function calculateGCContent(seq: string, windowSize = 50): GCContent[] {
  const results: GCContent[] = [];
  const upperSeq = seq.toUpperCase();

  for (let i = 0; i <= upperSeq.length - windowSize; i++) {
    const window = upperSeq.substring(i, i + windowSize);
    let gcCount = 0;
    for (const base of window) {
      if (base === 'G' || base === 'C') gcCount++;
    }
    results.push({
      window: windowSize,
      position: i + Math.floor(windowSize / 2),
      gc: Math.round((gcCount / windowSize) * 10000) / 100
    });
  }

  return results;
}

/**
 * Calculate pairwise distance matrix from sequences
 */
export function calculateDistanceMatrix(sequences: { name: string; data: string }[]): number[][] {
  const n = sequences.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const result = needlemanWunsch(sequences[i].data, sequences[j].data);
      // Distance = 1 - (identity / 100)
      const distance = 1 - result.identity / 100;
      matrix[i][j] = distance;
      matrix[j][i] = distance;
    }
  }

  return matrix;
}

/**
 * Simple Neighbor-Joining algorithm to build a phylogenetic tree
 */
export function buildNJTree(distMatrix: number[][], names: string[]): PhyloNode {
  const n = names.length;

  if (n === 0) {
    return { name: 'empty', branchLength: 0, children: [] };
  }
  if (n === 1) {
    return { name: names[0], branchLength: 0, children: [] };
  }
  if (n === 2) {
    const halfDist = distMatrix[0][1] / 2;
    return {
      name: 'root',
      branchLength: 0,
      children: [
        { name: names[0], branchLength: halfDist, children: [] },
        { name: names[1], branchLength: halfDist, children: [] }
      ]
    };
  }

  // Work with mutable copies
  let dist: number[][] = distMatrix.map(row => [...row]);
  let nodes: PhyloNode[] = names.map(name => ({ name, branchLength: 0, children: [] }));
  let active = Array.from({ length: n }, (_, i) => i);

  while (active.length > 2) {
    const size = active.length;

    // Calculate Q matrix
    let minQ = Infinity;
    let minI = 0;
    let minJ = 1;

    // Row sums for active indices
    const rowSum: number[] = new Array(size).fill(0);
    for (let ai = 0; ai < size; ai++) {
      for (let aj = 0; aj < size; aj++) {
        if (ai !== aj) {
          rowSum[ai] += dist[active[ai]][active[aj]];
        }
      }
    }

    for (let ai = 0; ai < size; ai++) {
      for (let aj = ai + 1; aj < size; aj++) {
        const q = (size - 2) * dist[active[ai]][active[aj]] - rowSum[ai] - rowSum[aj];
        if (q < minQ) {
          minQ = q;
          minI = ai;
          minJ = aj;
        }
      }
    }

    const idxI = active[minI];
    const idxJ = active[minJ];

    // Calculate branch lengths
    const dIJ = dist[idxI][idxJ];
    const branchI = dIJ / 2 + (rowSum[minI] - rowSum[minJ]) / (2 * (size - 2));
    const branchJ = dIJ - branchI;

    // Create new node
    const newNode: PhyloNode = {
      name: `(${nodes[idxI].name},${nodes[idxJ].name})`,
      branchLength: 0,
      children: [
        { ...nodes[idxI], branchLength: Math.max(0, branchI) },
        { ...nodes[idxJ], branchLength: Math.max(0, branchJ) }
      ]
    };

    // Update distance matrix (add new row/column)
    const newIdx = dist.length;
    const newRow: number[] = new Array(newIdx + 1).fill(0);
    for (let k = 0; k < newIdx; k++) {
      if (k !== idxI && k !== idxJ) {
        const dNew = (dist[idxI][k] + dist[idxJ][k] - dIJ) / 2;
        newRow[k] = dNew;
      }
    }

    // Expand matrix
    for (let r = 0; r < dist.length; r++) {
      dist[r].push(newRow[r] || 0);
    }
    dist.push(newRow);

    nodes.push(newNode);

    // Update active list
    active = active.filter(a => a !== idxI && a !== idxJ);
    active.push(newIdx);
  }

  // Join last two nodes
  if (active.length === 2) {
    const lastDist = dist[active[0]][active[1]] / 2;
    return {
      name: 'root',
      branchLength: 0,
      children: [
        { ...nodes[active[0]], branchLength: lastDist },
        { ...nodes[active[1]], branchLength: lastDist }
      ]
    };
  }

  return nodes[active[0]];
}

// Helper functions
function countMatches(a1: string, a2: string): number {
  let count = 0;
  for (let i = 0; i < Math.min(a1.length, a2.length); i++) {
    if (a1[i] === a2[i] && a1[i] !== '-') count++;
  }
  return count;
}

function countGaps(a1: string, a2: string): number {
  let count = 0;
  for (let i = 0; i < Math.max(a1.length, a2.length); i++) {
    const c1 = i < a1.length ? a1[i] : '-';
    const c2 = i < a2.length ? a2[i] : '-';
    if (c1 === '-' || c2 === '-') count++;
  }
  return count;
}

function isTransition(c1: string, c2: string): boolean {
  const purines = ['A', 'G'];
  const pyrimidines = ['C', 'T'];
  return (purines.includes(c1) && purines.includes(c2)) ||
         (pyrimidines.includes(c1) && pyrimidines.includes(c2));
}

function getDiffType(a1: string, a2: string, i: number): DiffType {
  const c1 = i < a1.length ? a1[i] : '-';
  const c2 = i < a2.length ? a2[i] : '-';
  if (c1 === c2) return 'match';
  if (c1 === '-') return 'gap1';
  if (c2 === '-') return 'gap2';
  return 'mismatch';
}

export function computeAlignmentStats(a1: string, a2: string): AlignmentStats {
  const len = Math.max(a1.length, a2.length);
  let matches = 0;
  let mismatches = 0;
  let gaps = 0;
  let gapOpens = 0;
  let transitions = 0;
  let transversions = 0;
  const perBaseDiff: boolean[] = new Array(len).fill(false);
  let prevWasGap = false;

  for (let i = 0; i < len; i++) {
    const c1 = i < a1.length ? a1[i] : '-';
    const c2 = i < a2.length ? a2[i] : '-';
    const dt = getDiffType(a1, a2, i);

    if (dt === 'match') {
      matches++;
      prevWasGap = false;
    } else if (dt === 'mismatch') {
      mismatches++;
      perBaseDiff[i] = true;
      if (isTransition(c1, c2)) transitions++;
      else transversions++;
      prevWasGap = false;
    } else {
      gaps++;
      perBaseDiff[i] = true;
      if (!prevWasGap) gapOpens++;
      prevWasGap = true;
    }
  }

  const diffRegions: DiffRegion[] = [];
  let i = 0;
  while (i < len) {
    if (perBaseDiff[i]) {
      const start = i;
      let hasGap = false;
      let hasMismatch = false;
      while (i < len && perBaseDiff[i]) {
        const dt = getDiffType(a1, a2, i);
        if (dt === 'gap1' || dt === 'gap2') hasGap = true;
        else if (dt === 'mismatch') hasMismatch = true;
        i++;
      }
      const end = i - 1;
      let type: 'mismatch' | 'gap' | 'mixed' = 'mixed';
      if (hasGap && !hasMismatch) type = 'gap';
      else if (!hasGap && hasMismatch) type = 'mismatch';
      diffRegions.push({ start, end, type, length: end - start + 1 });
    } else {
      i++;
    }
  }

  return {
    totalLength: len,
    matches,
    mismatches,
    gaps,
    gapOpens,
    transitions,
    transversions,
    diffRegions,
    perBaseDiff
  };
}

/**
 * Mock DNA sequences - COI gene fragments (~100bp each)
 * Realistic ACGT with ~2-15% differences between them
 */
export const MOCK_SEQUENCES = [
  {
    id: 'human',
    name: 'Human (Homo sapiens)',
    data: 'ATGCTTTCGACTATTTCGACATCTATTTTACTGGTCATCTTAGGAATCTGGGCAATGATCCAAAGATATCTTCAATTCGCCTTCTACTATGAACATACCATCAATAATTTTTTAATTTCAATTATACCTTTACCACTTGAAACATTAATCGATCGAAAAATTTTAACTCAATTAAGATTTTTTCCATCAACGGCTATTTCAATAGTAGATCAACTCATTTTTATCAATAATATTATCAATTTTAGTGTAA'
  },
  {
    id: 'chimp',
    name: 'Chimp (Pan troglodytes)',
    data: 'ATGCTTTCGACTATTTCGACATCTATTTTACTGGTCATCTTAGGAATCTGGGCAATGATCCAAAGATATCTTCAATTCGCCTTCTACTATGAACATACCATCAATAATTTTTTAATTTCAATTATACCTTTACCACTTGAAACATTAATCGATCGAAAAATTTTAACTCAATTAAGATTTTTTCCATCAACGGCTATTTCAATAGTAGATCAACTCATTTTTATCAATAATATTATCAATTTTAGTGTAA'
  },
  {
    id: 'gorilla',
    name: 'Gorilla (Gorilla gorilla)',
    data: 'ATGCTTTCGACTATCTCGACATCTATTTTACTGGTCATCTTAGGAATCTGGGCAATGATCCAAAGATATCTTCAATTCGCCTTCTACTATGAACATACCATCAATAATTTTCTAATTTCAATTATACCTTTACCACTTGAAACATTAATCGATCGAAAAATTTTAACTCAATTAAGATTTTTTCCATCAACGGCTATTTCAATAGTAGATCAACTCATTTTCATCAATAATATTATCAATTTTAGTGCAA'
  },
  {
    id: 'mouse',
    name: 'Mouse (Mus musculus)',
    data: 'ATGCTTTCGACTATCTCGACATCTATTTCACTAGTCATCTTAGGAATCTGGGCAATAATCCAAAGATATCTTCAATTCGCCTTCTACTCTGAACATACCATCAATAACTTTCTAATTTCAATTATACCTTTACCACTTGAAACATTAATCAATCGAAAAATTTTAACTCAATTAAGATTTTTTCCATCAACGGCAATTTCAATAGTAGATCAACTCATTTTCATCAATAATATCATCAATTTTAGTGCAA'
  },
  {
    id: 'zebrafish',
    name: 'Zebrafish (Danio rerio)',
    data: 'ATGATTTCGACTATCTCAACATCTATCTTACTAGTCATCTTAGGAATTTGGGCAATGATCCAAAGATACCTTCAATTCGCCTTCTACTCTGAACATACCATCAATAACTTTCTGATTTCAATTATGCCTTTACCATTGGAAACATTAATCAATCGAAAAATTTTAACTCAATTAAGGTTTTTTCCATCAACAGCAATTTCAATAGTAGATCAACTCATTTTCATCAACAATATCATCAATTTTAGTACAA'
  }
];
