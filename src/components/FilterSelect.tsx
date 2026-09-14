import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  placeholder: string;
  /** 是否多选（品牌用，省份/城市单选） */
  multiple?: boolean;
  options: string[];
  /** 单选时为 string（'' 表示全部），多选时为 string[]（空数组表示全部） */
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** 下拉展开/收起时回调，便于父级在展开时避免自动收起 */
  onOpenChange?: (open: boolean) => void;
  /** 下拉面板中「全部」项的文案；不传则默认：多选「全部品牌」/ 单选「全部」 */
  allLabel?: string;
}

export default function FilterSelect({ placeholder, multiple, options, value, onChange, onOpenChange, allLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  const selectedArr = multiple ? (value as string[]) : [];
  const isAll = multiple ? selectedArr.length === 0 : value === '';

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        updateOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open) {
      setQuery('');
      // 等待面板渲染后聚焦
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const displayText = () => {
    if (multiple) {
      const arr = value as string[];
      if (arr.length === 0) return placeholder;
      if (arr.length === 1) return arr[0];
      return `已选 ${arr.length} 个`;
    }
    return value === '' ? placeholder : (value as string);
  };

  const toggle = (opt: string) => {
    if (multiple) {
      const arr = value as string[];
      const next = arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt];
      onChange(next);
    } else {
      onChange(opt === value ? '' : opt);
      updateOpen(false);
    }
    setQuery('');
  };

  const clearAll = () => {
    onChange(multiple ? [] : '');
    setQuery('');
  };

  return (
    <div className={'filter-select' + (open ? ' open' : '')} ref={wrapRef}>
      <button
        type="button"
        className={'filter-select-trigger' + (isAll ? '' : ' active')}
        onClick={() => updateOpen(!open)}
      >
        <span className="filter-select-text">{displayText()}</span>
        <span className="filter-select-caret">▾</span>
      </button>
      {open && (
        <div className="filter-select-panel">
          <input
            ref={inputRef}
            className="filter-select-search"
            placeholder="输入关键词搜索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-select-list">
            <div
              className={'filter-select-option' + (isAll ? ' selected' : '')}
              onClick={clearAll}
            >
              {allLabel ?? (multiple ? '全部品牌' : '全部')}
            </div>
            {filteredOptions.map((opt) => {
              const selected = multiple ? selectedArr.includes(opt) : value === opt;
              return (
                <div
                  key={opt}
                  className={'filter-select-option' + (selected ? ' selected' : '')}
                  onClick={() => toggle(opt)}
                >
                  {multiple && <span className="filter-select-check">{selected ? '✓' : ''}</span>}
                  <span className="filter-select-label">{opt}</span>
                </div>
              );
            })}
            {filteredOptions.length === 0 && <div className="filter-select-empty">无匹配项</div>}
          </div>
        </div>
      )}
    </div>
  );
}
