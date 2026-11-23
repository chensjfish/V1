import { useEffect, useState } from 'react';
import { bitable, dashboard } from '@lark-base-open/js-sdk';
import type { CoordSource, PluginConfig } from '../types';
import { isMock, MOCK_CONFIG } from '../mock';

interface Props {
  config: PluginConfig;
}

interface TableOption {
  id: string;
  name: string;
}
interface FieldOption {
  id: string;
  name: string;
  type: unknown;
}

export default function ConfigPanel({ config }: Props) {
  const [tables, setTables] = useState<TableOption[]>([]);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [ownFields, setOwnFields] = useState<FieldOption[]>([]);
  const [form, setForm] = useState<PluginConfig>({
    ...(config ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [tip, setTip] = useState('');
  const [tipKind, setTipKind] = useState<'info' | 'error' | 'success'>('info');

  const showTip = (msg: string, kind: 'info' | 'error' | 'success' = 'info') => {
    setTip(msg);
    setTipKind(kind);
  };

  useEffect(() => {
    if (isMock()) {
      setTables([{ id: 'mock', name: '门店经纬度（示例）' }]);
      setFields([
        { id: 'name', name: '门店名称', type: 1 },
        { id: 'lng', name: '经度', type: 2 },
        { id: 'lat', name: '纬度', type: 2 },
      ]);
      setForm(MOCK_CONFIG);
      return;
    }
    bitable.base
      .getTableList()
      .then(async (list) => {
        const opts = await Promise.all(
          list.map(async (t) => ({ id: t.id, name: await t.getName() })),
        );
        setTables(opts);
      })
      .catch((e) => showTip(`读取数据表失败：${e?.message ?? e}`, 'error'));
  }, []);

  useEffect(() => {
    if (isMock() || !form.tableId) return;
    bitable.base
      .getTableById(form.tableId)
      .then(async (t) => {
        const metas = await t.getFieldMetaList();
        setFields(
          metas.map((m: any) => ({ id: m.id, name: m.name ?? m.id, type: m.type })),
        );
      })
      .catch((e) => showTip(`读取字段失败：${e?.message ?? e}`, 'error'));
  }, [form.tableId]);

  // 保有量子表字段（与主表独立加载）
  useEffect(() => {
    if (isMock() || !form.ownershipTableId) {
      setOwnFields([]);
      return;
    }
    bitable.base
      .getTableById(form.ownershipTableId)
      .then(async (t) => {
        const metas = await t.getFieldMetaList();
        setOwnFields(
          metas.map((m: any) => ({ id: m.id, name: m.name ?? m.id, type: m.type })),
        );
      })
      .catch((e) => showTip(`读取保有量子表字段失败：${e?.message ?? e}`, 'error'));
  }, [form.ownershipTableId]);

  const update = (patch: Partial<PluginConfig>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setTip('');
    try {
      if (form.coordSource === 'location' && !form.locationFieldId) {
        showTip('请选择地理位置字段', 'error');
        return;
      }
      if (form.coordSource === 'lnglat' && (!form.lngFieldId || !form.latFieldId)) {
        showTip('请选择经度字段和纬度字段', 'error');
        return;
      }
      if (
        form.ownershipTableId &&
        (!form.ownershipProvinceFieldId ||
          !form.ownershipCityFieldId ||
          !form.ownershipDistrictFieldId ||
          !form.ownershipValueFieldId)
      ) {
        showTip('保有量子表已选，请同时配置省份/城市/区县/保有量四个字段', 'error');
        return;
      }
      if (isMock()) {
        showTip('本地 mock 模式下无法保存，请在飞书仪表盘中配置');
        return;
      }
      const current = await dashboard.getConfig().catch(() => null);
      await dashboard.saveConfig({
        dataConditions: current?.dataConditions ?? [],
        customConfig: { ...form },
      });
      showTip('配置已保存', 'success');
    } catch (e: any) {
      showTip(`保存失败：${e?.message ?? e}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="config">
      <div className="config-cols">
        <section className="config-col" data-kind="required">
          <div className="config-group-title">数据源</div>

          <div className="config-row">
            <label>数据表</label>
            <select
              value={form.tableId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                // 换表后旧字段 id 已失效，统一清空，避免保存出脏配置
                update({
                  tableId: id,
                  tableName: tables.find((t) => t.id === id)?.name,
                  nameFieldId: undefined,
                  locationFieldId: undefined,
                  lngFieldId: undefined,
                  latFieldId: undefined,
                  provinceFieldId: undefined,
                  cityFieldId: undefined,
                  brandFieldId: undefined,
                  funcFieldId: undefined,
                  typeFieldId: undefined,
                  modelFieldId: undefined,
                });
              }}
            >
              <option value="">请选择数据表</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-row">
            <label>坐标来源</label>
            <select
              value={form.coordSource ?? 'lnglat'}
              onChange={(e) =>
                update({
                  coordSource: e.target.value as CoordSource,
                  locationFieldId: undefined,
                  lngFieldId: undefined,
                  latFieldId: undefined,
                })
              }
            >
              <option value="lnglat">经度字段 + 纬度字段</option>
              <option value="location">单个地理位置字段</option>
            </select>
          </div>

      {form.coordSource === 'location' ? (
        <div className="config-row">
          <label>地理位置字段</label>
          <select
            value={form.locationFieldId ?? ''}
            onChange={(e) => update({ locationFieldId: e.target.value })}
          >
            <option value="">请选择字段</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="config-row">
            <label>经度字段</label>
            <select
              value={form.lngFieldId ?? ''}
              onChange={(e) => update({ lngFieldId: e.target.value })}
            >
              <option value="">请选择字段</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="config-row">
            <label>纬度字段</label>
            <select
              value={form.latFieldId ?? ''}
              onChange={(e) => update({ latFieldId: e.target.value })}
            >
              <option value="">请选择字段</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

          <div className="config-row">
            <label>门店名称字段</label>
            <select
              value={form.nameFieldId ?? ''}
              onChange={(e) => update({ nameFieldId: e.target.value })}
            >
              <option value="">（可选）不显示名称</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

        </section>

        <section className="config-col" data-kind="optional">
          <div className="config-group-title">可选-地图筛选</div>

      <div className="config-row">
        <label>省份字段</label>
        <select
          value={form.provinceFieldId ?? ''}
          onChange={(e) => update({ provinceFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用省份筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>城市字段</label>
        <select
          value={form.cityFieldId ?? ''}
          onChange={(e) => update({ cityFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用城市筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>品牌字段</label>
        <select
          value={form.brandFieldId ?? ''}
          onChange={(e) => update({ brandFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用品牌着色/筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>门店功能字段</label>
        <select
          value={form.funcFieldId ?? ''}
          onChange={(e) => update({ funcFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用门店功能筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>门店类型字段</label>
        <select
          value={form.typeFieldId ?? ''}
          onChange={(e) => update({ typeFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用门店类型筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>经营模式字段</label>
        <select
          value={form.modelFieldId ?? ''}
          onChange={(e) => update({ modelFieldId: e.target.value || undefined })}
        >
          <option value="">（可选）不启用经营模式筛选</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

        </section>

        <section className="config-col" data-kind="optional">
          <div className="config-group-title">可选-保有量</div>

          <div className="config-row">
            <label>保有量子表</label>
            <select
              value={form.ownershipTableId ?? ''}
              onChange={(e) => {
                const id = e.target.value || undefined;
                // 换子表后旧字段 id 已失效，清空避免匹配不到
                update({
                  ownershipTableId: id,
                  ownershipProvinceFieldId: undefined,
                  ownershipCityFieldId: undefined,
                  ownershipDistrictFieldId: undefined,
                  ownershipValueFieldId: undefined,
                });
              }}
            >
              <option value="">（可选）不显示保有量</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {!form.ownershipTableId && (
            <p className="config-hint">请先选择保有量子表，再配置下面的字段。</p>
          )}

          <div className="config-row">
            <label>省份字段（子表）</label>
            <select
              value={form.ownershipProvinceFieldId ?? ''}
              disabled={!form.ownershipTableId}
              onChange={(e) => update({ ownershipProvinceFieldId: e.target.value || undefined })}
            >
              <option value="">请选择省份字段</option>
              {ownFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-row">
            <label>城市字段（子表）</label>
            <select
              value={form.ownershipCityFieldId ?? ''}
              disabled={!form.ownershipTableId}
              onChange={(e) => update({ ownershipCityFieldId: e.target.value || undefined })}
            >
              <option value="">请选择城市字段</option>
              {ownFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-row">
            <label>区县字段（子表）</label>
            <select
              value={form.ownershipDistrictFieldId ?? ''}
              disabled={!form.ownershipTableId}
              onChange={(e) => update({ ownershipDistrictFieldId: e.target.value || undefined })}
            >
              <option value="">请选择区县字段</option>
              {ownFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-row">
            <label>保有量数值字段</label>
            <select
              value={form.ownershipValueFieldId ?? ''}
              disabled={!form.ownershipTableId}
              onChange={(e) => update({ ownershipValueFieldId: e.target.value || undefined })}
            >
              <option value="">请选择数值字段</option>
              {ownFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

        </section>
      </div>

      <div className="config-actions">
        <button className="config-save" disabled={saving} onClick={handleSave}>
          {saving ? '保存中…' : '保存配置'}
        </button>
        {tip && (
          <p className={'config-tip' + (tipKind !== 'info' ? ' is-' + tipKind : '')}>{tip}</p>
        )}
      </div>
    </div>
  );
}
