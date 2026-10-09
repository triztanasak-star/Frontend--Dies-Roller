import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
import * as db from '../../../lib/db';
import type { AppSetting } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';

const DIES_MODELS = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];

const PRESS_LENGTH_OPTIONS = [
  '60-0', '60-5', '60-10', '60-15', '60-20', '60-45',
  '65-0', '65-5', '65-10', '65-15', '65-45', '65-50',
  '70-0', '70-5', '75-0',
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

// ✅ Key định danh theo 3 trường: model + press_length + die_hole
const makeStdKey = (
  modelLabel: string,
  pressLength: string,
  dieHole: string
) => {
  const modelSlug = modelLabel.replace(/[\s-]/g, '_');
  const plSlug = pressLength.replace(/-/g, '_');
  const dhSlug = (dieHole.trim() || 'none').replace(/[\s\-./]/g, '_');
  return `std_die_${modelSlug}_${plSlug}_${dhSlug}`;
};

export default function SettingsPage() {
  const { can } = useAuth();
  const isManagerOrAdmin = can('manager-or-admin');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'die'],
    queryFn: () => db.listSettings(),
  });

  const pressLengthByModel = new Map<string, AppSetting[]>();
  (data?.documents ?? [])
    .filter((s) => s.key?.startsWith('std_die_'))
    .forEach((s) => {
      if (s.press_length_mm && s.dies_model) {
        const arr = pressLengthByModel.get(s.dies_model) ?? [];
        arr.push(s);
        pressLengthByModel.set(s.dies_model, arr);
      }
    });

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="h4">Cấu hình hệ thống</h1>
        <p className="text-muted mb-0">
          Tiêu chuẩn Press Length theo từng loại Dies Model
        </p>
      </div>

      {isLoading && <LoadingOverlay />}

      {DIES_MODELS.map((modelLabel) => (
        <ModelPressLengthSection
          key={modelLabel}
          modelLabel={modelLabel}
          standards={pressLengthByModel.get(modelLabel) ?? []}
          canEdit={isManagerOrAdmin}
        />
      ))}
    </div>
  );
}

function ModelPressLengthSection({
  modelLabel,
  standards,
  canEdit,
}: {
  modelLabel: string;
  standards: AppSetting[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [newPressLength, setNewPressLength] = useState('');
  const [newStandardTon, setNewStandardTon] = useState('');
  const [newDieHole, setNewDieHole] = useState('');
  const [adding, setAdding] = useState(false);

  // ✅ Set tổ hợp (press_length | die_hole) đã tồn tại — dùng để check trùng cả 3 trường
  const usedComboSet = new Set(
    standards.map(
      (s) => `${(s.press_length_mm ?? '').trim()}|${(s.die_hole ?? '').trim()}`
    )
  );

  const datalistId = `press-length-options-${modelLabel.replace(/\s/g, '-')}`;

  const handleAdd = async () => {
    const pl = newPressLength.trim();
    const dh = newDieHole.trim();

    if (!pl || !newStandardTon) {
      alert('Vui lòng chọn Press Length và nhập tiêu chuẩn');
      return;
    }

    // ✅ Chỉ chặn khi trùng CẢ 3 trường: model (đã cố định) + press_length + die_hole
    if (usedComboSet.has(`${pl}|${dh}`)) {
      alert(
        `Đã tồn tại bản ghi cho Press Length "${pl}" với Die hole "${dh || '(trống)'}".`
      );
      return;
    }

    const stdTon = parseFormattedNumber(newStandardTon);
    if (stdTon === null || stdTon < 0) {
      alert('Số tấn không hợp lệ');
      return;
    }

    setAdding(true);
    try {
      const key = makeStdKey(modelLabel, pl, dh);
      await db.updateSetting(key, {
        value: String(stdTon),
        description: `${modelLabel} - Press Length ${pl} - Die hole ${dh || 'N/A'}`,
        dies_model: modelLabel,
        press_length_mm: pl,
        standard_ton: stdTon,
        die_hole: dh,
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'die'] });
      setNewPressLength('');
      setNewStandardTon('');
      setNewDieHole('');
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
        <div className="d-flex gap-2 mb-3 align-items-center" style={{ maxWidth: 800 }}>
          {/* ✅ Input + datalist: vừa chọn vừa nhập tự do */}
          <input
            type="text"
            className="form-control"
            style={{ width: 220 }}
            list={datalistId}
            placeholder="-- Chọn hoặc nhập Press Length --"
            value={newPressLength}
            onChange={(e) => setNewPressLength(e.target.value)}
          />
          <datalist id={datalistId}>
            {PRESS_LENGTH_OPTIONS.map((pl) => (
              <option key={pl} value={pl} />
            ))}
          </datalist>

          <input
            type="text"
            inputMode="numeric"
            className="form-control"
            style={{ width: 180 }}
            placeholder="Tiêu chuẩn (tấn)"
            value={newStandardTon}
            onChange={(e) => setNewStandardTon(formatInputValue(e.target.value))}
          />

          <input
            type="text"
            className="form-control"
            style={{ width: 180 }}
            placeholder="Die hole"
            value={newDieHole}
            onChange={(e) => setNewDieHole(e.target.value)}
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
        <div className="text-muted small">Chưa có Press Length nào cho model này.</div>
      ) : (
        <div className="row g-3">
          {standards.map((s) => (
            <div className="col-md-3" key={s.key}>
              <PressLengthCard setting={s} canEdit={canEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PressLengthCard({
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
  const [dieHoleInput, setDieHoleInput] = useState(setting.die_hole ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setStandardTonInput(
      setting.standard_ton != null ? formatNumber(setting.standard_ton) : ''
    );
    setDieHoleInput(setting.die_hole ?? '');
  }, [setting.standard_ton, setting.die_hole]);

  const currentNum = setting.standard_ton ?? 0;
  const inputNum = parseFormattedNumber(standardTonInput) ?? 0;
  const dirty =
    inputNum !== currentNum || dieHoleInput !== (setting.die_hole ?? '');

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
        press_length_mm: setting.press_length_mm,
        standard_ton: inputNum,
        die_hole: dieHoleInput.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'die'] });
    } catch (e) {
      alert('Lỗi lưu');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (
      !confirm(
        `Xóa tiêu chuẩn cho Press Length ${setting.press_length_mm}${
          setting.die_hole ? ` - Die hole ${setting.die_hole}` : ''
        }?`
      )
    )
      return;
    setDeleting(true);
    try {
      await db.deleteSetting(setting.key);
      await queryClient.invalidateQueries({ queryKey: ['settings', 'die'] });
    } catch (e) {
      alert('Lỗi xóa');
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    // ✅ Dùng class Bootstrap để tự động theo theme sáng/tối
    <div className="card bg-body text-body border">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="card-title mb-0 text-body">
            Press Length: {setting.press_length_mm}
            {setting.die_hole ? ` • Die ${setting.die_hole}` : ''}
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
          <label className="form-label small text-body">Tiêu chuẩn (tấn)</label>
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

        <div className="mb-3">
          <label className="form-label small text-body">Die hole</label>
          <input
            type="text"
            className="form-control"
            value={dieHoleInput}
            onChange={(e) => setDieHoleInput(e.target.value)}
            disabled={!canEdit}
            placeholder="Nhập Die hole"
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