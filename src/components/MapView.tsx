import { useEffect, useMemo, useRef, useState } from 'react';
import { dashboard } from '@lark-base-open/js-sdk';
import { loadPoints } from '../data';
import { DEFAULT_MAP_KEY } from '../mapKey';
import { loadTMap } from '../tmap';
import { styleIdForBrand } from '../brandColors';
import { makeMarkerIconForBrand } from '../brandLogos';
import type { PluginConfig, StorePoint } from '../types';
import FilterSelect from './FilterSelect';

interface Props {
  config: PluginConfig;
}

type FacetDim = 'brand' | 'func' | 'type' | 'model';

/**
 * 联动（faceted）筛选项：返回 dim 维度在当前「除 dim 自身外」所有筛选条件下的可选值。
 * 即某个品牌的候选项，只保留在已选省份/城市/功能/类型/模式下真实存在的品牌，
 * 实现四个维度互相联动。
 */
function facetOptions(
  points: StorePoint[],
  dim: FacetDim,
  sel: {
    province: string;
    city: string;
    brandsSelected: string[];
    funcSelected: string[];
    typeSelected: string[];
    modelSelected: string[];
  },
): string[] {
  const set = new Set<string>();
  for (const p of points) {
    if (sel.province && p.province !== sel.province) continue;
    if (sel.city && p.city !== sel.city) continue;
    if (dim !== 'brand' && sel.brandsSelected.length && !sel.brandsSelected.includes(p.brand ?? ''))
      continue;
    if (dim !== 'func' && sel.funcSelected.length && !sel.funcSelected.includes(p.storeFunction ?? ''))
      continue;
    if (dim !== 'type' && sel.typeSelected.length && !sel.typeSelected.includes(p.storeType ?? ''))
      continue;
    if (dim !== 'model' && sel.modelSelected.length && !sel.modelSelected.includes(p.businessModel ?? ''))
      continue;
    const v =
      dim === 'brand'
        ? p.brand
        : dim === 'func'
          ? p.storeFunction
          : dim === 'type'
            ? p.storeType
            : p.businessModel;
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

export default function MapView({ config }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const hoverInfoRef = useRef<any>(null);
  const pinnedWindowsRef = useRef<Map<string, any>>(new Map());
  const hoverIdRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<any>(null);
  const collapseTimerRef = useRef<any>(null);
  const openDropdownsRef = useRef(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState<StorePoint[]>([]);
  const [, setStat] = useState({ total: 0, skipped: 0 });

  // 省份 / 城市 / 品牌 / 门店功能 / 门店类型 / 经营模式 筛选（品牌及后三个为多选）
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [brandsSelected, setBrandsSelected] = useState<string[]>([]);
  const [funcSelected, setFuncSelected] = useState<string[]>([]);
  const [typeSelected, setTypeSelected] = useState<string[]>([]);
  const [modelSelected, setModelSelected] = useState<string[]>([]);

  const hasProvince = points.some((p) => p.province);
  const hasCity = points.some((p) => p.city);
  const hasBrand = points.some((p) => p.brand);
  const hasFunc = points.some((p) => p.storeFunction);
  const hasType = points.some((p) => p.storeType);
  const hasModel = points.some((p) => p.businessModel);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => p.province && set.add(p.province));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [points]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (p.city && (!province || p.province === province)) set.add(p.city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [points, province]);

  const brands = useMemo(
    () => facetOptions(points, 'brand', { province, city, brandsSelected, funcSelected, typeSelected, modelSelected }),
    [points, province, city, brandsSelected, funcSelected, typeSelected, modelSelected],
  );

  const funcs = useMemo(
    () => facetOptions(points, 'func', { province, city, brandsSelected, funcSelected, typeSelected, modelSelected }),
    [points, province, city, brandsSelected, funcSelected, typeSelected, modelSelected],
  );

  const types = useMemo(
    () => facetOptions(points, 'type', { province, city, brandsSelected, funcSelected, typeSelected, modelSelected }),
    [points, province, city, brandsSelected, funcSelected, typeSelected, modelSelected],
  );

  const models = useMemo(
    () => facetOptions(points, 'model', { province, city, brandsSelected, funcSelected, typeSelected, modelSelected }),
    [points, province, city, brandsSelected, funcSelected, typeSelected, modelSelected],
  );

  const filtered = useMemo(
    () =>
      points.filter(
        (p) =>
          (!province || p.province === province) &&
          (!city || p.city === city) &&
          (brandsSelected.length === 0 || brandsSelected.includes(p.brand ?? '')) &&
          (funcSelected.length === 0 || funcSelected.includes(p.storeFunction ?? '')) &&
          (typeSelected.length === 0 || typeSelected.includes(p.storeType ?? '')) &&
          (modelSelected.length === 0 || modelSelected.includes(p.businessModel ?? '')),
      ),
    [points, province, city, brandsSelected, funcSelected, typeSelected, modelSelected],
  );

  // 联动清理：当某维度的可选项因其他筛选被收窄后，移除已选中但已无对应门店的值，避免筛出空结果且无法取消
  useEffect(() => {
    setBrandsSelected((prev) => (prev.every((v) => brands.includes(v)) ? prev : prev.filter((v) => brands.includes(v))));
  }, [brands]);
  useEffect(() => {
    setFuncSelected((prev) => (prev.every((v) => funcs.includes(v)) ? prev : prev.filter((v) => funcs.includes(v))));
  }, [funcs]);
  useEffect(() => {
    setTypeSelected((prev) => (prev.every((v) => types.includes(v)) ? prev : prev.filter((v) => types.includes(v))));
  }, [types]);
  useEffect(() => {
    setModelSelected((prev) => (prev.every((v) => models.includes(v)) ? prev : prev.filter((v) => models.includes(v))));
  }, [models]);

  // 1. 取数
  useEffect(() => {
    let alive = true;
    if (!config.tableId) {
      setPoints([]);
      setStat({ total: 0, skipped: 0 });
      setMessage('尚未配置数据表，请点击组件右上角 ⋮ → 配置，选择数据表与经纬度字段');
      dashboard.setRendered().catch(() => {});
      return;
    }
    loadPoints(config)
      .then((res) => {
        if (!alive) return;
        setPoints(res.points);
        setStat({ total: res.total, skipped: res.skipped });
        if (res.points.length === 0) {
          setMessage(res.total === 0 ? '该表暂无记录' : '没有解析出有效坐标，请检查字段选择或经纬度顺序');
        }
      })
      .catch((err) => {
        if (!alive) return;
        setStatus('error');
        setMessage(err?.message ?? String(err));
      });
    return () => {
      alive = false;
    };
  }, [config]);

  // 2. 初始化地图
  useEffect(() => {
    // 未配置数据表时优先显示配置引导，不覆盖为 key 的报错
    if (!config.tableId) return;
    // 配置面板没填就回退到内置默认 key
    const mapKey = (config.mapKey ?? '').trim() || DEFAULT_MAP_KEY;
    let alive = true;
    loadTMap(mapKey)
      .then((TMap) => {
        if (!alive || !containerRef.current || mapRef.current) return;
        mapRef.current = new TMap.Map(containerRef.current, {
          zoom: 5,
          center: new TMap.LatLng(34.3, 108.9),
          baseMap: { type: 'vector' },
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setStatus('error');
        setMessage(err?.message ?? String(err));
      });
    return () => {
      alive = false;
    };
  }, [config.mapKey, config.tableId]);

  // 3. 打点 + 自适应视野
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const TMap = (window as any).TMap;
    const map = mapRef.current;

    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    hoverInfoRef.current?.close();
    pinnedWindowsRef.current.forEach((w) => w.close());
    pinnedWindowsRef.current.clear();
    hoverIdRef.current = null;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (filtered.length === 0) {
      dashboard.setRendered().catch(() => {});
      return;
    }

    const geometries = filtered.map((p, i) => ({
      id: String(i),
      styleId: styleIdForBrand(p.brand),
      position: new TMap.LatLng(p.lat, p.lng),
    }));

    const styles: Record<string, any> = {};
    filtered.forEach((p) => {
      const sid = styleIdForBrand(p.brand);
      if (!styles[sid]) {
        styles[sid] = new TMap.MarkerStyle({
          width: 30,
          height: 30,
          anchor: { x: 15, y: 30 },
          src: makeMarkerIconForBrand(p.brand),
        });
      }
    });

    markerRef.current = new TMap.MultiMarker({
      map,
      styles,
      geometries,
    });

    // 构建点位气泡 HTML（主显品牌+简称，副显功能/类型/模式）
    const buildInfoContent = (point: StorePoint): string => {
      const name = escapeHtml(point.name || '未命名门店');
      const lines = (
        [
          ['功能', point.storeFunction],
          ['类型', point.storeType],
          ['模式', point.businessModel],
        ] as [string, string | undefined][]
      )
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<div class="map-info-line"><span class="map-info-key">${escapeHtml(
              k,
            )}</span><span class="map-info-val">${escapeHtml(v as string)}</span></div>`,
        )
        .join('');
      return `<div class="map-info"><div class="map-info-title">${name}</div>${
        lines ? `<div class="map-info-sub">${lines}</div>` : ''
      }</div>`;
    };

    // 打开指定点位（id）的气泡，target 指定用「固定窗口」还是「悬停窗口」
    const openInfoFor = (id: string, target: 'pinned' | 'hover') => {
      const point = filtered[Number(id)];
      if (!point) return;
      const content = buildInfoContent(point);
      const position = new TMap.LatLng(point.lat, point.lng);
      // 悬停：单例窗口
      if (target === 'hover') {
        if (!hoverInfoRef.current) {
          hoverInfoRef.current = new TMap.InfoWindow({
            map,
            position,
            content,
            offset: { x: 0, y: -34 },
            enableCustom: true,
          });
        } else {
          hoverInfoRef.current.setPosition(position);
          hoverInfoRef.current.setContent(content);
        }
        hoverInfoRef.current.open();
        return;
      }
      // 固定：每个点位独立窗口，可多个并存
      let w = pinnedWindowsRef.current.get(id);
      if (!w) {
        w = new TMap.InfoWindow({
          map,
          position,
          content,
          offset: { x: 0, y: -34 },
          enableCustom: true,
        });
        pinnedWindowsRef.current.set(id, w);
      } else {
        w.setPosition(position);
        w.setContent(content);
      }
      w.open();
    };

    // 点击：固定/取消固定（再次点击同一点位单独取消）。每个固定点位独立窗口，可多个并存。
    markerRef.current.on('click', (evt: any) => {
      const id = evt?.geometry?.id;
      const point = filtered[Number(id)];
      if (!point) return;
      if (pinnedWindowsRef.current.has(id)) {
        pinnedWindowsRef.current.get(id)?.close();
        pinnedWindowsRef.current.delete(id);
        return;
      }
      hoverInfoRef.current?.close();
      openInfoFor(id, 'pinned');
    });

    // 悬停：在独立「悬停窗口」显示该点位气泡（短延时避免相邻点位间移动闪烁）
    markerRef.current.on('mouseover', (evt: any) => {
      const id = evt?.geometry?.id;
      if (!filtered[Number(id)]) return;
      // 已固定的点位本身就显示在固定窗口，无需再开悬停窗口
      if (pinnedWindowsRef.current.has(id)) return;
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      hoverIdRef.current = id;
      openInfoFor(id, 'hover');
    });

    // 离开：短延时后关闭「悬停窗口」（固定窗口不受影响，A 仍保持显示）
    markerRef.current.on('mouseout', (evt: any) => {
      const id = evt?.geometry?.id;
      hoverIdRef.current = null;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        hoverInfoRef.current?.close();
      }, 80);
    });

    const bounds = new TMap.LatLngBounds();
    filtered.forEach((p) => bounds.extend(new TMap.LatLng(p.lat, p.lng)));
    map.fitBounds(bounds, { padding: 60 });

    dashboard.setRendered().catch(() => {});
  }, [status, filtered]);

  // 筛选栏热区：鼠标进入即展开；离开后若无下拉在展开，短延时自动收起
  const handleFiltersZoneEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setFiltersExpanded(true);
  };
  const handleFiltersZoneLeave = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      if (openDropdownsRef.current === 0) setFiltersExpanded(false);
    }, 250);
  };
  const handleDropdownOpenChange = (open: boolean) => {
    openDropdownsRef.current = Math.max(0, openDropdownsRef.current + (open ? 1 : -1));
  };

  return (
    <div className="map-wrap">
      {(hasProvince || hasCity || hasBrand || hasFunc || hasType || hasModel) && (
        <div
          className={'map-filters-zone' + (filtersExpanded ? ' expanded' : '')}
          onMouseEnter={handleFiltersZoneEnter}
          onMouseLeave={handleFiltersZoneLeave}
        >
          <div className="map-filters">
            {hasProvince && (
              <FilterSelect
                placeholder="全部省份"
                options={provinces}
                value={province}
                onChange={(v) => {
                  setProvince(v as string);
                  setCity('');
                }}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
            {hasCity && (
              <FilterSelect
                placeholder="全部城市"
                options={cities}
                value={city}
                onChange={(v) => setCity(v as string)}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
            {hasBrand && (
              <FilterSelect
                placeholder="全部品牌"
                allLabel="全部品牌"
                multiple
                options={brands}
                value={brandsSelected}
                onChange={(v) => setBrandsSelected(v as string[])}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
            {hasFunc && (
              <FilterSelect
                placeholder="全部功能"
                allLabel="全部功能"
                multiple
                options={funcs}
                value={funcSelected}
                onChange={(v) => setFuncSelected(v as string[])}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
            {hasType && (
              <FilterSelect
                placeholder="全部类型"
                allLabel="全部类型"
                multiple
                options={types}
                value={typeSelected}
                onChange={(v) => setTypeSelected(v as string[])}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
            {hasModel && (
              <FilterSelect
                placeholder="全部模式"
                allLabel="全部模式"
                multiple
                options={models}
                value={modelSelected}
                onChange={(v) => setModelSelected(v as string[])}
                onOpenChange={handleDropdownOpenChange}
              />
            )}
          </div>
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
      {status === 'loading' && <div className="map-mask">地图加载中…</div>}
      {status === 'error' && <div className="map-mask map-mask-error">{message}</div>}
      {status === 'ready' && points.length === 0 && message && <div className="map-mask">{message}</div>}
      {status === 'ready' && points.length > 0 && filtered.length === 0 && (
        <div className="map-mask">当前筛选条件下没有门店</div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c];
  });
}
