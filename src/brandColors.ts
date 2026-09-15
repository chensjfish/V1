/** 各汽车品牌的地图标记配色（与 src/logos/*.svg 内真实主色保持一致） */
export const BRAND_COLORS: Record<string, string> = {
  小鹏: '#000000',
  理想: '#065F46',
  特斯拉: '#E82127',
  零跑: '#6A1B9A',
  比亚迪: '#005BAC',
  小米: '#FF6900',
  吉利银河: '#657292',
  蔚来: '#00BDBD',
  极氪: '#918297',
};

/** 不在上面的已知品牌时，按字符串稳定地分配一个备选色 */
const FALLBACK = ['#9B59B6', '#16A085', '#F39C12', '#8E44AD', '#2980B9', '#E67E22', '#27AE60', '#C0392B'];

/** 取品牌对应的颜色，未知/缺失返回灰色 */
export function getBrandColor(brand?: string): string {
  if (brand && BRAND_COLORS[brand]) return BRAND_COLORS[brand];
  if (!brand) return '#9AA0A6';
  let h = 0;
  for (let i = 0; i < brand.length; i++) h = (h * 31 + brand.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

/** 把品牌名映射到 MultiMarker 的 styleId（避免品牌名含特殊字符） */
export function styleIdForBrand(brand?: string): string {
  return 'b_' + (brand ?? 'none');
}
