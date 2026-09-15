/**
 * 本地行政区划 GeoJSON（阿里 DataV.GeoAtlas）加载与投影。
 * 坐标系：GCJ-02，与门店经纬度一致，无需转换。
 * 文件名即 adcode：100000=全国，440000=广东省，440300=深圳市……
 * 每个要素 properties 含 name / adcode / center / centroid / level / parent / acroutes。
 */

export interface GeoProperties {
  adcode: number;
  name: string;
  center?: [number, number];
  centroid?: [number, number];
  level?: string;
  parent?: { adcode: number };
  acroutes?: number[];
  [key: string]: unknown;
}

export interface GeoFeature {
  type: 'Feature';
  properties: GeoProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
}

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface Projector {
  project(lng: number, lat: number): [number, number];
  width: number;
  height: number;
}

const BASE = import.meta.env.BASE_URL || './';
const NATIONAL_ADCODE = 100000;

const cache = new Map<string, GeoCollection | null>();
const inflight = new Map<string, Promise<GeoCollection | null>>();

/** 懒加载某个 adcode 的 GeoJSON，优先 <adcode>_full.json，缺失时回退 <adcode>.json */
export function loadGeo(adcode: string | number): Promise<GeoCollection | null> {
  const key = String(adcode);
  if (cache.has(key)) return Promise.resolve(cache.get(key)!);
  if (inflight.has(key)) return inflight.get(key)!;

  const task = (async (): Promise<GeoCollection | null> => {
    for (const suffix of ['_full', '']) {
      try {
        const res = await fetch(`${BASE}maps/${key}${suffix}.json`);
        if (res.ok) {
          const data = (await res.json()) as GeoCollection;
          cache.set(key, data);
          return data;
        }
      } catch {
        // 尝试下一个后缀
      }
    }
    cache.set(key, null);
    return null;
  })();

  inflight.set(key, task);
  task.finally(() => inflight.delete(key));
  return task;
}

/** 中文行政区划名归一化：去空白、去省/市/自治区/州/盟/地区/县/区等后缀 */
export function normName(s?: string): string {
  if (!s) return '';
  return String(s)
    .replace(/\s+/g, '')
    .replace(
      /(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|自治州|自治县|地区|盟|省|市|区|县|旗)$/g,
      '',
    );
}

const nationalNameMap = new Map<string, number>();
const cityNameMaps = new Map<number, Map<string, number>>();

/** 省名 → adcode（基于全国表构建，按需） */
export async function resolveProvinceAdcode(provinceName?: string): Promise<number | null> {
  if (!provinceName) return null;
  if (nationalNameMap.size === 0) {
    const nat = await loadGeo(NATIONAL_ADCODE);
    if (!nat) return null;
    for (const f of nat.features) {
      const n = f.properties.name as string;
      nationalNameMap.set(n, f.properties.adcode);
      nationalNameMap.set(normName(n), f.properties.adcode);
    }
  }
  const nn = normName(provinceName);
  return nationalNameMap.get(nn) ?? nationalNameMap.get(provinceName) ?? null;
}

/** 市名 → adcode（基于所属省的表构建，按需；provinceAdcode 缺失时返回 null） */
export async function resolveCityAdcode(
  provinceAdcode: number | null,
  cityName?: string,
): Promise<number | null> {
  if (!cityName || provinceAdcode == null) return null;
  let map = cityNameMaps.get(provinceAdcode);
 if (!map) {
    const geo = await loadGeo(provinceAdcode);
    map = new Map();
    if (geo) {
      for (const f of geo.features) {
        const n = f.properties.name as string;
        map.set(n, f.properties.adcode);
        map.set(normName(n), f.properties.adcode);
      }
    }
    cityNameMaps.set(provinceAdcode, map);
  }
  const nn = normName(cityName);
  return map.get(nn) ?? map.get(cityName) ?? null;
}

/** 遍历 GeoJSON 所有坐标，求经纬度外接框 */
export function computeBounds(geo: GeoCollection): Bounds {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const lng = c[0] as number;
      const lat = c[1] as number;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(c)) {
      for (const child of c) visit(child);
    }
  };
  for (const f of geo.features) visit(f.geometry.coordinates);
  if (!isFinite(minLng)) return { minLng: 73, minLat: 3, maxLng: 135, maxLat: 54 }; // 中国大致范围兜底
  return { minLng, minLat, maxLng, maxLat };
}

/** 墨卡托投影，将区域外接框等比适配进 width×height（含 padding），北在上 */
export function makeProjector(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 24,
): Projector {
  const merc = (lng: number, lat: number): [number, number] => {
    const x = (lng * Math.PI) / 180;
    const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    return [x, y];
  };
  const [x0, y0] = merc(bounds.minLng, bounds.minLat);
  const [x1, y1] = merc(bounds.maxLng, bounds.maxLat);
  const gw = Math.max(x1 - x0, 1e-9);
  const gh = Math.max(y1 - y0, 1e-9);
  const scale = Math.min((width - 2 * padding) / gw, (height - 2 * padding) / gh);
  const offX = (width - gw * scale) / 2;
  const offY = (height - gh * scale) / 2;
  const project = (lng: number, lat: number): [number, number] => {
    const [x, y] = merc(lng, lat);
    const sx = offX + (x - x0) * scale;
    const sy = offY + (y1 - y) * scale; // 翻转 y，使北朝上
    return [sx, sy];
  };
  return { project, width, height };
}

/** 把要素 geometry 转成 SVG path（含孔洞，配合 fill-rule:evenodd） */
export function featureToPath(
  geom: { type: string; coordinates: unknown },
  projector: Projector,
): string {
  const ringToPath = (ring: number[][]): string => {
    if (!ring || ring.length === 0) return '';
    const [x0, y0] = projector.project(ring[0][0], ring[0][1]);
    let d = `M${x0.toFixed(2)} ${y0.toFixed(2)}`;
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = projector.project(ring[i][0], ring[i][1]);
      d += `L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d + 'Z';
  };
  if (geom.type === 'Polygon') {
    return (geom.coordinates as number[][][]).map(ringToPath).join(' ');
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][])
      .map((poly) => poly.map(ringToPath).join(' '))
      .join(' ');
  }
  return '';
}

export { NATIONAL_ADCODE };
