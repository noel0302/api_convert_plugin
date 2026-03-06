import { describe, it, expect, vi } from 'vitest';
import { ReferenceScanner } from '../../src/reference/index.js';

const mockConfig = { get: vi.fn() } as any;
const mockLog = { info: vi.fn(), warn: vi.fn() } as any;

describe('ReferenceScanner', () => {
  const scanner = new ReferenceScanner(mockConfig, mockLog);

  it('scanForDtos: 배열 반환', async () => {
    const result = await scanner.scanForDtos('typescript');
    expect(Array.isArray(result)).toBe(true);
    // 프로젝트에 TS 파일이 있으므로 DTO가 감지될 수 있음
  });

  it('scanForMappers: 배열 반환', async () => {
    const result = await scanner.scanForMappers('java');
    expect(Array.isArray(result)).toBe(true);
  });

  it('detectProjectPattern: TypeScript → function', async () => {
    const result = await scanner.detectProjectPattern('typescript');
    expect(result.style).toBe('function');
    expect(result.naming).toBe('camelCase');
  });

  it('detectProjectPattern: Java → class (default)', async () => {
    const result = await scanner.detectProjectPattern('java');
    expect(result.style).toBe('class');
  });

  it('detectProjectPattern: Python → snake_case (default)', async () => {
    const result = await scanner.detectProjectPattern('python');
    expect(result.naming).toBe('snake_case');
  });

  it('inferPurpose: purpose 반환', async () => {
    const result = await scanner.inferPurpose();
    expect(typeof result.purpose).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it('getDtoPatterns: 각 언어별 패턴에 directoryPatterns 포함', () => {
    const tsPatterns = scanner.getDtoPatterns('typescript');
    expect(tsPatterns.filePatterns).toContain('**/*Dto.ts');
    expect(tsPatterns.directoryPatterns.length).toBeGreaterThan(0);

    const phpPatterns = scanner.getDtoPatterns('php');
    expect(phpPatterns.filePatterns).toContain('**/*Dto.php');
    expect(phpPatterns.codePatterns.length).toBeGreaterThan(0);

    const goPatterns = scanner.getDtoPatterns('go');
    expect(goPatterns.filePatterns).toContain('**/*_model.go');
    expect(goPatterns.directoryPatterns.length).toBeGreaterThan(0);
  });

  it('scanForDtos: DetectedDto 구조 검증', async () => {
    const result = await scanner.scanForDtos('typescript');
    for (const dto of result) {
      expect(dto).toHaveProperty('filePath');
      expect(dto).toHaveProperty('className');
      expect(dto).toHaveProperty('language', 'typescript');
      expect(dto).toHaveProperty('fields');
      expect(dto).toHaveProperty('confidence');
      expect(dto.confidence).toBeGreaterThan(0);
    }
  });
});
