/** 腾讯地图 GL JS 动态加载（合规底图，key 由使用者自行申请） */

declare global {
  interface Window {
    TMap?: unknown;
  }
}

let loading: Promise<unknown> | null = null;

export function loadTMap(key: string): Promise<any> {
  if (window.TMap) return Promise.resolve(window.TMap);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => {
      if (window.TMap) resolve(window.TMap);
      else reject(new Error('腾讯地图 SDK 已加载但 TMap 未挂载，请检查 key 是否有效'));
    };
    script.onerror = () => reject(new Error('腾讯地图 SDK 加载失败，请检查网络或 key 配置'));
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });

  return loading;
}

/** 红色水滴图标，使用内联 SVG，不引用外部 demo 资源 */
export const MARKER_ICON =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z" fill="#E24B4A"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>`,
  );

/** 按指定颜色生成水滴标记图标（data URL），用于按品牌着色 */
export function makeMarkerIcon(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="#ffffff"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
