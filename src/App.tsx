import { useEffect, useMemo, useState } from 'react';
import { DashboardState, dashboard } from '@lark-base-open/js-sdk';
import ConfigPanel from './components/ConfigPanel';
import MapView from './components/MapView';
import Diagnose from './components/Diagnose';
import { isDebug } from './mock';
import type { PluginConfig } from './types';
import { MOCK_CONFIG, isMock } from './mock';

export default function App() {
  const mock = isMock();
  const [state, setState] = useState<DashboardState>(
    mock ? DashboardState.View : dashboard.state ?? DashboardState.View,
  );
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [loaded, setLoaded] = useState(mock);

  useEffect(() => {
    if (mock) {
      const urlKey = new URLSearchParams(window.location.search).get('key');
      setConfig({ ...MOCK_CONFIG, mapKey: urlKey ?? '' });
      return;
    }
    let off: (() => void) | undefined;
    dashboard
      .getConfig()
      .then((c) => {
        setConfig((c?.customConfig as PluginConfig) ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    off = dashboard.onConfigChange(({ data }) => {
      setConfig((data?.customConfig as PluginConfig) ?? null);
    });
    return () => off?.();
  }, [mock]);

  // 兜底：任何情况下都通知仪表盘渲染完成，避免一直转圈
  useEffect(() => {
    if (mock) return;
    const timer = window.setTimeout(() => {
      dashboard.setRendered().catch(() => {});
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [mock]);

  // 保持引用稳定，避免每次渲染都触发子组件重新取数
  // 注意：必须在任何 return 之前调用，否则 Hook 数量变化会导致飞书里白屏
  const cfg = useMemo(() => config ?? {}, [config]);

  if (!loaded && !mock) return <div className="map-mask">加载中…</div>;

  const isConfig = state === DashboardState.Create || state === DashboardState.Config;

  return (
    <div className="app">
      {isConfig ? <ConfigPanel config={cfg} /> : <MapView config={cfg} />}
      {/* 仅在 ?debug=1 时显示诊断浮窗（用于排查白屏） */}
      {isDebug() && <Diagnose config={cfg} state={state} />}
    </div>
  );
}
