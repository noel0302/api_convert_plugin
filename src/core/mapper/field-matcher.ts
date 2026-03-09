/**
 * 필드명 유사도를 다차원으로 계산하여 최적 매핑 후보를 결정.
 */

export interface MatchScore {
  nameScore: number;
  typeScore: number;
  positionScore: number;
  patternScore: number;
  descriptionBoost: number;
  totalScore: number;
}

export interface MatchCandidate {
  sourceField: string;
  targetField: string;
  score: MatchScore;
}

const ABBREVIATION_MAP: Record<string, string[]> = {
  nm: ['name'],
  addr: ['address'],
  tel: ['telephone', 'phone'],
  amt: ['amount'],
  dt: ['date', 'datetime'],
  cd: ['code'],
  no: ['number'],
  qty: ['quantity'],
  desc: ['description'],
  idx: ['index'],
  img: ['image'],
  pwd: ['password'],
  msg: ['message'],
  btn: ['button'],
  cnt: ['count'],
  st: ['status', 'state'],
  prc: ['price'],
  ctg: ['category'],
  usr: ['user'],
  cust: ['customer'],
  prdt: ['product'],
  ordr: ['order'],
  pymt: ['payment'],
  rsp: ['response'],
  req: ['request'],
  reg: ['register', 'registration'],
  upd: ['update', 'updated'],
  crt: ['create', 'created'],
  del: ['delete', 'deleted'],
};

// 의미적 동의어
const SYNONYM_MAP: Record<string, string[]> = {
  phone: ['tel', 'telephone', 'mobile', 'contact'],
  address: ['addr', 'location'],
  name: ['nm', 'title', 'label'],
  amount: ['amt', 'price', 'total', 'sum'],
  date: ['dt', 'datetime', 'timestamp', 'time'],
  code: ['cd', 'id', 'key'],
  status: ['st', 'state', 'phase'],
  description: ['desc', 'detail', 'comment', 'note'],
  email: ['mail', 'email_addr'],
  created: ['crt', 'created_at', 'createdAt', 'reg_dt'],
  updated: ['upd', 'updated_at', 'updatedAt', 'mod_dt'],
  deleted: ['del', 'deleted_at', 'deletedAt', 'removed'],
  // 차량/렌탈 도메인
  seats: ['passenger', 'passenger_quantity', 'seating', 'pax'],
  doors: ['door_count', 'door_quantity', 'doorcount'],
  model: ['veh_make_model', 'vehicle_model', 'car_model', 'make_model'],
  transmission: ['trans', 'gear', 'gearbox'],
  air_condition: ['ac', 'aircon', 'air_conditioning', 'climate'],
  // 공통 API 필드
  image: ['img', 'photo', 'picture', 'thumbnail', 'pic'],
  count: ['cnt', 'quantity', 'qty'],
  active: ['enabled', 'is_active', 'available'],
};

/**
 * 두 필드명의 유사도 점수를 계산 (0-1)
 */
export function calculateNameScore(source: string, target: string): number {
  const s = normalizeFieldName(source);
  const t = normalizeFieldName(target);

  // 1. 정확히 일치
  if (s === t) return 1.0;

  // 2. 네이밍 컨벤션 변환 후 일치
  const sNorm = toSnakeCase(s).toLowerCase();
  const tNorm = toSnakeCase(t).toLowerCase();
  if (sNorm === tNorm) return 0.95;

  // 3. 약어 확장 후 일치
  if (matchWithAbbreviations(sNorm, tNorm)) return 0.85;

  // 4. 의미적 동의어
  if (matchWithSynonyms(sNorm, tNorm)) return 0.6;

  // 5. 편집 거리 기반
  const editDist = levenshteinDistance(sNorm, tNorm);
  const maxLen = Math.max(sNorm.length, tNorm.length);
  if (maxLen === 0) return 0;

  const normalizedDist = 1 - editDist / maxLen;
  if (editDist <= 1 && maxLen >= 4) return Math.max(normalizedDist, 0.7);

  // 6. 부분 문자열 포함
  if (sNorm.includes(tNorm) || tNorm.includes(sNorm)) {
    const shorter = Math.min(sNorm.length, tNorm.length);
    const longer = Math.max(sNorm.length, tNorm.length);
    return 0.5 * (shorter / longer);
  }

  return normalizedDist > 0.5 ? normalizedDist * 0.5 : 0;
}

