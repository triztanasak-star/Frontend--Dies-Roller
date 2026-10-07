import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DigitalWork, Project, User } from '../../../lib/db';

function MultiNameInput({
  value,
  onChange,
  users,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = value.split(',');
  const lastRaw = segments[segments.length - 1];
  const last = lastRaw.trim().toLowerCase();
  const chosen = segments
    .slice(0, -1)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const suggestions = users
    .filter((u) => {
      const name = (u.name ?? u.email ?? '').trim();
      if (!name) return false;
      const lname = name.toLowerCase();
      if (chosen.includes(lname)) return false;
      return !last || lname.includes(last);
    })
    .slice(0, 8);

  const handleSelect = (name: string) => {
    const prefix = segments.slice(0, -1).join(',').trim();
    const newValue = (prefix ? `${prefix}, ` : '') + name + ', ';
    onChange(newValue);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && suggestions.length > 0 && (
        <div
          className="shadow"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: '2px',
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'var(--card-bg, #1a1d2e)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '6px',
          }}
        >
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              className="dropdown-item"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px' }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                handleSelect(u.name ?? u.email);
              }}
            >
              {u.name ?? u.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface WorkFormValues {
  task_name: string;
  factory_name: string;
  description: string;
  priority: string;
  lead_project: string;
  assistant: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string;
  assigned_to: string;
  support_id: string;
  project_id: string;
  expected_deadline: string;
  files: File[];

  dies_model: string;
  dies_hole_mm: string;
  press_length_mm: string;
  ld_ratio: string;
  dies_code: string;
  supplier: string;
  dies_price_vnd: string;
  standard_ton: string;
  dies_life_ton: string;
  line_in_use: string;
  timestamp: string;
  image_before_url: string;
  status: string;
  symptom: string;

  remaining_tons: string;
  price_per_ton_vnd: string;
  result_cost_per_ton_vnd: string;
  capex_amount: string;
  estimated_saving_per_year: string;
  payback_years: string;
}

export interface WorkFormModalHandle {
  openCreate: () => void;
  openEdit: (work: DigitalWork) => void;
  openAssign: (work: DigitalWork) => void;
  close: () => void;
}

interface Props {
  projects: Project[];
  users: User[];
  onSubmit: (values: WorkFormValues, editingId: number | null, isAssignMode: boolean) => Promise<void>;
}

const getInitialValues = (): WorkFormValues => ({
  task_name: '',
  factory_name: '',
  description: '',
  priority: 'medium',
  lead_project: '',
  assistant: '',
  representative_name: '',
  representative_email: '',
  representative_phone: '',
  assigned_to: '',
  support_id: '',
  project_id: '',
  expected_deadline: '',
  files: [],

  dies_model: '',
  dies_hole_mm: '',
  press_length_mm: '',
  ld_ratio: '',
  dies_code: '',
  supplier: '',
  dies_price_vnd: '',
  standard_ton: '',
  dies_life_ton: '',
  line_in_use: '',
  timestamp: new Date().toISOString().slice(0, 16),
  image_before_url: '',
  status: 'Trong kho',
  symptom: '',

  remaining_tons: '',
  price_per_ton_vnd: '',
  result_cost_per_ton_vnd: '',
  capex_amount: '',
  estimated_saving_per_year: '',
  payback_years: '',
});

const DIES_MODEL_OPTIONS = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];
const DIES_HOLE_OPTIONS = ['2.5', '2.8', '3.5', '4.0'];
const PRESS_LENGTH_OPTIONS = [
  '60-0', '60-5', '60-10', '60-15', '60-20', '60-45',
  '65-0', '65-5', '65-10', '65-15', '65-45', '65-50',
  '70-0', '70-5', '75-0'
];
const LD_RATIO_OPTIONS = [
  '4.3', '5.7', '12.5', '13.3', '13.8', '14.0',
  '14.3', '15.0', '15.7', '16.0', '16.1', '16.3',
  '17.9', '18.0', '18.6', '18.8', '19.6', '20.0'
];
const SUPPLIER_OPTIONS = [
  'GRAF', 'MUNCH', 'JUMELIA', 'SHZY', 'FAMSUN', 'CPM', 'KPI',
  'BUHLER', 'ANDRITZ', 'PCE', 'SALMATEC', 'HOANG THIEN', 'HAYNE',
  'JACOB', 'FEROTECH', 'LAMECCANICA', 'VIETNAM LOCAL'
];
const LINE_OPTIONS = ['PL#1', 'PL#2', 'PL#3', 'PL#4', 'PL#5'];

