import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
import * as db from '../../../lib/db';
import type { AppSetting } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';

// ✅ Đổi tên: ROLLER_MODELS thay vì DIES_MODELS
const ROLLER_MODELS = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];

// ✅ Đổi: Roller Shell Type thay vì Press Length
const ROLLER_SHELL_TYPE_OPTIONS = [
  'Dimpled',
  'Corrugate closed end',
  'Corrugate open end',
  'Corrugate with dimpled end',
  'Fish bone',
];

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return '';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(value)));
};

const parseFormattedNumber = (str: string): number | null => {
  if (!str) return null;
  const cleaned = String(str).replace(/\./g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

const formatInputValue = (str: string): string => {
  if (!str) return '';
  const cleaned = String(str).replace(/\./g, '').replace(/[^\d]/g, '');
  if (!cleaned) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(cleaned));
};

// ✅ SỬA 1: Thêm prefix "roller_" để tách biệt với Dies
const makeStdKey = (modelLabel: string, shellType: string) => {
  const modelSlug = modelLabel.replace(/[\s-]/g, '_');
  const stSlug = shellType.replace(/[\s-]/g, '_');
  return `std_roller_${modelSlug}_${stSlug}`;
};

export default function SettingsPage1() {
  const { can } = useAuth();
  const isManagerOrAdmin = can('manager-or-admin');

  // ✅ SỬA 2: Thêm 'roller' vào queryKey để tách cache React Query
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'roller'],
    queryFn: () => db.listSettings(),
  });

  // ✅ Vẫn dùng field DB `press_length_mm` để group theo model
  // (Vì DB vẫn lưu shell type vào cột này)
  const shellTypeByModel = new Map<string, AppSetting[]>();
  // ✅ SỬA 3: Chỉ lấy setting có key bắt đầu bằng "std_roller_"
  (data?.documents ?? [])
    .filter((s) => s.key?.startsWith('std_roller_'))
    .forEach((s) => {
      if (s.press_length_mm && s.dies_model) {
        const arr = shellTypeByModel.get(s.dies_model) ?? [];
        arr.push(s);
        shellTypeByModel.set(s.dies_model, arr);
      }
    });

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="h4">Cấu hình hệ thống</h1>
        <p className="text-muted mb-0">
          Tiêu chuẩn Roller Shell Type theo từng loại Roller Model
        </p>
      </div>

      {isLoading && <LoadingOverlay />}

      {ROLLER_MODELS.map((modelLabel) => (
        <ModelShellTypeSection
          key={modelLabel}
          modelLabel={modelLabel}
          standards={shellTypeByModel.get(modelLabel) ?? []}
          canEdit={isManagerOrAdmin}
        />
      ))}
    </div>
  );
}

