import type { Message } from '../i18n/catalog';
export type Stage = 'validate' | 'analyze' | 'extract' | 'ocr' | 'reconstruct' | 'package' | 'check';
export interface Progress { stage: Stage; detail: Message; current?: number; total?: number }
export interface Options { title: string; author: string; language: string; ocrLanguage: 'spa' | 'eng' | 'spa+eng'; ocr: boolean }
export interface Box { x: number; y: number; w: number; h: number }
export interface Run extends Box { id: number; text: string; size: number; bold: boolean; dir: string; href?: string }
export interface Warning { page?: number; code: string; message: Message }
export interface Raster { width: number; height: number; pixels: Uint8ClampedArray }
export interface PageInput { number: number; width: number; height: number; runs: Run[]; ocr: boolean; raster: Raster }
export interface Block { kind: 'paragraph' | 'heading' | 'list' | 'note' | 'table' | 'image'; box: Box; runs: Run[]; rows?: Run[][][]; imageId?: string; label?: Message; caption?: Run[] }
export interface SemanticPage { number: number; blocks: Block[]; warnings: Warning[]; sourceRuns: number; representedRuns: number; ocr: boolean; sourceChars: number }
export interface Asset { id: string; bytes: Uint8Array }
export interface Metadata { title: string; author: string; language: string; outline: { title: string; page: number }[] }
export interface Coverage { page: number; sourceRuns: number; representedRuns: number; sourceChars: number; textChars: number; imageRegions: number; ocr: boolean }
export interface Report { pages: number; textPages: number; ocrPages: number; warnings: Warning[]; coverage: Coverage[]; checks: Message[] }
export interface Result { bytes: Uint8Array; cover: Blob; title: string; report: Report }
// Pages are rendered and released one at a time; memory is bounded by fileBytes, assetsBytes and textChars,
// not by the page count. jobMs is the total time budget, pageMs the budget for a single page.
export const LIMITS = Object.freeze({ fileBytes: 32 * 1024 * 1024, pages: 600, pixels: 6_000_000, assetsBytes: 64 * 1024 * 1024, runsPerPage: 24_000, textChars: 4_000_000, jobMs: 60 * 60_000, pageMs: 45_000 });
