import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../../src/core/services/storage.js';

// StorageService는 파일 I/O에 의존하므로 기능 레벨 테스트
describe('StorageService', () => {
  const mockConfig = {
    getBaseDir: vi.fn().mockReturnValue('/tmp/test-api-convert'),
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue({}),
  } as any;

  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService(mockConfig);
  });

  it('인스턴스 생성', () => {
    expect(storage).toBeDefined();
    expect(storage).toBeInstanceOf(StorageService);
  });

  it('ensureDirectoryStructure 메서드 존재', () => {
    expect(typeof storage.ensureDirectoryStructure).toBe('function');
  });

  it('saveProfile / loadProfile 메서드 존재', () => {
    expect(typeof storage.saveProfile).toBe('function');
    expect(typeof storage.loadProfile).toBe('function');
  });

  it('saveMapping / loadMappingById 메서드 존재', () => {
    expect(typeof storage.saveMapping).toBe('function');
    expect(typeof storage.loadMappingById).toBe('function');
  });

  it('saveHistory / loadHistory 메서드 존재', () => {
    expect(typeof storage.saveHistory).toBe('function');
    expect(typeof storage.loadHistory).toBe('function');
  });

  it('listProfiles / listMappings / listTargets 메서드 존재', () => {
    expect(typeof storage.listProfiles).toBe('function');
    expect(typeof storage.listMappings).toBe('function');
    expect(typeof storage.listTargets).toBe('function');
  });
});
