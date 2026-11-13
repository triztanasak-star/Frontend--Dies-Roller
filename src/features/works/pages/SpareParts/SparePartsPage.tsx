import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiDownload, FiPlus, FiTrash2, FiEye, FiEdit2, FiImage } from 'react-icons/fi';
import { MdQrCode2 } from 'react-icons/md';
import * as XLSX from 'xlsx';
import client from '../../../../lib/adapters/nodeAdapter';
import { useAuth } from '../../../../context/AuthContext';
import './spareParts.css';
import SparePartPlans, { PlanHistory, type ExecutionPlan } from './SparePartPlans';
import SparePartImages from './SparePartImages';
import { ImagePreview, SparePartQr } from './SparePartPreview';

const lines = ['PL#1', 'PL#2', 'PL#3', 'PL#4', 'PL#5', 'FFS', 'CORN'];
const columns = [
  ['system', 'Hệ thống'], ['equipment', 'Thiết bị'], ['specifications', 'Thông số kỹ thuật'],
  ['stock_quantity', 'Số lượng tồn'], ['in_use_quantity', 'Số lượng đang sử dụng'],
  ['supplier', 'Supplier'], ['price_vnd', 'Price (VNĐ)'], ['standard_ton', 'Standard (ton)'],
  ['life_ton', 'Số tấn đã sử dụng'], ['line_in_use', 'Line - Nguyên liệu sử dụng'], ['created_at', 'Ngày tạo'],
  ['image_before', 'Image before'], ['note', 'Ghi chú'],
] as const;
const tableColumns = columns.filter(([key]) => !['created_at', 'image_before', 'note'].includes(key))
  .flatMap(([key, label]): readonly (readonly [keyof Part | 'remaining_tons' | 'price_per_ton', string])[] =>
    key === 'life_ton' ? [[key, label], ['remaining_tons', 'Số tấn còn lại'], ['price_per_ton', 'VNĐ/tấn']] : [[key, label]]);
export type Part = {
  id?: number; system: string; equipment: string; specifications: string;
  stock_quantity: number; in_use_quantity: number; supplier: string; price_vnd: number;
  standard_ton: number; life_ton: number; line_in_use: string[]; created_at: string;
  image_before: string; image_after: string; execution_plans: ExecutionPlan[]; status: string; note: string;
};
const numeric = ['stock_quantity', 'in_use_quantity', 'price_vnd', 'standard_ton', 'life_ton'];
const hasNumber = (value: unknown) => value !== '' && value != null && Number.isFinite(Number(value));
function tableValue(part: Part, key: keyof Part | 'remaining_tons' | 'price_per_ton'): string | number {
  const remaining = Number(part.standard_ton) - Number(part.life_ton);
  if (key === 'remaining_tons') return remaining;
  if (key === 'price_per_ton') return Number(part.life_ton) === 0 ? '—' : Number(part.price_vnd) / Number(part.life_ton);
  if (key === 'line_in_use') return part.line_in_use.join(', ');
  if (numeric.includes(key)) return Number(part[key]);
  return String(part[key] ?? '');
}
const blank = (): Part => ({ system: '', equipment: '', specifications: '', stock_quantity: 0,
  in_use_quantity: 0, supplier: '', price_vnd: 0, standard_ton: 0, life_ton: 0,
  line_in_use: [], created_at: new Date().toISOString(), image_before: '', image_after: '', execution_plans: [], status: 'Trong kho', note: '' });
const message = (e: unknown) => {
  if (isAxiosError(e)) {
    if (e.response?.status === 413) return 'Dữ liệu ảnh quá lớn. Vui lòng giảm kích thước ảnh rồi lưu lại.';
    if (typeof e.response?.data?.message === 'string') return e.response.data.message;
  }
  return e instanceof Error ? e.message : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
};

