<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import type { AlignmentResult, DiffRegion } from '../types';

const props = defineProps<{
  result: AlignmentResult | null;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const minimapRef = ref<HTMLCanvasElement | null>(null);
const scrollContainer = ref<HTMLDivElement | null>(null);
const minimapViewportRef = ref<HTMLDivElement | null>(null);

const CELL_WIDTH = 12;
const CELL_HEIGHT = 22;
const PADDING = 10;
const RULER_HEIGHT = 20;
const MINIMAP_HEIGHT = 24;

const BASE_COLORS: Record<string, string> = {
  A: '#22c55e',
  T: '#ef4444',
  G: '#3b82f6',
  C: '#eab308',
  '-': '#4b5563'
};

const DIFF_REGION_COLORS: Record<string, string> = {
  mismatch: 'rgba(239, 68, 68, 0.25)',
  gap: 'rgba(251, 191, 36, 0.25)',
  mixed: 'rgba(244, 114, 182, 0.25)'
};

const currentDiffIndex = ref(-1);

const diffRegions = computed<DiffRegion[]>(() => props.result?.stats?.diffRegions || []);
const totalDiffs = computed(() => diffRegions.value.length);

function getSeqPosition(aligned: string, alignedIndex: number): number {
  let pos = 0;
  for (let i = 0; i < alignedIndex && i < aligned.length; i++) {
    if (aligned[i] !== '-') pos++;
  }
  return pos;
}

function drawRuler(ctx: CanvasRenderingContext2D, len: number, y: number) {
  ctx.fillStyle = '#6b7280';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';

  const step = len > 200 ? 50 : len > 100 ? 20 : 10;
  for (let i = 0; i <= len; i += step) {
    const x = PADDING + i * CELL_WIDTH;
    ctx.strokeStyle = '#374151';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    if (i < len) ctx.fillText(String(i + 1), x + CELL_WIDTH / 2, y + 14);
  }
}

function drawDiffRegions(ctx: CanvasRenderingContext2D, regions: DiffRegion[], yTop: number, yBottom: number) {
  for (const region of regions) {
    const x = PADDING + region.start * CELL_WIDTH;
    const w = (region.end - region.start + 1) * CELL_WIDTH;
    const color = DIFF_REGION_COLORS[region.type] || DIFF_REGION_COLORS.mixed;
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, yTop - 10, w + 1, yBottom - yTop + CELL_HEIGHT + 4);
    ctx.strokeStyle = region.type === 'mismatch' ? '#ef4444' : region.type === 'gap' ? '#f59e0b' : '#ec4899';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, yTop - 10, w + 1, yBottom - yTop + CELL_HEIGHT + 4);
  }
}

function drawCurrentDiffMarker(ctx: CanvasRenderingContext2D, region: DiffRegion, yTop: number, yBottom: number) {
  const x = PADDING + region.start * CELL_WIDTH;
  const w = (region.end - region.start + 1) * CELL_WIDTH;
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x - 2, yTop - 12, w + 3, yBottom - yTop + CELL_HEIGHT + 8);
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  const arrowY = yTop - 16;
  const centerX = x + w / 2;
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(centerX, arrowY - 4);
  ctx.lineTo(centerX - 5, arrowY + 4);
  ctx.lineTo(centerX + 5, arrowY + 4);
  ctx.closePath();
  ctx.fill();
}