const STATUS_OPTIONS = [
  'Trong kho',
  'Đang sử dụng',
  'Chờ mài',
  'Chờ sử dụng',
  'Hết tuổi thọ',
  'Hư bể',
  'Đang đặt'
];

// ✅ MAP status string → số để lưu DB
const STATUS_MAP: Record<string, number> = {
  'Trong kho': 0,
  'Đang sử dụng': 1,
  'Chờ mài': 2,
  'Chờ sử dụng': 3,
  'Hết tuổi thọ': 4,
  'Hư bể': 5,
  'Đang đặt': 6,
};

const FACTORY_OPTIONS = [
  'Nhà máy Tiền Giang', 'Nhà máy Đồng Nai', 'Nhà máy Bào Xéo',
  'Nhà máy Bình Phước', 'Nhà máy Bình Dương', 'Nhà máy Bình Định',
  'Nhà máy Hải Dương', 'Nhà máy Xuân Mai',
];

const WorkFormModal = forwardRef<WorkFormModalHandle, Props>(({ users, onSubmit }, ref) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [values, setValues] = useState<WorkFormValues>(getInitialValues());
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    openCreate: () => {
      setEditingId(null);
      setIsAssignMode(false);
      setValues(getInitialValues());
      setIsOpen(true);
    },
    openEdit: (work: DigitalWork & Record<string, any>) => {
      setEditingId(work.id);
      setIsAssignMode(false);
      setValues({
        ...getInitialValues(),
        task_name: work.task_name ?? '',
        factory_name: work.factory_name ?? '',
        description: work.description ?? '',
        priority: work.priority ?? 'medium',
        lead_project: work.lead_project ?? '',
        assistant: work.assistant ?? '',
        representative_name: work.representative_name ?? '',
        representative_email: work.representative_email ?? '',
        representative_phone: work.representative_phone ?? '',
        project_id: work.project_id ? String(work.project_id) : '',
        expected_deadline: work.expected_deadline ? work.expected_deadline.split('T')[0] : '',

        dies_model: work.dies_model ?? '',
        dies_hole_mm: work.dies_hole_mm != null ? String(work.dies_hole_mm) : '',
        press_length_mm: work.press_length_mm ?? '',
        ld_ratio: work.ld_ratio != null ? String(work.ld_ratio) : '',
        dies_code: work.dies_code ?? '',
        supplier: work.supplier ?? '',
        dies_price_vnd: work.dies_price_vnd != null ? String(work.dies_price_vnd) : '',
        standard_ton: work.standard_ton != null ? String(work.standard_ton) : '',
        dies_life_ton: work.dies_life_ton != null ? String(work.dies_life_ton) : '',
        line_in_use: work.line_in_use ?? '',
        symptom: work.symptom ?? '',

        // ✅ Reverse map: số → string
        status:
          work.status === 0 ? 'Trong kho'
          : work.status === 1 ? 'Đang sử dụng'
          : work.status === 2 ? 'Chờ mài'
          : work.status === 3 ? 'Chờ sử dụng'
          : work.status === 4 ? 'Hết tuổi thọ'
          : work.status === 5 ? 'Hư bể'
          : work.status === 6 ? 'Đang đặt'
          : 'Trong kho',

        remaining_tons: work.remaining_tons != null ? String(work.remaining_tons) : '',
        price_per_ton_vnd: work.price_per_ton_vnd != null ? String(work.price_per_ton_vnd) : '',
        result_cost_per_ton_vnd: work.result_cost_per_ton_vnd != null ? String(work.result_cost_per_ton_vnd) : '',
      });
      setIsOpen(true);
    },
    openAssign: (work: DigitalWork & Record<string, any>) => {
      setEditingId(work.id);
      setIsAssignMode(true);
      setValues({
        ...getInitialValues(),
        task_name: work.task_name ?? '',
        factory_name: work.factory_name ?? '',
        description: work.description ?? '',
        priority: work.priority ?? 'medium',
        lead_project: work.lead_project ?? work.assigned_to_name ?? '',
        assistant: work.assistant ?? work.support_name ?? '',
        representative_name: work.representative_name ?? '',
        representative_email: work.representative_email ?? '',
        representative_phone: work.representative_phone ?? '',
        project_id: work.project_id ? String(work.project_id) : '',
        expected_deadline: work.expected_deadline ? work.expected_deadline.split('T')[0] : '',

        dies_model: work.dies_model ?? '',
        dies_hole_mm: work.dies_hole_mm != null ? String(work.dies_hole_mm) : '',
        press_length_mm: work.press_length_mm ?? '',
        ld_ratio: work.ld_ratio != null ? String(work.ld_ratio) : '',
        dies_code: work.dies_code ?? '',
        supplier: work.supplier ?? '',
        dies_price_vnd: work.dies_price_vnd != null ? String(work.dies_price_vnd) : '',
        standard_ton: work.standard_ton != null ? String(work.standard_ton) : '',
        dies_life_ton: work.dies_life_ton != null ? String(work.dies_life_ton) : '',
        line_in_use: work.line_in_use ?? '',
        symptom: work.symptom ?? '',

        status:
          work.status === 0 ? 'Trong kho'
          : work.status === 1 ? 'Đang sử dụng'
          : work.status === 2 ? 'Chờ mài'
          : work.status === 3 ? 'Chờ sử dụng'
          : work.status === 4 ? 'Hết tuổi thọ'
          : work.status === 5 ? 'Hư bể'
          : work.status === 6 ? 'Đang đặt'
          : 'Trong kho',

        remaining_tons: work.remaining_tons != null ? String(work.remaining_tons) : '',
        price_per_ton_vnd: work.price_per_ton_vnd != null ? String(work.price_per_ton_vnd) : '',
        result_cost_per_ton_vnd: work.result_cost_per_ton_vnd != null ? String(work.result_cost_per_ton_vnd) : '',
      });
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  }));

  useEffect(() => {
    const parseNum = (v: string): number => {
      if (!v) return 0;
      const n = Number(String(v).trim());
      return isNaN(n) ? 0 : n;
    };

    const std = parseNum(values.standard_ton);
    const life = parseNum(values.dies_life_ton);
    const price = parseNum(values.dies_price_vnd);

    const remaining = std && life ? String(std - life) : '';
    const pricePerTon = life > 0 ? String(price / life) : '';
    const resultCost = life > 0 ? String(price / life) : '';

    setValues((prev) => {
      if (
        prev.remaining_tons === remaining &&
        prev.price_per_ton_vnd === pricePerTon &&
        prev.result_cost_per_ton_vnd === resultCost
      ) {
        return prev;
      }
      return {
        ...prev,
        remaining_tons: remaining,
        price_per_ton_vnd: pricePerTon,
        result_cost_per_ton_vnd: resultCost,
      };
    });
  }, [values.standard_ton, values.dies_life_ton, values.dies_price_vnd]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      // ✅ Chuyển status string → số string
      const statusNumber = STATUS_MAP[values.status] ?? 0;
      const enriched: WorkFormValues = {
        ...values,
        status: String(statusNumber),
      };

      console.log('📤 WorkFormModal gửi:', enriched);
      await onSubmit(enriched, editingId, isAssignMode);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                {isAssignMode ? t('workForm.titleAssign') : editingId ? t('workForm.titleEdit') : 'Thêm Die Mới'}
              </h5>
              <button type="button" className="btn-close" onClick={() => setIsOpen(false)} />
            </div>

            <div className="modal-body">
              {isAssignMode ? (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.taskName')}</label>
                    <input type="text" className="form-control" required value={values.task_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, task_name: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.factory')}</label>
                    <input type="text" className="form-control" list="factory-list-assign" value={values.factory_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, factory_name: e.target.value }))} />
                    <datalist id="factory-list-assign">
                      {FACTORY_OPTIONS.map((f) => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.priority')}</label>
                    <select className="form-select" value={values.priority}
                      onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}>
                      <option value="high">{t('common.priority.high')}</option>
                      <option value="medium">{t('common.priority.medium')}</option>
                      <option value="low">{t('common.priority.low')}</option>
                    </select>
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">{t('workForm.description')}</label>
                    <textarea className="form-control" rows={3} value={values.description}
                      onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Dies Model</label>
                    <input type="text" className="form-control" list="dies-model-list" value={values.dies_model}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_model: e.target.value }))} />
                    <datalist id="dies-model-list">
                      {DIES_MODEL_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Dies Code</label>
                    <input type="text" className="form-control" value={values.dies_code}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_code: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Supplier</label>
                    <input type="text" className="form-control" list="supplier-list" value={values.supplier}
                      onChange={(e) => setValues((prev) => ({ ...prev, supplier: e.target.value }))} />
                    <datalist id="supplier-list">
                      {SUPPLIER_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Line in use</label>
                    <input type="text" className="form-control" list="line-list" value={values.line_in_use}
                      onChange={(e) => setValues((prev) => ({ ...prev, line_in_use: e.target.value }))} />
                    <datalist id="line-list">
                      {LINE_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.pic')}</label>
                    <MultiNameInput users={users} placeholder={t('workForm.picPlaceholder')} value={values.lead_project}
                      onChange={(val) => setValues((prev) => ({ ...prev, lead_project: val, assigned_to: '' }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.support')}</label>
                    <MultiNameInput users={users} placeholder={t('workForm.supportPlaceholder')} value={values.assistant}
                      onChange={(val) => setValues((prev) => ({ ...prev, assistant: val, support_id: '' }))} />
                  </div>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Dies Model</label>
                    <input type="text" className="form-control" list="dies-model-list" value={values.dies_model}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_model: e.target.value }))}
                      placeholder="Chọn hoặc nhập Model" />
                    <datalist id="dies-model-list">
                      {DIES_MODEL_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Dies Code (Mã khuôn)</label>
                    <input type="text" className="form-control" value={values.dies_code}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_code: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Supplier</label>
                    <input type="text" className="form-control" list="supplier-list" value={values.supplier}
                      onChange={(e) => setValues((prev) => ({ ...prev, supplier: e.target.value }))}
                      placeholder="Chọn hoặc nhập Nhà cung cấp" />
                    <datalist id="supplier-list">
                      {SUPPLIER_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Dies Hole (mm)</label>
                    <input type="text" className="form-control" list="hole-list" value={values.dies_hole_mm}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_hole_mm: e.target.value }))}
                      placeholder="VD: 2.5, 2.8" />
                    <datalist id="hole-list">
                      {DIES_HOLE_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Press Length (mm)</label>
                    <input
                      type="text"
                      className="form-control"
                      list="press-length-list"
                      value={values.press_length_mm}
                      onChange={(e) => setValues((prev) => ({ ...prev, press_length_mm: e.target.value }))}
                      placeholder="VD: 60-0, 55-2..."
                    />
                    <datalist id="press-length-list">
                      {PRESS_LENGTH_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">L/D RATIO</label>
                    <input
                      type="text"
                      className="form-control"
                      list="ld-ratio-list"
                      value={values.ld_ratio}
                      onChange={(e) => setValues((prev) => ({ ...prev, ld_ratio: e.target.value }))}
                      placeholder="VD: 4.3, 5.7..."
                    />
                    <datalist id="ld-ratio-list">
                      {LD_RATIO_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Line in use (chọn nhiều)</label>
                    <input type="text" className="form-control" list="line-list" value={values.line_in_use}
                      onChange={(e) => setValues((prev) => ({ ...prev, line_in_use: e.target.value }))}
                      placeholder="VD: PL#1, PL#2" />
                    <datalist id="line-list">
                      {LINE_OPTIONS.map((opt) => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Standard (ton)</label>
                    <input type="number" className="form-control" value={values.standard_ton}
                      onChange={(e) => setValues((prev) => ({ ...prev, standard_ton: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Dies Life (ton)</label>
                    <input type="number" className="form-control" value={values.dies_life_ton}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_life_ton: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Dies Price (VNĐ)</label>
                    <input type="number" className="form-control" value={values.dies_price_vnd}
                      onChange={(e) => setValues((prev) => ({ ...prev, dies_price_vnd: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={values.status}
                      onChange={(e) => setValues((prev) => ({ ...prev, status: e.target.value }))}>
                      {STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Timestamp (Ngày tạo)</label>
                    <input type="datetime-local" className="form-control" value={values.timestamp}
                      onChange={(e) => setValues((prev) => ({ ...prev, timestamp: e.target.value }))} />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Image Before</label>
                    <div className="d-flex gap-2">
                      <input type="text" className="form-control" placeholder="Nhập URL ảnh hoặc chọn file bên cạnh"
                        value={values.image_before_url}
                        onChange={(e) => setValues((prev) => ({ ...prev, image_before_url: e.target.value }))} />
                      <input type="file" className="form-control" style={{ width: 'auto' }} accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setValues((prev) => ({ ...prev, image_before_url: file.name, files: [file] }));
                          }
                        }} />
                    </div>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label">Ghi chú</label>
                    <textarea className="form-control" rows={3} value={values.symptom}
                      onChange={(e) => setValues((prev) => ({ ...prev, symptom: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
                {t('workForm.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {isAssignMode
                  ? (loading ? t('workForm.submitApproving') : t('workForm.submitApprove'))
                  : editingId
                  ? (loading ? t('workForm.submitSaving') : t('workForm.submitSave'))
                  : (loading ? t('workForm.submitRequesting') : 'Tạo Die')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

WorkFormModal.displayName = 'WorkFormModal';

export default WorkFormModal;