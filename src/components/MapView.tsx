import { useEffect, useMemo, useRef, useState } from 'react';
import { dashboard } from '@lark-base-open/js-sdk';
import { loadPoints } from '../data';
import { makeMarkerIconForBrand, brandPrimaryColor } from '../brandLogos';
import {
  loadGeo,
  resolveProvinceAdcode,
  resolveCityAdcode,
  computeBounds,
  makeProjector,
  featureToPath,
  NATIONAL_ADCODE,
  type GeoCollection,
} from '../geo';
import type { PluginConfig, StorePoint } from '../types';
import FilterSelect from './FilterSelect';

interface Props {
  config: PluginConfig;
}

type FacetDim = 'brand' | 'func' | 'type' | 'model';

/**
 * 联动（faceted）筛选项：返回 dim 维度在当前筛选条件下的可选值。
 * 联动模型（品牌为枢纽）：
 *  - 品牌选项：仅受省份/城市约束（不受功能/类型/模式约束）。
 *  - 门店功能/类型/经营模式选项：受省份/城市 + 品牌约束，但三者之间互不约束。
 * 即「功能/类型/模式」各自随所选品牌收窄，而品牌不受其余三者反向约束。
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
    // 品牌是联动枢纽：功能/类型/模式 的选项随所选品牌收窄；品牌自身选项不受三者约束
    if (dim !== 'brand' && sel.brandsSelected.length && !sel.brandsSelected.includes(p.brand ?? ''))
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

interface View {
  scale: number;
  x: number;
  y: number;
}

export default function MapView({ config }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // 本地 GeoJSON 底图状态
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const [geoAdcode, setGeoAdcode] = useState<string>('');
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef<View>(view);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // 悬停 / 固定气泡
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const hoverTimerRef = useRef<any>(null);

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

  // 2. 按省/市筛选加载对应行政区划 GeoJSON（未筛选→全国；选省→省；选市→市），含回退链
  useEffect(() => {
    if (!config.tableId) {
      setGeo(null);
      setGeoAdcode('');
      return;
    }
    let alive = true;
    (async () => {
      let adcode: number | null = null;
      if (city) {
        const prov = province ? await resolveProvinceAdcode(province) : null;
        adcode = (await resolveCityAdcode(prov, city)) ?? prov;
      } else if (province) {
        adcode = await resolveProvinceAdcode(province);
      }
      const code = adcode ?? NATIONAL_ADCODE;
      let g = await loadGeo(code);
      if (!g && code !== NATIONAL_ADCODE) g = await loadGeo(NATIONAL_ADCODE);
      if (!alive) return;
      setGeo(g);
      setGeoAdcode(g ? String(code) : String(NATIONAL_ADCODE));
      if (!g) {
        setStatus('error');
        setMessage('地图数据加载失败，请检查 public/maps 目录是否包含对应行政区划 JSON');
      } else {
        setStatus('ready');
      }
      dashboard.setRendered().catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, [province, city, config.tableId]);

  // 3. 容器尺寸测量（ResizeObserver）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 4. 投影 + 点位定位
  const bounds = useMemo(() => (geo ? computeBounds(geo) : null), [geo]);
  const projector = useMemo(
    () => (bounds ? makeProjector(bounds, size.w, size.h, 24) : null),
    [bounds, size],
  );

  const markerPositions = useMemo(() => {
    if (!projector) return [];
    return filtered.map((p, i) => {
      const [x, y] = projector.project(p.lng, p.lat);
      return { id: String(i), point: p, x, y };
    });
  }, [filtered, projector]);

  // 区域名称标注：按当前底图层级标注要素名（全国→省、省→市、市→区），优先用 center，缺则取几何质心
  const geoLabels = useMemo(() => {
    if (!projector || !geo) return [];
    // 面积加权多边形质心（兜底用，比顶点算术平均准确）
    const ringCentroid = (ring: number[][]): [number, number] | null => {
      let a = 0,
        cx = 0,
        cy = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const cr = x0 * y1 - x1 * y0;
        a += cr;
        cx += (x0 + x1) * cr;
        cy += (y0 + y1) * cr;
      }
      if (Math.abs(a) < 1e-12) return null;
      a *= 0.5;
      return [cx / (6 * a), cy / (6 * a)];
    };
    const geomCentroid = (geom: any): [number, number] | undefined => {
      if (geom.type === 'Polygon') {
        return ringCentroid(geom.coordinates[0]) || undefined;
      }
      if (geom.type === 'MultiPolygon') {
        let a = 0,
          cx = 0,
          cy = 0,
          ok = false;
        for (const poly of geom.coordinates) {
          const c = ringCentroid(poly[0]);
          if (!c) continue;
          let pa = 0;
          const ring = poly[0];
          for (let i = 0; i < ring.length - 1; i++) {
            pa += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          }
          pa = Math.abs(pa * 0.5);
          a += pa;
          cx += c[0] * pa;
          cy += c[1] * pa;
          ok = true;
        }
        return ok && a > 0 ? [cx / a, cy / a] : undefined;
      }
      return undefined;
    };
    const out: { name: string; x: number; y: number }[] = [];
    for (const f of geo.features) {
      // 优先几何质心 centroid（DataV 已算好，最贴合视觉中心）；
      // 其次行政中心 center；最后面积加权质心兜底（仅少数缺 centroid 字段的要素）。
      const pc = f.properties?.centroid as number[] | undefined;
      const ct = f.properties?.center as number[] | undefined;
      const c: number[] | undefined =
        pc && pc.length === 2
          ? pc
          : ct && ct.length === 2
            ? ct
            : geomCentroid(f.geometry);
      if (!c) continue;
      const [x, y] = projector.project(c[0], c[1]);
      out.push({ name: f.properties?.name ?? '', x, y });
    }
    return out;
  }, [geo, projector]);

  // 切换底图区域时重置视图；筛选变化时清空固定/悬停气泡
  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, [geoAdcode]);
  useEffect(() => {
    setPinnedIds(new Set());
    setHoverId(null);
  }, [filtered]);

  // 同步 view 到 ref（供原生滚轮/拖拽监听读取）
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // 滚轮缩放（围绕光标）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const ns = Math.min(20, Math.max(0.4, v.scale * factor));
      const lx = (cx - v.x) / v.scale;
      const ly = (cy - v.y) / v.scale;
      setView({ scale: ns, x: cx - lx * ns, y: cy - ly * ns });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.geo-marker')) return;
    dragRef.current = { x: e.clientX - viewRef.current.x, y: e.clientY - viewRef.current.y };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // 注意：必须在事件回调里先把偏移量取出来。
      // setView 的 updater 是延迟执行的（React 18 自动批处理），
      // 若 mouseup 先于渲染把 dragRef.current 置空，updater 里再读 dragRef.current.x
      // 会抛 TypeError，导致整个组件树卸载（白屏）。
      const drag = dragRef.current;
      if (!drag) return;
      const { x: dx, y: dy } = drag;
      setView((v) => ({ ...v, x: e.clientX - dx, y: e.clientY - dy }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // 点位气泡 HTML（主显品牌+简称，副显功能/类型/模式）
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

  const handleMarkerEnter = (id: string) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverId(id);
  };
  const handleMarkerLeave = (id: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverId((prev) => (prev === id ? null : prev));
    }, 80);
  };
  const handleMarkerClick = (id: string) => {
    setPinnedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setHoverId(null);
  };

  // 气泡列表（屏幕坐标 = 视图变换后的 marker 位置）
  const tooltipList = useMemo(() => {
    const list: { id: string; point: StorePoint; sx: number; sy: number; pinned: boolean }[] = [];
    const add = (id: string, pinned: boolean) => {
      const m = markerPositions.find((p) => p.id === id);
      if (!m) return;
      list.push({
        id,
        point: m.point,
        sx: view.x + m.x * view.scale,
        sy: view.y + m.y * view.scale,
        pinned,
      });
    };
    pinnedIds.forEach((id) => add(id, true));
    if (hoverId && !pinnedIds.has(hoverId)) add(hoverId, false);
    return list;
  }, [markerPositions, view, hoverId, pinnedIds]);

  const canShowMap = !!geo && !!projector && status !== 'error';
  const showLoading =
    !!config.tableId && (!geo || (points.length === 0 && !message && status !== 'error'));

  // 筛选栏热区：鼠标进入即展开；离开后若无下拉在展开，短延时自动收起
  const collapseTimerRef = useRef<any>(null);
  const openDropdownsRef = useRef(0);
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
      <div
        className="map-canvas"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setView({ scale: 1, x: 0, y: 0 })}
        // 兜底：即便某个元素触发了原生拖拽，也绝不允许在画布内投放，
        // 否则浏览器会把投放内容（如 data: 图片）当导航目标，整页跳 about:blank 白屏
        onDragStart={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {canShowMap && geo && projector && (
          <div
            className="geo-stage"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="geo-svg" width={size.w} height={size.h}>
              {geo.features.map((f, idx) => {
                const d = featureToPath(f.geometry, projector);
                return <path key={idx} d={d} className="geo-region" fillRule="evenodd" />;
              })}
              {geoLabels.map((l, i) => (
                <text
                  key={'lbl' + i}
                  x={l.x}
                  y={l.y}
                  className={'geo-label' + (geoAdcode === String(NATIONAL_ADCODE) ? ' geo-label-sm' : '')}
                  textAnchor="middle"
                >
                  {l.name}
                </text>
              ))}
            </svg>
            {province &&
              markerPositions.map((m) => (
              <div
                key={m.id}
                className="geo-marker"
                style={{ left: m.x, top: m.y, transform: `scale(${1 / view.scale})` }}
                onMouseEnter={() => handleMarkerEnter(m.id)}
                onMouseLeave={() => handleMarkerLeave(m.id)}
                onClick={() => handleMarkerClick(m.id)}
              >
                {city ? (
                  <img
                    className="geo-marker-img"
                    src={makeMarkerIconForBrand(m.point.brand)}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span
                    className="geo-dot"
                    style={{ background: brandPrimaryColor(m.point.brand) }}
                  />
                )}
              </div>
              ))}
          </div>
        )}
        <div className="geo-overlay">
          {tooltipList.map((t) => (
            <div
              key={t.id}
              className={'geo-tooltip' + (t.pinned ? ' pinned' : '')}
              style={{ left: t.sx, top: t.sy }}
              dangerouslySetInnerHTML={{ __html: buildInfoContent(t.point) }}
            />
          ))}
        </div>
        {showLoading && <div className="map-mask">地图加载中…</div>}
        {status === 'error' && <div className="map-mask map-mask-error">{message}</div>}
        {status !== 'error' && points.length === 0 && message && <div className="map-mask">{message}</div>}
        {status !== 'error' && points.length > 0 && filtered.length === 0 && (
          <div className="map-mask">当前筛选条件下没有门店</div>
        )}
      </div>
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
