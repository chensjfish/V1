export type CoordSource = 'location' | 'lnglat';

/** 存在 dashboard.customConfig 里的插件配置 */
export interface PluginConfig {
  /** 数据表 id */
  tableId?: string;
  tableName?: string;
  /** 门店名称字段（用于气泡标题） */
  nameFieldId?: string;
  /** 坐标来源：location=单个地理位置字段；lnglat=经度+纬度两个字段 */
  coordSource?: CoordSource;
  locationFieldId?: string;
  lngFieldId?: string;
  latFieldId?: string;
  /** 经纬度顺序反了时打开 */
  swapLngLat?: boolean;
  /** 腾讯地图 key（前端明文，务必配置 Referer 白名单） */
  mapKey?: string;
  /** 省份字段（可选，用于地图按省/市筛选） */
  provinceFieldId?: string;
  /** 城市字段（可选，用于地图按省/市筛选） */
  cityFieldId?: string;
  /** 品牌字段（可选，用于按品牌着色与筛选） */
  brandFieldId?: string;
  /** 门店功能字段（可选，多选筛选） */
  funcFieldId?: string;
  /** 门店类型字段（可选，多选筛选） */
  typeFieldId?: string;
  /** 经营模式字段（可选，多选筛选） */
  modelFieldId?: string;
}

export interface StorePoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 省份（命名筛选用，可选） */
  province?: string;
  /** 城市（命名筛选用，可选） */
  city?: string;
  /** 品牌（着色与筛选用，可选） */
  brand?: string;
  /** 门店功能（多选筛选用，可选） */
  storeFunction?: string;
  /** 门店类型（多选筛选用，可选） */
  storeType?: string;
  /** 经营模式（多选筛选用，可选） */
  businessModel?: string;
}

export interface LoadResult {
  points: StorePoint[];
  total: number;
  skipped: number;
}