/**
 * 두 타입 간 호환성 점수 (0-1)
 */
export function calculateTypeScore(sourceType: string, targetType: string): number {
  if (sourceType === targetType) return 1.0;

  // string ↔ number 변환 가능
  if ((sourceType === 'string' && targetType === 'number') ||
      (sourceType === 'number' && targetType === 'string')) return 0.7;

  // string ↔ boolean (XML/API에서 "true"/"false", "Y"/"N" 등 빈번)
  if ((sourceType === 'string' && targetType === 'boolean') ||
      (sourceType === 'boolean' && targetType === 'string')) return 0.7;

  // number ↔ boolean (0/1 → true/false)
  if ((sourceType === 'number' && targetType === 'boolean') ||
      (sourceType === 'boolean' && targetType === 'number')) return 0.6;

  // object ↔ object (구조가 다를 수 있음)
  if (sourceType === 'object' && targetType === 'object') return 0.8;

  // array ↔ array
  if (sourceType === 'array' && targetType === 'array') return 0.8;

  return 0.1;
}

export interface DescriptionContext {
  targetDescription?: string;
  targetMeaning?: string;
}

export interface MatchContext {
  sourceIndex?: number;
  sourceTotal?: number;
  targetIndex?: number;
  targetTotal?: number;
  existingMappings?: Array<{ sourceField: string; targetField: string }>;
}

/**
 * 종합 매칭 점수 계산
 */
export function calculateMatchScore(
  sourceName: string,
  targetName: string,
  sourceType: string,
  targetType: string,
  context?: MatchContext,
  descriptionCtx?: DescriptionContext,
): MatchScore {
  const rawNameScore = calculateNameScore(sourceName, targetName);
  const typeScore = calculateTypeScore(sourceType, targetType);
  const positionScore = calculatePositionScore(context);
  const patternScore = calculatePatternScore(sourceName, targetName, context);

  // 부모 경로 컨텍스트 부스트
  const pathBoost = calculatePathContextBoost(sourceName, targetName);
  // target description 키워드 부스트
  const descriptionBoost = calculateDescriptionBoost(
    sourceName,
    descriptionCtx?.targetDescription,
    descriptionCtx?.targetMeaning,
  );

  const nameScore = Math.min(1.0, rawNameScore + pathBoost + descriptionBoost);
  const totalScore = nameScore * 0.6 + typeScore * 0.3 + positionScore * 0.05 + patternScore * 0.05;

  return { nameScore, typeScore, positionScore, patternScore, descriptionBoost, totalScore };
}

/**
 * 구조적 위치 유사성 계산 (0-1)
 * 소스/타겟에서 필드의 상대적 위치가 비슷할수록 높은 점수
 */
function calculatePositionScore(context?: MatchContext): number {
  if (context?.sourceIndex === undefined || context?.sourceTotal === undefined ||
      context?.targetIndex === undefined || context?.targetTotal === undefined) {
    return 0.5;
  }
  if (context.sourceTotal <= 1 || context.targetTotal <= 1) return 0.5;

  const sourceRelative = context.sourceIndex / (context.sourceTotal - 1);
  const targetRelative = context.targetIndex / (context.targetTotal - 1);
  return 1.0 - Math.abs(sourceRelative - targetRelative);
}

/**
 * 기존 매핑 패턴 일관성 점수 (0-1)
 * 기존 매핑들의 이름 변환 패턴과 일관성이 있으면 높은 점수
 */
