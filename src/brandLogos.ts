/**
 * 各汽车品牌的真实徽章 logo（SVG 内联为 data URL）。
 * 文件名使用 ASCII 别名，避免中文路径在构建/部署时的编码问题；
 * 对外仍用中文品牌名（与飞书表字段值、BRAND_COLORS 保持一致）作为 key。
 */

import xiaopeng from './logos/xiaopeng.svg?raw';
import lixiang from './logos/lixiang.svg?raw';
import tesla from './logos/tesla.svg?raw';
import leapmotor from './logos/leapmotor.svg?raw';
import byd from './logos/byd.svg?raw';
import xiaomi from './logos/xiaomi.svg?raw';
import geelyGalaxy from './logos/geely-galaxy.svg?raw';
import nio from './logos/nio.svg?raw';
import zeekr from './logos/zeekr.svg?raw';

import { getBrandColor } from './brandColors';

/** 按指定颜色生成水滴标记图标（data URL），品牌徽章缺失时的回退 */
export function makeMarkerIcon(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.373 18.627 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="#ffffff"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** 中文品牌名 → 徽章 SVG 原始文本 */
const LOGO_RAW: Record<string, string> = {
  小鹏: xiaopeng,
  理想: lixiang,
  特斯拉: tesla,
  零跑: leapmotor,
  比亚迪: byd,
  小米: xiaomi,
  吉利银河: geelyGalaxy,
  蔚来: nio,
  极氪: zeekr,
};

/** 取某品牌徽章的 data URL（无该品牌返回 undefined）。
 * 注入 width/height，避免部分 <img>/canvas 上下文中因 SVG 缺少尺寸而渲染为 0。 */
export function brandLogoDataUrl(brand?: string, size = 30): string | undefined {
  const raw = brand ? LOGO_RAW[brand] : undefined;
  if (!raw) return undefined;
  let svg = raw;
  if (!/\bwidth\s*=/.test(svg)) {
    svg = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * 生成点位 marker 图标：优先用真实品牌徽章；
 * 未知/缺失品牌回退到品牌色水滴，保证所有点都有可见标记。
 */
export function makeMarkerIconForBrand(brand?: string): string {
  const logo = brandLogoDataUrl(brand);
  if (logo) return logo;
  return makeMarkerIcon(getBrandColor(brand));
}

/**
 * 取品牌 logo 的主色：直接从 SVG 原始文本里提取（忽略白色留白），
 * 保证地图圆点/标记颜色与 logo 完全一致，且以后替换 SVG 也不会再漂。
 * 未知品牌回退到 getBrandColor 调色板。
 */
export function brandPrimaryColor(brand?: string): string {
  const raw = brand ? LOGO_RAW[brand] : undefined;
  if (raw) {
    const matches = raw.match(/#[0-9a-fA-F]{3,8}/g);
    if (matches) {
      const colors = new Set<string>();
      for (const c of matches) {
        const lower = c.toLowerCase();
        if (lower === '#fff' || lower === '#ffffff') continue;
        colors.add(lower);
      }
      if (colors.size > 0) return Array.from(colors)[0];
    }
  }
  return getBrandColor(brand);
}