function drawAlignment() {
  const canvas = canvasRef.value;
  if (!canvas || !props.result) return;

  const { aligned1, aligned2, stats } = props.result;
  const len = aligned1.length;
  const width = Math.max(len * CELL_WIDTH + PADDING * 2, 600);
  const y1 = RULER_HEIGHT + 30;
  const yMid = RULER_HEIGHT + 60;
  const y2 = RULER_HEIGHT + 75;
  const height = RULER_HEIGHT + 120;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  drawRuler(ctx, len, 5);

  if (stats?.diffRegions?.length) {
    drawDiffRegions(ctx, stats.diffRegions, y1, y2);
  }

  if (currentDiffIndex.value >= 0 && currentDiffIndex.value < diffRegions.value.length) {
    drawCurrentDiffMarker(ctx, diffRegions.value[currentDiffIndex.value], y1, y2);
  }

  ctx.font = '11px monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i < len; i++) {
    const x = PADDING + i * CELL_WIDTH;
    const base = aligned1[i];
    ctx.fillStyle = BASE_COLORS[base] || '#4b5563';
    ctx.fillRect(x, y1 - 8, CELL_WIDTH - 1, CELL_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(base, x + CELL_WIDTH / 2, y1 + 6);
  }

  ctx.font = '10px monospace';
  for (let i = 0; i < len; i++) {
    const x = PADDING + i * CELL_WIDTH;
    const c1 = aligned1[i];
    const c2 = aligned2[i];
    if (c1 === '-' || c2 === '-') {
      ctx.fillStyle = '#6b7280';
      ctx.fillText(' ', x + CELL_WIDTH / 2, yMid + 4);
    } else if (c1 === c2) {
      ctx.fillStyle = '#22c55e';
      ctx.fillText('|', x + CELL_WIDTH / 2, yMid + 4);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('X', x + CELL_WIDTH / 2, yMid + 4);
    }
  }

  ctx.font = '11px monospace';
  for (let i = 0; i < len; i++) {
    const x = PADDING + i * CELL_WIDTH;
    const base = aligned2[i];
    ctx.fillStyle = BASE_COLORS[base] || '#4b5563';
    ctx.fillRect(x, y2 - 8, CELL_WIDTH - 1, CELL_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(base, x + CELL_WIDTH / 2, y2 + 6);
  }
}

function drawMinimap() {
  const canvas = minimapRef.value;
  if (!canvas || !props.result) return;

  const { aligned1, aligned2, stats } = props.result;
  const len = aligned1.length;
  const container = scrollContainer.value;
  const containerWidth = container ? container.clientWidth : 600;
  const width = Math.max(containerWidth, 400);

  canvas.width = width;
  canvas.height = MINIMAP_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, width, MINIMAP_HEIGHT);

  if (len === 0) return;

  const scale = width / len;

  for (let i = 0; i < len; i++) {
    const x = i * scale;
    const w = Math.max(1, scale);
    const c1 = aligned1[i];
    const c2 = aligned2[i];

    if (c1 === '-' || c2 === '-') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x, 2, w, MINIMAP_HEIGHT - 4);
    } else if (c1 !== c2) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, 2, w, MINIMAP_HEIGHT - 4);
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fillRect(x, 10, w, MINIMAP_HEIGHT - 20);
    }
  }

  if (stats?.diffRegions?.length) {
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1;
    for (const region of stats.diffRegions) {
      const rx = region.start * scale;
      const rw = Math.max(1, (region.end - region.start + 1) * scale);
      ctx.strokeRect(rx, 1, rw, MINIMAP_HEIGHT - 2);
    }
  }
}

function updateMinimapViewport() {
  const container = scrollContainer.value;
  const viewport = minimapViewportRef.value;
  const canvas = minimapRef.value;
  if (!container || !viewport || !canvas || !props.result) return;

  const len = props.result.aligned1.length;
  const totalWidth = len * CELL_WIDTH + PADDING * 2;
  const viewWidth = container.clientWidth;
  const scrollLeft = container.scrollLeft;

  const vpScale = canvas.width / totalWidth;
  viewport.style.left = `${scrollLeft * vpScale}px`;
  viewport.style.width = `${Math.min(viewWidth * vpScale, canvas.width)}px`;
}

function scrollToPosition(pos: number) {
  const container = scrollContainer.value;
  if (!container) return;
  const targetX = Math.max(0, pos * CELL_WIDTH - container.clientWidth / 2 + PADDING);
  container.scrollTo({ left: targetX, behavior: 'smooth' });
}

function jumpToDiff(direction: 'prev' | 'next') {
  if (totalDiffs.value === 0) return;

  if (direction === 'next') {
    currentDiffIndex.value = (currentDiffIndex.value + 1) % totalDiffs.value;
  } else {
    currentDiffIndex.value = currentDiffIndex.value <= 0
      ? totalDiffs.value - 1
      : currentDiffIndex.value - 1;
  }

  const region = diffRegions.value[currentDiffIndex.value];
  const center = (region.start + region.end) / 2;
  scrollToPosition(center);
  nextTick(() => drawAlignment());
}

