import type { PluginConfig, StorePoint } from './types';

/** 加 ?mock=1 可在本地浏览器里脱离飞书环境调试 UI */
export function isMock(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
}

/** 加 ?debug=1 显示诊断面板（环境 / 配置 / 取数 / 错误），飞书里排查白屏用 */
export function isDebug(): boolean {
  try {
    const s = new URLSearchParams(window.location.search);
    if (s.get('debug') === '0') return false;
    return s.get('debug') === '1' || s.get('mock') === '1';
  } catch {
    return false;
  }
}

/** 输入框占位提示：留空则用内置默认 key */
export const KEY_PLACEHOLDER = '留空则使用内置默认 key';

export const MOCK_CONFIG: PluginConfig = {
  tableId: 'mock',
  tableName: '门店经纬度（本地示例数据）',
  coordSource: 'lnglat',
  swapLngLat: false,
  mapKey: '',
};

/** 从多维表「门店经纬度」导出的真实点位（含品牌），仅用于本地 mock 调试 */
const RAW_POINTS: StorePoint[] = [
  { id: 'r0', name: "深圳坂田", lng: 114.07536, lat: 22.64349, province: "广东省", city: "深圳市", brand: "小鹏" },
  { id: 'r1', name: "深圳龙岗百世汽车城", lng: 114.268835, lat: 22.704256, province: "广东省", city: "深圳市", brand: "小鹏" },
  { id: 'r2', name: "珠海上冲", lng: 113.494174, lat: 22.287625, province: "广东省", city: "珠海市", brand: "小鹏" },
  { id: 'r3', name: "东莞南城", lng: 113.730006, lat: 22.999766, province: "广东省", city: "东莞市", brand: "小鹏" },
  { id: 'r4', name: "汕头龙湖", lng: 116.726265, lat: 23.392342, province: "广东省", city: "汕头市", brand: "零跑" },
  { id: 'r5', name: "中山西区", lng: 113.322573, lat: 22.576577, province: "广东省", city: "中山市", brand: "小鹏" },
  { id: 'r6', name: "中山港口", lng: 113.38992, lat: 22.569314, province: "广东省", city: "中山市", brand: "零跑" },
  { id: 'r7', name: "肇庆端州", lng: 112.499426, lat: 23.099819, province: "广东省", city: "肇庆市", brand: "小鹏" },
  { id: 'r8', name: "东莞寮步", lng: 113.858002, lat: 23.009899, province: "广东省", city: "东莞市", brand: "理想" },
  { id: 'r9', name: "深圳龙华嘉义源", lng: 113.994003, lat: 22.6898, province: "广东省", city: "深圳市", brand: "小鹏" },
  { id: 'r10', name: "深圳前海", lng: 113.906956, lat: 22.548269, province: "广东省", city: "深圳市", brand: "理想" },
  { id: 'r11', name: "惠州金山汽车城", lng: 114.396674, lat: 23.131824, province: "广东省", city: "惠州市", brand: "小鹏" },
  { id: 'r12', name: "清远广清大道", lng: 113.0552, lat: 23.662105, province: "广东省", city: "清远市", brand: "零跑" },
  { id: 'r13', name: "茂名大道", lng: 110.961203, lat: 21.613503, province: "广东省", city: "茂名市", brand: "零跑" },
  { id: 'r14', name: "江门蓬江", lng: 113.061437, lat: 22.646192, province: "广东省", city: "江门市", brand: "小鹏" },
  { id: 'r15', name: "佛山顺德", lng: 113.233849, lat: 22.855788, province: "广东省", city: "佛山市", brand: "小鹏" },
  { id: 'r16', name: "广州黄埔宏景", lng: 113.527456, lat: 23.123841, province: "广东省", city: "广州市", brand: "小鹏" },
  { id: 'r17', name: "深圳光明汽车城", lng: 113.892348, lat: 22.743242, province: "广东省", city: "深圳市", brand: "理想" },
  { id: 'r18', name: "东莞高埗", lng: 113.72321, lat: 23.09715, province: "广东省", city: "东莞市", brand: "特斯拉" },
  { id: 'r19', name: "东莞塘厦", lng: 114.107091, lat: 22.839434, province: "广东省", city: "东莞市", brand: "特斯拉" },
  { id: 'r20', name: "佛山海八路", lng: 113.122258, lat: 23.068902, province: "广东省", city: "佛山市", brand: "小鹏" },
  { id: 'r21', name: "佛山南庄", lng: 113.018514, lat: 22.953093, province: "广东省", city: "佛山市", brand: "理想" },
  { id: 'r22', name: "佛山禅城", lng: 113.099998, lat: 22.995199, province: "广东省", city: "佛山市", brand: "理想" },
  { id: 'r23', name: "东莞厚街", lng: 113.69397, lat: 22.9629, province: "广东省", city: "东莞市", brand: "零跑" },
  { id: 'r24', name: "深圳龙岗联创", lng: 114.130596, lat: 22.632381, province: "广东省", city: "深圳市", brand: "理想" },
  { id: 'r25', name: "(新)广州白云", lng: 113.305405, lat: 23.233029, province: "广东省", city: "广州市", brand: "小鹏" },
  { id: 'r26', name: "梅州广梅路", lng: 116.06, lat: 24.28, province: "广东省", city: "梅州市", brand: "小鹏" },
  { id: 'r27', name: "(新)惠州惠南", lng: 114.458694, lat: 22.981004, province: "广东省", city: "惠州市", brand: "零跑" },
  { id: 'r28', name: "佛山顺德陈村", lng: 113.239972, lat: 22.940371, province: "广东省", city: "佛山市", brand: "特斯拉" },
  { id: 'r29', name: "广州龙溪大道", lng: 113.1936, lat: 23.06655, province: "广东省", city: "广州市", brand: "小鹏" },
  { id: 'r30', name: "河源大道", lng: 114.695674, lat: 23.71007, province: "广东省", city: "河源市", brand: "小鹏" },
  { id: 'r31', name: "广州广汕路", lng: 113.413917, lat: 23.191186, province: "广东省", city: "广州市", brand: "零跑" },
  { id: 'r32', name: "广州番禺大道", lng: 113.369716, lat: 22.961016, province: "广东省", city: "广州市", brand: "零跑" },
  { id: 'r33', name: "揭阳荣通", lng: 116.383996, lat: 23.568526, province: "广东省", city: "揭阳市", brand: "小鹏" },
  { id: 'r34', name: "(新)深圳宝安沙井", lng: 113.824899, lat: 22.70262, province: "广东省", city: "深圳市", brand: "特斯拉" },
  { id: 'r35', name: "中山火炬", lng: 113.454566, lat: 22.531575, province: "广东省", city: "中山市", brand: "零跑" },
  { id: 'r36', name: "深圳龙岗信义汽车城", lng: 114.225338, lat: 22.667128, province: "广东省", city: "深圳市", brand: "特斯拉" },
  { id: 'r37', name: "深圳福保", lng: 114.056644, lat: 22.502234, province: "广东省", city: "深圳市", brand: "零跑" },
  { id: 'r38', name: "阳江泰基汽车城", lng: 112.000326, lat: 21.84896, province: "广东省", city: "阳江市", brand: "小鹏" },
  { id: 'r39', name: "湛江海田", lng: 110.379001, lat: 21.28001, province: "广东省", city: "湛江市", brand: "小鹏" },
  { id: 'r40', name: "潮州潮汕路", lng: 116.600547, lat: 23.604497, province: "广东省", city: "潮州市", brand: "小鹏" },
  { id: 'r41', name: "珠海大道", lng: 113.475573, lat: 22.215222, province: "广东省", city: "珠海市", brand: "小鹏" },
  { id: 'r42', name: "云浮环市西路", lng: 112.014673, lat: 22.907496, province: "广东省", city: "云浮市", brand: "小鹏" },
  { id: 'r43', name: "佛山三水", lng: 112.919497, lat: 23.206418, province: "广东省", city: "佛山市", brand: "特斯拉" },
  { id: 'r44', name: "珠海美满汽车城", lng: 113.330576, lat: 22.119069, province: "广东省", city: "珠海市", brand: "小鹏" },
  { id: 'r45', name: "广州番禺钟村", lng: 113.300302, lat: 22.963414, province: "广东省", city: "广州市", brand: "零跑" },
  { id: 'r46', name: "广州黄埔", lng: 113.457734, lat: 23.14577, province: "广东省", city: "广州市", brand: "零跑" },
  { id: 'r47', name: "(新)韶关南郊汽车城", lng: 113.580218, lat: 24.733996, province: "广东省", city: "韶关市", brand: "小鹏" },
  { id: 'r48', name: "东莞松山湖", lng: 113.920554, lat: 22.972131, province: "广东省", city: "东莞市", brand: "零跑" },
  { id: 'r49', name: "汕尾大道", lng: 115.364751, lat: 22.828197, province: "广东省", city: "汕尾市", brand: "小鹏" },
  { id: 'r50', name: "广州大学城", lng: 113.372716, lat: 23.051283, province: "广东省", city: "广州市", brand: "理想" },
  { id: 'r51', name: "广州花都镜湖大道", lng: 113.249122, lat: 23.368543, province: "广东省", city: "广州市", brand: "理想" },
];

/** 本地 mock 仅用于调试 UI，给每条记录补上门店功能/类型/经营模式几个可选字段，方便测试多选筛选 */
const MOCK_FUNC = ['销售', '交付', '售后', '维修', '展示'];
const MOCK_TYPE = ['体验店', '服务中心', '交付中心', '城市展厅'];
const MOCK_MODEL = ['直营', '授权经营', '经销商'];

export const MOCK_POINTS: StorePoint[] = RAW_POINTS.map((p, i) => ({
  ...p,
  storeFunction: MOCK_FUNC[i % MOCK_FUNC.length],
  storeType: MOCK_TYPE[i % MOCK_TYPE.length],
  businessModel: MOCK_MODEL[i % MOCK_MODEL.length],
}));