// ✅ Đổi tên component: ModelShellTypeSection
function ModelShellTypeSection({
  modelLabel,
  standards,
  canEdit,
}: {
  modelLabel: string;
  standards: AppSetting[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [newShellType, setNewShellType] = useState('');
  const [newStandardTon, setNewStandardTon] = useState('');
  const [adding, setAdding] = useState(false);

  // ✅ Dùng field DB `press_length_mm` để check trùng
  const usedSet = new Set(standards.map((s) => s.press_length_mm));
  const available = ROLLER_SHELL_TYPE_OPTIONS.filter((st) => !usedSet.has(st));

  const handleAdd = async () => {
    if (!newShellType || !newStandardTon) {
      alert('Vui lòng chọn Roller Shell Type và nhập tiêu chuẩn');
      return;
    }
    const stdTon = parseFormattedNumber(newStandardTon);
    if (stdTon === null || stdTon < 0) {
      alert('Số tấn không hợp lệ');
      return;
    }
    setAdding(true);
    try {
      const key = makeStdKey(modelLabel, newShellType);
      await db.updateSetting(key, {
        value: String(stdTon),
        description: `${modelLabel} - Roller Shell Type ${newShellType}`,
        dies_model: modelLabel,
        press_length_mm: newShellType,   // ✅ Vẫn gửi vào field DB cũ
        standard_ton: stdTon,
      });
      // ✅ SỬA 4: invalidate đúng cache của Roller
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roller'] });
      setNewShellType('');
      setNewStandardTon('');
    } catch (e) {
      alert('Lỗi thêm tiêu chuẩn');
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mb-5">
      <h6 className="text-muted mb-3">🔧 MODEL: {modelLabel}</h6>

      {canEdit && (
        <div className="d-flex gap-2 mb-3 align-items-center" style={{ maxWidth: 600 }}>
          <select
            className="form-select"
            style={{ width: 220 }}
            value={newShellType}
            onChange={(e) => setNewShellType(e.target.value)}
          >
            <option value="">-- Chọn Roller Shell Type --</option>
            {available.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <input
            type="text"
            inputMode="numeric"
            className="form-control"
            style={{ width: 180 }}
            placeholder="Tiêu chuẩn (tấn)"
            value={newStandardTon}
            onChange={(e) => setNewStandardTon(formatInputValue(e.target.value))}
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={adding}
            style={{ whiteSpace: 'nowrap' }}
          >
            <FiPlus className="me-1" /> {adding ? 'Đang thêm...' : 'Thêm'}
          </button>
        </div>
      )}

      {standards.length === 0 ? (
        <div className="text-muted small">Chưa có Roller Shell Type nào cho model này.</div>
      ) : (
        <div className="row g-3">
          {standards.map((s) => (
            <div className="col-md-3" key={s.key}>
              <ShellTypeCard setting={s} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ✅ Đổi tên component: ShellTypeCard
function ShellTypeCard({
  setting,
  canEdit,
}: {
  setting: AppSetting;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [standardTonInput, setStandardTonInput] = useState(
    setting.standard_ton != null ? formatNumber(setting.standard_ton) : ''
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setStandardTonInput(
      setting.standard_ton != null ? formatNumber(setting.standard_ton) : ''
    );
  }, [setting.standard_ton]);

  const currentNum = setting.standard_ton ?? 0;
  const inputNum = parseFormattedNumber(standardTonInput) ?? 0;
  const dirty = inputNum !== currentNum;

  const handleSave = async () => {
    if (!canEdit) return;
    if (inputNum < 0) {
      alert('Số tấn không được âm');
      return;
    }
    setSaving(true);
    try {
      await db.updateSetting(setting.key, {
        value: String(inputNum),
        dies_model: setting.dies_model,
        press_length_mm: setting.press_length_mm,   // ✅ Vẫn dùng field DB cũ
        standard_ton: inputNum,
      });
      // ✅ SỬA 5: invalidate đúng cache của Roller
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roller'] });
    } catch (e) {
      alert('Lỗi lưu');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!confirm(`Xóa tiêu chuẩn cho Roller Shell Type ${setting.press_length_mm}?`)) return;
    setDeleting(true);
    try {
      await db.deleteSetting(setting.key);
      // ✅ SỬA 6: invalidate đúng cache của Roller
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roller'] });
    } catch (e) {
      alert('Lỗi xóa');
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--card-bg, #1a1d2e)',
        border: '1px solid rgba(148,163,184,0.25)',
      }}
    >
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="card-title mb-0">
            Roller Shell Type: {setting.press_length_mm}
          </h6>
          {canEdit && (
            <button
              type="button"
              className="btn btn-sm btn-link text-danger p-0"
              title="Xóa"
              onClick={handleDelete}
              disabled={deleting}
            >
              <FiTrash2 />
            </button>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label small">Tiêu chuẩn (tấn)</label>
          <input
            type="text"
            inputMode="numeric"
            className="form-control"
            value={standardTonInput}
            onChange={(e) => setStandardTonInput(formatInputValue(e.target.value))}
            disabled={!canEdit}
            placeholder="VD: 30.000"
          />
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <small className="text-muted">
            {setting.updated_at
              ? `Cập nhật: ${new Date(setting.updated_at).toLocaleString('vi-VN')}`
              : 'Chưa cập nhật'}
          </small>

          {canEdit && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              <FiSave className="me-1" />
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}