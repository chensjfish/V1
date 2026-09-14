import { useEffect, useState } from 'react';
import { DashboardState, dashboard } from '@lark-base-open/js-sdk';
import { loadPoints } from '../data';
import { DEFAULT_MAP_KEY } from '../mapKey';
import type { PluginConfig } from '../types';

interface Props {
  config: PluginConfig;
  state: DashboardState;
}

interface DiagInfo {
  url: string;
  inIframe: boolean;
  ua: string;
  webgl: string;
  tmapLoaded: boolean;
  sdkState: string;
  dataResult: string;
  errors: string[];
}

function detectWebGL(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return '不支持（地图会白屏，需换非 WebGL 底图）';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    return `支持 · ${String(renderer).slice(0, 40)}`;
  } catch (e: any) {
    return `检测异常：${e?.message ?? e}`;
  }
}

/** ?debug=1 时的诊断面板：把白屏原因直接摆在页面上，省去远程调试 */
export default function Diagnose({ config, state }: Props) {
  const [info, setInfo] = useState<DiagInfo | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(`error: ${e.message}`);
    const onReject = (e: PromiseRejectionEvent) =>
      errors.push(`unhandled: ${e.reason?.message ?? e.reason}`);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onReject);

    let alive = true;
    loadPoints(config)
      .then((res) => {
        if (!alive) return;
        setInfo({
          url: location.href,
          inIframe: window.self !== window.top,
          ua: navigator.userAgent.slice(0, 80),
          webgl: detectWebGL(),
          tmapLoaded: !!(window as any).TMap,
          sdkState: String(state),
          dataResult: `共 ${res.total} 条，有效 ${res.points.length} 个，跳过 ${res.skipped} 条`,
          errors,
        });
      })
      .catch((e: any) => {
        if (!alive) return;
        errors.push(`取数失败: ${e?.message ?? e}`);
        setInfo({
          url: location.href,
          inIframe: window.self !== window.top,
          ua: navigator.userAgent.slice(0, 80),
          webgl: detectWebGL(),
          tmapLoaded: !!(window as any).TMap,
          sdkState: String(state),
          dataResult: '取数失败（见错误）',
          errors,
        });
      });

    const timer = window.setTimeout(() => {
      if (!alive) return;
      setInfo((prev) => (prev ? { ...prev, tmapLoaded: !!(window as any).TMap, errors } : prev));
    }, 4000);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onReject);
    };
  }, [config, state]);

  // 无数据时也先把静态环境信息显示出来
  const view: DiagInfo = info ?? {
    url: location.href,
    inIframe: window.self !== window.top,
    ua: navigator.userAgent.slice(0, 80),
    webgl: detectWebGL(),
    tmapLoaded: !!(window as any).TMap,
    sdkState: String(state),
    dataResult: '读取中…',
    errors: [],
  };

  const keyInUse = (config.mapKey ?? '').trim() || DEFAULT_MAP_KEY;
  const maskedKey = `${keyInUse.slice(0, 6)}…${keyInUse.slice(-4)}`;

  if (!open) {
    return (
      <button className="diag-toggle" onClick={() => setOpen(true)}>
        诊断
      </button>
    );
  }

  return (
    <div className="diag">
      <div className="diag-head">
        <span>诊断信息</span>
        <button onClick={() => setOpen(false)}>收起</button>
      </div>
      <div className="diag-body">
        <div>URL：{view.url}</div>
        <div>
          运行位置：{view.inIframe ? 'iframe 内（正常）' : '顶层窗口'}
          <span className={view.inIframe ? 'ok' : 'warn'}>
            {view.inIframe ? '✓' : '（飞书里应嵌在 iframe 中）'}
          </span>
        </div>
        <div>WebGL：{view.webgl}</div>
        <div>地图 SDK：{view.tmapLoaded ? '✓ 已加载 TMap' : '✗ 未加载（脚本被拦或 key 无效）'}</div>
        <div>仪表盘状态：{view.sdkState}（0=Create 1=Config 2=View 3=FullScreen）</div>
        <div>取数：{view.dataResult}</div>
        <div>表：{config.tableName ?? config.tableId ?? '未配置'}</div>
        <div>
          字段：lng={config.lngFieldId ?? '-'} lat={config.latFieldId ?? '-'} name=
          {config.nameFieldId ?? '-'}
        </div>
        <div>key：{maskedKey}（已内置默认 key 时也会显示）</div>
        <div>UA：{view.ua}</div>
        {view.errors.length > 0 && (
          <div className="diag-errors">
            {view.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