function jumpToFirstDiff() {
  if (totalDiffs.value === 0) return;
  currentDiffIndex.value = 0;
  const region = diffRegions.value[0];
  scrollToPosition((region.start + region.end) / 2);
  nextTick(() => drawAlignment());
}

function jumpToLastDiff() {
  if (totalDiffs.value === 0) return;
  currentDiffIndex.value = totalDiffs.value - 1;
  const region = diffRegions.value[totalDiffs.value - 1];
  scrollToPosition((region.start + region.end) / 2);
  nextTick(() => drawAlignment());
}

function handleMinimapClick(e: MouseEvent) {
  const canvas = minimapRef.value;
  if (!canvas || !props.result) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const pos = Math.floor(ratio * props.result.aligned1.length);
  scrollToPosition(pos);
}

function handleScroll() {
  updateMinimapViewport();
}

onMounted(() => {
  drawAlignment();
  nextTick(() => {
    drawMinimap();
    updateMinimapViewport();
  });
});

watch(() => props.result, () => {
  currentDiffIndex.value = -1;
  nextTick(() => {
    drawAlignment();
    drawMinimap();
    updateMinimapViewport();
  });
}, { deep: true });

watch(currentDiffIndex, () => {
  drawAlignment();
});
</script>

<template>
  <div class="bg-gray-900 rounded-lg overflow-hidden">
    <div v-if="result" class="space-y-2">
      <!-- Main Stats Row -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-gray-800 text-sm">
        <span class="text-gray-400">算法: <span class="text-cyan-400">{{ result.algorithm }}</span></span>
        <span class="text-gray-400">得分: <span class="text-yellow-400 font-bold">{{ result.score }}</span></span>
        <span class="text-gray-400">一致性: <span class="text-green-400 font-bold">{{ result.identity }}%</span></span>
        <span class="text-gray-400">总长度: <span class="text-blue-400">{{ result.stats?.totalLength || 0 }} bp</span></span>
      </div>

      <!-- Detailed Stats Row -->
      <div v-if="result.stats" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-gray-800/70 border-t border-gray-700/50 text-xs">
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-sm bg-green-500"></span>
          <span class="text-gray-400">匹配:</span>
          <span class="text-green-400 font-semibold">{{ result.stats.matches }}</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-sm bg-red-500"></span>
          <span class="text-gray-400">错配:</span>
          <span class="text-red-400 font-semibold">{{ result.stats.mismatches }}</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-sm bg-amber-500"></span>
          <span class="text-gray-400">缺口:</span>
          <span class="text-amber-400 font-semibold">{{ result.stats.gaps }}</span>
          <span class="text-gray-500">(打开 {{ result.stats.gapOpens }} 次)</span>
        </span>
        <span v-if="result.stats.mismatches > 0" class="flex items-center gap-1 ml-2">
          <span class="text-gray-400">转换(Ti):</span>
          <span class="text-orange-400 font-semibold">{{ result.stats.transitions }}</span>
          <span class="text-gray-400">颠换(Tv):</span>
          <span class="text-purple-400 font-semibold">{{ result.stats.transversions }}</span>
          <span class="text-gray-500">Ti/Tv: {{ result.stats.transversions > 0 ? (result.stats.transitions / result.stats.transversions).toFixed(2) : '∞' }}</span>
        </span>
        <span class="ml-auto flex items-center gap-1">
          <span class="text-gray-400">差异区段:</span>
          <span class="text-pink-400 font-bold">{{ result.stats.diffRegions.length }}</span>
        </span>
      </div>

      <!-- Diff Navigation -->
      <div v-if="result.stats && result.stats.diffRegions.length > 0" class="flex items-center gap-2 px-4 py-2 bg-gray-850 border-t border-gray-700/50" style="background-color: #1a2234;">
        <span class="text-xs text-gray-400 mr-1">快速导航:</span>
        <button
          @click="jumpToFirstDiff"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          title="首个差异"
        >⏮ 首个</button>
        <button
          @click="jumpToDiff('prev')"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          title="上一个差异"
        >◀ 上一处</button>
        <span class="text-xs text-pink-400 font-mono min-w-[60px] text-center">
          {{ currentDiffIndex >= 0 ? currentDiffIndex + 1 : 0 }} / {{ totalDiffs }}
        </span>
        <button
          @click="jumpToDiff('next')"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          title="下一个差异"
        >下一处 ▶</button>
        <button
          @click="jumpToLastDiff"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          title="末尾差异"
        >末尾 ⏭</button>

        <div v-if="currentDiffIndex >= 0 && diffRegions[currentDiffIndex]" class="ml-auto flex items-center gap-3 text-xs">
          <span class="text-gray-400">
            位置: <span class="text-cyan-400 font-mono">{{ diffRegions[currentDiffIndex].start + 1 }}-{{ diffRegions[currentDiffIndex].end + 1 }}</span>
          </span>
          <span class="text-gray-400">
            长度: <span class="text-cyan-400 font-mono">{{ diffRegions[currentDiffIndex].length }} bp</span>
          </span>
          <span
            class="px-2 py-0.5 rounded font-semibold"
            :class="{
              'bg-red-900/50 text-red-300': diffRegions[currentDiffIndex].type === 'mismatch',
              'bg-amber-900/50 text-amber-300': diffRegions[currentDiffIndex].type === 'gap',
              'bg-pink-900/50 text-pink-300': diffRegions[currentDiffIndex].type === 'mixed'
            }"
          >
            {{ diffRegions[currentDiffIndex].type === 'mismatch' ? '错配' : diffRegions[currentDiffIndex].type === 'gap' ? '缺口' : '混合' }}
          </span>
        </div>
      </div>

      <!-- Minimap -->
      <div class="px-4 pt-2">
        <div class="relative rounded-md overflow-hidden border border-gray-700" style="background-color: #1f2937;">
          <canvas
            ref="minimapRef"
            class="block w-full cursor-crosshair"
            :style="{ height: MINIMAP_HEIGHT + 'px' }"
            @click="handleMinimapClick"
          ></canvas>
          <div
            ref="minimapViewportRef"
            class="absolute top-0 border-2 border-cyan-400 bg-cyan-400/10 pointer-events-none rounded-sm"
            :style="{ height: MINIMAP_HEIGHT + 'px', left: '0px', width: '100px' }"
          ></div>
        </div>
        <div class="flex justify-between mt-1 text-[10px] text-gray-500 font-mono px-1">
          <span>1</span>
          <span>{{ result.stats?.totalLength ? Math.floor(result.stats.totalLength / 4) + 1 : '' }}</span>
          <span>{{ result.stats?.totalLength ? Math.floor(result.stats.totalLength / 2) + 1 : '' }}</span>
          <span>{{ result.stats?.totalLength ? Math.floor(result.stats.totalLength * 3 / 4) + 1 : '' }}</span>
          <span>{{ result.stats?.totalLength || 0 }}</span>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 text-xs text-gray-500">
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:#22c55e"></span> A</span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:#ef4444"></span> T</span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:#3b82f6"></span> G</span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:#eab308"></span> C</span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:#4b5563"></span> Gap</span>
        <span class="mx-1 h-3 w-px bg-gray-700"></span>
        <span class="flex items-center gap-1 text-green-500">| 匹配</span>
        <span class="flex items-center gap-1 text-red-500">X 错配</span>
        <span class="mx-1 h-3 w-px bg-gray-700"></span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm border border-red-500 bg-red-500/20"></span><span class="text-red-400">错配区</span></span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm border border-amber-500 bg-amber-500/20"></span><span class="text-amber-400">缺口区</span></span>
        <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-sm border border-pink-500 bg-pink-500/20"></span><span class="text-pink-400">混合区</span></span>
      </div>

      <!-- Canvas -->
      <div
        ref="scrollContainer"
        class="overflow-x-auto px-4 pb-3"
        @scroll="handleScroll"
      >
        <canvas ref="canvasRef" class="block"></canvas>
      </div>
    </div>

    <div v-else class="flex items-center justify-center py-12 text-gray-600 text-sm">
      请选择两个序列并运行比对以查看结果
    </div>
  </div>
</template>