export default function SparePartsPage() {
  const { can } = useAuth();
  const editable = can('manager-or-admin');
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['spare-parts'], queryFn: async () => (await client.get<Part[]>('/api/spare-parts')).data });
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState('');
  const [line, setLine] = useState('');
  const [equipment, setEquipment] = useState('');
  const [supplier, setSupplier] = useState('');
  const [year, setYear] = useState('');
  const [stockQuantities, setStockQuantities] = useState<number[]>([]);
  const [inUseQuantities, setInUseQuantities] = useState<number[]>([]);
  const [draft, setDraft] = useState<Part | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ src: string; label: string } | null>(null);
  const [qrPart, setQrPart] = useState<Part | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeQuantityFilters = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const target = event.target;
      toolbarRef.current?.querySelectorAll<HTMLDetailsElement>('.spare-quantity-filter[open]').forEach(filter => {
        if (!filter.contains(target)) filter.open = false;
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      toolbarRef.current?.querySelectorAll<HTMLDetailsElement>('.spare-quantity-filter[open]').forEach(filter => {
        filter.open = false;
        filter.querySelector<HTMLElement>('summary')?.focus();
      });
    };
    document.addEventListener('pointerdown', closeQuantityFilters);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeQuantityFilters);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  function showError(text: string) {
    setError(text);
    formRef.current?.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const records = query.data ?? [];
  const remainingTons = draft && hasNumber(draft.standard_ton) && hasNumber(draft.life_ton)
    ? Number(draft.standard_ton) - Number(draft.life_ton) : null;
  const pricePerTon = draft && hasNumber(draft.life_ton) && Number(draft.life_ton) !== 0 && hasNumber(draft.price_vnd)
    ? Number(draft.price_vnd) / Number(draft.life_ton) : null;
  const filtered = records.filter(p => (!system || p.system === system) && (!equipment || p.equipment === equipment) && (!supplier || p.supplier === supplier) && (!year || String(new Date(p.created_at).getFullYear()) === year)
    && (!line || p.line_in_use.includes(line))
    && (!stockQuantities.length || stockQuantities.includes(Number(p.stock_quantity)))
    && (!inUseQuantities.length || inUseQuantities.includes(Number(p.in_use_quantity)))
    && [p.system, p.equipment, p.specifications, p.supplier, p.note].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  const open = (part: Part, view = false) => { setDraft({ ...part, image_after: part.image_after ?? '', execution_plans: (part.execution_plans ?? []).map(p => ({ ...p })) }); setReadOnly(view); setError(''); };
  const update = (key: keyof Part, value: unknown) => setDraft(p => p ? { ...p, [key]: value } : p);
  async function uploadImage(key: 'image_before' | 'image_after', file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('Ch\u1ecdn \u1ea3nh PNG, JPEG ho\u1eb7c WebP t\u1ed1i \u0111a 3 MB.'); return;
    }
    setImageBusy(true); setError('');
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c \u1ea3nh.')); reader.readAsDataURL(file);
      });
      update(key, data);
    } catch (e) { setError(message(e)); } finally { setImageBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || readOnly || imageBusy) return;
    if (!draft.system.trim() || !draft.equipment.trim()) {
      showError('Vui lòng nhập đầy đủ Hệ thống và Thiết bị trước khi lưu.');
      formRef.current?.querySelector<HTMLInputElement>(!draft.system.trim() ? '#part-system' : '#part-equipment')?.focus();
      return;
    }
    if (numeric.some(key => {
      const value = draft[key as keyof Part];
      return value === '' || !Number.isFinite(Number(value)) || Number(value) < 0;
    })) { showError('Vui lòng nhập các trường số với giá trị lớn hơn hoặc bằng 0.'); return; }
    if (!formRef.current?.checkValidity()) {
      showError('Có trường chưa hợp lệ. Kiểm tra số lượng nguyên, ngày tạo và các hạng mục thực hiện.');
      formRef.current?.reportValidity();
      return;
    }
    if (draft.execution_plans.some(p => !p.name.trim())) { setError('Vui l\u00f2ng nh\u1eadp t\u00ean h\u1ea1ng m\u1ee5c.'); return; }
    setBusy(true); setError('');
    try {
      const payload = { ...draft, system: draft.system.trim(), equipment: draft.equipment.trim(),
        price_vnd: Number(draft.price_vnd), standard_ton: Number(draft.standard_ton), life_ton: Number(draft.life_ton) };
      if (draft.id) await client.put(`/api/spare-parts/${draft.id}`, payload);
      else await client.post('/api/spare-parts', payload);
      await cache.invalidateQueries({ queryKey: ['spare-parts'] }); setDraft(null);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function remove(part: Part) {
    if (!window.confirm(`Xóa phụ tùng “${part.equipment}”?`)) return;
    setBusy(true); setError('');
    try { await client.delete(`/api/spare-parts/${part.id}`); await cache.invalidateQueries({ queryKey: ['spare-parts'] }); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  function exportExcel() {
    const data = filtered.map(p => Object.fromEntries(tableColumns.map(([key, label]) => [label, tableValue(p, key)])));
    data.forEach((row, index) => { row['L\u1ecbch s\u1eed'] = (filtered[index].execution_plans ?? []).map(p => `${p.name}: ${p.tons} ton (${p.due_date || '\u2014'})`).join('\n'); });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), 'Phụ tùng');
    XLSX.writeFile(book, 'Quan-ly-phu-tung.xlsx');
  }
  return <div className="spare-parts-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div className="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <h4 className="h4 mb-0">Quản lý phụ tùng</h4>
      <div className="d-flex gap-2">
        <button className="btn btn-outline-primary" onClick={exportExcel} disabled={!filtered.length}><FiDownload /> Xuất Excel</button>
        {editable && <button className="btn btn-primary" onClick={() => open(blank())}><FiPlus /> Thêm phụ tùng</button>}
      </div>
    </div>
    {!draft && error && <div className="alert alert-danger" role="alert">{error}</div>}
    <div className="data-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div ref={toolbarRef} className="data-table-toolbar d-flex flex-wrap gap-2 p-3">
        <input className="form-control progress-modal-input" style={{ flex: '1 1 250px' }} aria-label="Tìm phụ tùng" placeholder="Tìm hệ thống, thiết bị, thông số, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select w-auto" aria-label="Lọc hệ thống" value={system} onChange={e => setSystem(e.target.value)}><option value="">Tất cả hệ thống</option>{[...new Set(records.map(p => p.system))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <select className="form-select w-auto" aria-label="Lọc Line - Nguyên liệu sử dụng" value={line} onChange={e => setLine(e.target.value)}><option value="">Tất cả Line - Nguyên liệu</option>{lines.map(s => <option key={s}>{s}</option>)}</select>
        <select className="form-select w-auto" aria-label="Lọc thiết bị" value={equipment} onChange={e => setEquipment(e.target.value)}><option value="">Tất cả thiết bị</option>{[...new Set(records.map(p => p.equipment))].sort().map(s => <option key={s}>{s}</option>)}</select>
        <select className="form-select w-auto" aria-label="Lọc supplier" value={supplier} onChange={e => setSupplier(e.target.value)}><option value="">Tất cả Supplier</option>{[...new Set(records.map(p => p.supplier))].filter(Boolean).sort().map(s => <option key={s}>{s}</option>)}</select>
        <select className="form-select w-auto" aria-label="Lọc năm" value={year} onChange={e => setYear(e.target.value)}><option value="">Tất cả năm</option>{[...new Set(records.map(p => String(new Date(p.created_at).getFullYear())))].sort().reverse().map(s => <option key={s}>{s}</option>)}</select>
        {([
          ['stock_quantity', 'Số lượng tồn', stockQuantities, setStockQuantities],
          ['in_use_quantity', 'Số lượng đang sử dụng', inUseQuantities, setInUseQuantities],
        ] as const).map(([key, label, selected, setSelected]) => <details className="spare-quantity-filter" key={key}>
          <summary className="form-select w-auto" aria-label={`Lọc ${label.toLowerCase()}`} title={label}>{label}: {selected.length ? `${selected.length} đã chọn` : 'Tất cả'}</summary>
          <div className="spare-quantity-options" role="group" aria-label={`Lọc ${label.toLowerCase()}`}>
            <button type="button" className="btn btn-link spare-quantity-clear" onClick={() => setSelected([])}>× Bỏ chọn tất cả</button>
            {[...new Set(records.map(p => Number(p[key])))].sort((a, b) => a - b).map(value => <label className="d-flex align-items-center gap-2" key={value}>
              <input type="checkbox" checked={selected.includes(value)} onChange={e => setSelected(current => e.target.checked ? [...current, value].sort((a, b) => a - b) : current.filter(v => v !== value))} />{value.toLocaleString('vi-VN')}
            </label>)}
          </div>
        </details>)}
      </div>
      {query.isPending ? <div className="p-4 text-center" role="status">Đang tải dữ liệu…</div> : query.isError ? <div className="p-4 text-center" role="alert">Không thể tải phụ tùng. <button className="btn btn-link" onClick={() => query.refetch()}>Thử lại</button></div> : <>
        <div className="table-responsive-wrap" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table className="table align-middle mb-0" style={{ tableLayout: 'fixed', width: '100%', minWidth: 1400 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg, #1a1d2e)', zIndex: 10 }}><tr><th style={{ width: 45 }}>STT</th>{tableColumns.map(([key, label]) => <th key={key} style={{ width: key === 'specifications' ? 160 : 100 }}>{label}</th>)}<th style={{ width: 240 }}>Lịch sử</th><th style={{ width: 150 }}>Thao tác</th></tr></thead>
            <tbody>{filtered.length === 0 ? <tr><td colSpan={tableColumns.length + 3} className="text-center py-5">{records.length ? 'Không có phụ tùng phù hợp với bộ lọc.' : 'Chưa có phụ tùng.'}</td></tr> : filtered.map((part, i) => <tr key={part.id}>
              <td>{i + 1}</td>{tableColumns.map(([key]) => <td key={key} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: 240 }}>
                {typeof tableValue(part, key) === 'number' ? <span className={key === 'remaining_tons' && Number(tableValue(part, key)) < 0 ? 'text-danger fw-semibold' : ''}>{Number(tableValue(part, key)).toLocaleString('vi-VN', { maximumFractionDigits: key === 'price_per_ton' ? 2 : 6 })}</span> : tableValue(part, key)}
              </td>)}<td style={{ textAlign: 'left', fontSize: '0.8rem' }}><PlanHistory plans={part.execution_plans ?? []} /></td><td><div className="d-flex justify-content-center align-items-center gap-1">
                <button className="btn btn-sm btn-link p-0" title="Xem mã QR" aria-label="Xem mã QR" onClick={() => setQrPart(part)}><MdQrCode2 /></button>
                <button className="btn btn-sm btn-link p-0" title="Xem chi tiết" aria-label="Xem chi tiết" onClick={() => open(part, true)}><FiEye /></button>
                {part.image_after && <button className="btn btn-sm btn-link p-0" title="Xem hình sau làm mới nhất" aria-label="Xem hình sau làm mới nhất" onClick={() => setZoomImage({ src: part.image_after, label: `Hình sau làm — ${part.equipment}` })}><FiImage /></button>}
                {editable && <><button className="btn btn-sm btn-link p-0" title="Cập nhật phụ tùng" aria-label="Cập nhật phụ tùng" disabled={busy} onClick={() => open(part)}><FiEdit2 /></button><button className="btn btn-sm btn-link text-danger p-0" title="Xóa phụ tùng" aria-label="Xóa phụ tùng" disabled={busy} onClick={() => remove(part)}><FiTrash2 /></button></>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div><div className="p-3 text-muted">Hiển thị {filtered.length} / {records.length} phụ tùng</div>
      </>}
    </div>
    {draft && <div className="modal d-block spare-part-modal" role="dialog" aria-modal="true" aria-labelledby="spare-part-title" style={{ background: 'rgba(0,0,0,.55)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable"><form ref={formRef} className="modal-content" noValidate onSubmit={save}>
        <div className="modal-header"><h5 className="modal-title" id="spare-part-title">{readOnly ? 'Chi tiết phụ tùng' : draft.id ? `Cập nhật phụ tùng — ${draft.equipment}` : 'Thêm phụ tùng'}</h5><button type="button" className="btn-close" aria-label="Đóng" disabled={busy || imageBusy} onClick={() => setDraft(null)} /></div>
        <div className="modal-body">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <fieldset disabled={readOnly || busy || imageBusy}><div className="row g-3"><div className="col-12"><h6 className="text-muted mb-2">Thông tin phụ tùng</h6></div>
            {columns.filter(([key]) => key !== 'image_before').map(([key, label]) => <Fragment key={key}>{key === 'created_at' && <>
            <div className="col-md-3">
              <label className="form-label" htmlFor="part-remaining-tons">Số tấn còn lại (ton)</label>
              <input id="part-remaining-tons" className={`form-control progress-modal-input ${remainingTons !== null && remainingTons < 0 ? 'text-danger' : ''}`} readOnly value={remainingTons !== null && Number.isFinite(remainingTons) ? remainingTons.toLocaleString('vi-VN', { maximumFractionDigits: 6 }) : '—'} />
              <small className="text-muted">Standard − Life (ton)</small>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="part-price-per-ton">VNĐ/tấn</label>
              <input id="part-price-per-ton" className="form-control progress-modal-input" readOnly value={pricePerTon !== null && Number.isFinite(pricePerTon) ? pricePerTon.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—'} />
              <small className="text-muted">{hasNumber(draft.life_ton) && Number(draft.life_ton) === 0 ? 'Số tấn đã sử dụng bằng 0, không thể chia.' : 'Price ÷ Số tấn đã sử dụng'}</small>
            </div>
            <div className="col-12" />
            </>}<div className={['note', 'image_before'].includes(key) ? 'col-12' : ['system', 'equipment', 'specifications', 'supplier'].includes(key) ? 'col-md-4' : 'col-md-3'} key={key}>
              <label className="form-label" htmlFor={`part-${key}`}>{label}{['system', 'equipment'].includes(key) && ' *'}</label>
              {key === 'line_in_use' ? <div id={`part-${key}`} className="d-flex flex-wrap gap-3">{lines.map(l => <label className="form-check" key={l}><input className="form-check-input" type="checkbox" checked={draft.line_in_use.includes(l)} onChange={e => update(key, e.target.checked ? [...draft.line_in_use, l] : draft.line_in_use.filter(v => v !== l))} /><span className="form-check-label">{l}</span></label>)}</div>
              : key === 'note' || key === 'specifications' ? <textarea id={`part-${key}`} className="form-control progress-modal-input" rows={3} value={draft[key]} onChange={e => update(key, e.target.value)} />
              : key === 'created_at' ? <input id={`part-${key}`} className="form-control progress-modal-input" type="date" required value={draft.created_at ? new Date(draft.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''} onChange={e => update(key, e.target.value ? new Date(`${e.target.value}T00:00:00+07:00`).toISOString() : '')} />
              : <input id={`part-${key}`} className="form-control progress-modal-input" type={numeric.includes(key) ? 'number' : 'text'} min={numeric.includes(key) ? 0 : undefined} step={key.includes('quantity') ? 1 : 'any'} required={['system', 'equipment'].includes(key) || numeric.includes(key)} value={draft[key]} onChange={e => update(key, numeric.includes(key) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
            </div></Fragment>)}
          </div></fieldset>
          <SparePartImages before={draft.image_before} after={draft.image_after} readOnly={readOnly} disabled={busy || imageBusy} onUpload={uploadImage} onRemove={key => update(key, '')} />
          <SparePartPlans key={draft.id ?? 'new'} plans={draft.execution_plans} onChange={plans => update('execution_plans', plans)} disabled={busy || imageBusy} readOnly={readOnly} />
        </div>
        <div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={busy || imageBusy} onClick={() => setDraft(null)}>Đóng</button>{!readOnly && <button className="btn btn-primary" disabled={busy || imageBusy}>{busy ? 'Đang lưu…' : draft.id ? 'Lưu cập nhật' : 'Lưu phụ tùng'}</button>}</div>
      </form></div>
    </div>}
    {zoomImage && <ImagePreview src={zoomImage.src} label={zoomImage.label} onClose={() => setZoomImage(null)} />}
    {qrPart?.id && <SparePartQr id={qrPart.id} equipment={qrPart.equipment} system={qrPart.system} onClose={() => setQrPart(null)} />}
  </div>;
}