function calculatePatternScore(
  sourceName: string,
  targetName: string,
  context?: MatchContext,
): number {
  if (!context?.existingMappings?.length) return 0.5;

  const sNorm = toSnakeCase(normalizeFieldName(sourceName)).toLowerCase();
  const tNorm = toSnakeCase(normalizeFieldName(targetName)).toLowerCase();
  const isDirectMapping = sNorm === tNorm;

  let consistentCount = 0;
  for (const mapping of context.existingMappings) {
    const es = toSnakeCase(normalizeFieldName(mapping.sourceField)).toLowerCase();
    const et = toSnakeCase(normalizeFieldName(mapping.targetField)).toLowerCase();
    const existingIsDirect = es === et;

    if (existingIsDirect === isDirectMapping) consistentCount++;
  }

  return consistentCount / context.existingMappings.length;
}

// --- Utility Functions ---

function normalizeFieldName(name: string): string {
  // dot notation에서 마지막 부분만 사용
  const parts = name.split('.');
  return parts[parts.length - 1];
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function matchWithAbbreviations(source: string, target: string): boolean {
  // 소스의 약어를 확장하여 타겟과 비교
  for (const [abbr, expansions] of Object.entries(ABBREVIATION_MAP)) {
    if (source.includes(abbr)) {
      for (const expansion of expansions) {
        const expanded = source.replace(abbr, expansion);
        if (expanded === target || toSnakeCase(expanded) === toSnakeCase(target)) return true;
      }
    }
    if (target.includes(abbr)) {
      for (const expansion of expansions) {
        const expanded = target.replace(abbr, expansion);
        if (expanded === source || toSnakeCase(expanded) === toSnakeCase(source)) return true;
      }
    }
  }
  return false;
}

function matchWithSynonyms(source: string, target: string): boolean {
  const sourceSegments = source.split('_');
  const targetSegments = target.split('_');

  for (const [word, synonyms] of Object.entries(SYNONYM_MAP)) {
    const allTerms = [word, ...synonyms];
    const sourceMatch = allTerms.some(t => segmentMatch(sourceSegments, t));
    const targetMatch = allTerms.some(t => segmentMatch(targetSegments, t));
    if (sourceMatch && targetMatch) return true;
  }
  return false;
}

function segmentMatch(fieldSegments: string[], term: string): boolean {
  const termSegments = term.split('_');
  if (!termSegments.every(ts => fieldSegments.includes(ts))) return false;
  // 단일 세그먼트 용어는 필드의 50% 이상을 차지해야 false positive 방지
  return termSegments.length / fieldSegments.length >= 0.5;
}

function extractPathKeywords(fullPath: string): string[] {
  const parts = fullPath.split('.');
  if (parts.length <= 1) return [];
  return parts.slice(0, -1).map(p => toSnakeCase(p).toLowerCase());
}

function calculatePathContextBoost(sourcePath: string, targetName: string): number {
  const parentKeywords = extractPathKeywords(sourcePath);
  if (parentKeywords.length === 0) return 0;

  const tNorm = toSnakeCase(normalizeFieldName(targetName)).toLowerCase();

  for (const keyword of parentKeywords) {
    if (matchWithSynonyms(keyword, tNorm)) return 0.15;
    if (tNorm.includes(keyword) || keyword.includes(tNorm)) return 0.1;
  }
  return 0;
}

function calculateDescriptionBoost(
  sourceName: string,
  targetDescription?: string,
  targetMeaning?: string,
): number {
  if (!targetDescription && !targetMeaning) return 0;

  // 소스의 전체 경로를 세그먼트로 분해 (Vehicle.PassengerQuantity → [vehicle, passenger, quantity])
  const sourceSegments = sourceName.split('.').flatMap(p =>
    toSnakeCase(p).toLowerCase().split('_'),
  );
  const allKeywords = extractKeywords(`${targetDescription || ''} ${targetMeaning || ''}`);
  if (allKeywords.length === 0) return 0;

  let matchCount = 0;
  for (const keyword of allKeywords) {
    if (sourceSegments.some(s => s === keyword || s.includes(keyword) || keyword.includes(s))) {
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;
  const ratio = Math.min(matchCount / allKeywords.length, 1.0);
  return 0.1 + ratio * 0.2;
}

function extractKeywords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → spaces
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/[\s_]+/)
    .filter(w => w.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
