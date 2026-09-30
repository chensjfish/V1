import { bitable } from '@lark-base-open/js-sdk';
import type { LoadResult, PluginConfig, StorePoint } from './types';
import { isMock, MOCK_POINTS } from './mock';
import { normName } from './geo';

/** 单元格值 -> 数字（兼容数字字段、文本字段、公式字段） */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(v) && v.length === 1) return toNumber(v[0]);
  return null;
}

/** 单元格值 -> 展示文本（兼容文本、单选、多选、富文本 segment） */
function toText(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(toText).join('、');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.name === 'string') return o.name;
    if (typeof o.fullAddress === 'string') return o.fullAddress;
    return '';
  }
  return String(v);
}

/** 解析地理位置字段：{ location: "lng,lat", ... } 或 "lng,lat" 文本 */
function parseLocation(v: unknown): { lng: number; lat: number } | null {
  if (v == null) return null;
  let raw = '';
  if (typeof v === 'string') raw = v;
  else if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o.location === 'string') raw = o.location;
  }
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { lng: parts[0], lat: parts[1] };
}

/** 中国及周边范围的粗略校验，用于过滤脏数据 */
function isValid(lng: number, lat: number): boolean {
  return lng >= 70 && lng <= 140 && lat >= 0 && lat <= 60;
}

/** 官方推荐的分页接口单页上限为 200，超过会被截断 */
const PAGE_SIZE = 200;

/** 从多维表读取门店点位，自动分页 */
export async function loadPoints(cfg: PluginConfig): Promise<LoadResult> {
  if (isMock()) {
    return { points: MOCK_POINTS, total: MOCK_POINTS.length, skipped: 0 };
  }
  if (!cfg.tableId) return { points: [], total: 0, skipped: 0 };

  const table = await bitable.base.getTableById(cfg.tableId);
  const points: StorePoint[] = [];
  let total = 0;
  let skipped = 0;
  let pageToken: number | undefined;
  let guard = 0;

  do {
    const res = await table.getRecordsByPage({ pageSize: PAGE_SIZE, pageToken });
    total = res.total ?? total;

    for (const record of res.records) {
      const fields = record.fields as Record<string, unknown>;
      let coord: { lng: number; lat: number } | null = null;

      if (cfg.coordSource === 'location' && cfg.locationFieldId) {
        coord = parseLocation(fields[cfg.locationFieldId]);
      } else if (cfg.lngFieldId && cfg.latFieldId) {
        const lng = toNumber(fields[cfg.lngFieldId]);
        const lat = toNumber(fields[cfg.latFieldId]);
        if (lng != null && lat != null) coord = { lng, lat };
      }

      if (!coord) {
        skipped++;
        continue;
      }
      const lng = cfg.swapLngLat ? coord.lat : coord.lng;
      const lat = cfg.swapLngLat ? coord.lng : coord.lat;
      if (!isValid(lng, lat)) {
        skipped++;
        continue;
      }
      points.push({
        id: record.recordId,
        name: cfg.nameFieldId ? toText(fields[cfg.nameFieldId]) : '',
        lng,
        lat,
        province: cfg.provinceFieldId ? toText(fields[cfg.provinceFieldId]) || undefined : undefined,
        city: cfg.cityFieldId ? toText(fields[cfg.cityFieldId]) || undefined : undefined,
        brand: cfg.brandFieldId ? toText(fields[cfg.brandFieldId]) || undefined : undefined,
        storeFunction: cfg.funcFieldId ? toText(fields[cfg.funcFieldId]) || undefined : undefined,
        storeType: cfg.typeFieldId ? toText(fields[cfg.typeFieldId]) || undefined : undefined,
        businessModel: cfg.modelFieldId ? toText(fields[cfg.modelFieldId]) || undefined : undefined,
      });
    }

    // hasMore 为 true 但没有返回新 pageToken 时主动退出，避免死循环
    pageToken = res.hasMore && typeof res.pageToken === 'number' ? res.pageToken : undefined;
    guard += 1;
  } while (pageToken != null && guard < 50);

  return { points, total, skipped };
}

/**
 * 从「保有量子表」读取省/市/区县 → 保有量，建成查找表。
 * key = `normalize(省)|normalize(市)|normalize(区县)`，与地图标签名、当前选中省/市归一化后对齐。
 * 缺区县名或数值的记录直接跳过；配置不完整时返回空表（地图不显示保有量）。
 */
export async function loadOwnership(cfg: PluginConfig): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (isMock()) return map;
  if (
    !cfg.ownershipTableId ||
    !cfg.ownershipProvinceFieldId ||
    !cfg.ownershipCityFieldId ||
    !cfg.ownershipDistrictFieldId ||
    !cfg.ownershipValueFieldId
  ) {
    return map;
  }

  const table = await bitable.base.getTableById(cfg.ownershipTableId);
  let pageToken: number | undefined;
  let guard = 0;

  do {
    const res = await table.getRecordsByPage({ pageSize: PAGE_SIZE, pageToken });
    for (const record of res.records) {
      const fields = record.fields as Record<string, unknown>;
      const prov = toText(fields[cfg.ownershipProvinceFieldId]);
      const city = toText(fields[cfg.ownershipCityFieldId]);
      const dist = toText(fields[cfg.ownershipDistrictFieldId]);
      const val = toNumber(fields[cfg.ownershipValueFieldId]);
      if (!dist || val == null) continue; // 区县名或数值缺失：跳过，地图不显示
      const key = `${normName(prov)}|${normName(city)}|${normName(dist)}`;
      map.set(key, val);
    }
    pageToken = res.hasMore && typeof res.pageToken === 'number' ? res.pageToken : undefined;
    guard += 1;
  } while (pageToken != null && guard < 50);

  return map;
}
