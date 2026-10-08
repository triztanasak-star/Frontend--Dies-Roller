import { useMemo, useRef, useState, Fragment, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiPlus, FiEdit2, FiTrash2, FiEye, FiImage } from 'react-icons/fi';
import { MdQrCode2 } from 'react-icons/md';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../../../context/AuthContext';
import LoadingOverlay from '../../../../components/LoadingOverlay';
import ErrorState from '../../../../components/ErrorState';
import EmptyState from '../../../../components/EmptyState';
import * as db from '../../../../lib/db';
import type { DigitalWork, WorkAttachment } from '../../../../lib/db';
import { exportWorksToExcel } from '../../../../lib/excel';
import { useCreateWork, useDeleteWork, useUpdateWork, useUpdateWorkProgress, useWorks } from '../../hooks/useWorks';
import WorkFormModal, { type WorkFormModalHandle, type WorkFormValues } from './WorkFormModal';
import ProgressUpdateModal, { type ProgressUpdateModalHandle } from './ProgressUpdateModal';
import WorkDetailModal from './WorkDetailModal';
import { useQueryClient } from '@tanstack/react-query';

const DIES_MODEL_OPTIONS = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];
const DIES_HOLE_OPTIONS = ['2.5', '2.8', '3.5', '4.0'];
const LINE_OPTIONS = ['PL#1', 'PL#2', 'PL#3', 'PL#4', 'PL#5'];
const STATUS_OPTIONS = [
  'Trong kho',
  'Đang sử dụng',
  'Chờ mài',
  'Chờ sử dụng',
  'Hết tuổi thọ',
  'Hư bể',
  'Đang đặt',
];

const STATUS_LABELS: Record<number, string> = {
  0: 'Trong kho',
  1: 'Đang sử dụng',
  2: 'Chờ mài',
  3: 'Chờ sử dụng',
  4: 'Hết tuổi thọ',
  5: 'Hư bể',
  6: 'Đang đặt',
};

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

/**
 * ✅ MỚI: Format số với TỐI ĐA 1 chữ số thập phân.
 * VD: 2.50 → 2.5, 2.80 → 2.8, 3 → 3, 2.567 → 2.6
 */
function fmtOneDecimal(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  // Làm tròn 1 chữ số thập phân, bỏ số 0 thừa
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).trim());
  return isNaN(n) ? null : n;
}

function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getYearFromDate(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const match = String(dateStr).match(/^(\d{4})/);
    if (match) return Number(match[1]);
    return null;
  }
  return d.getFullYear();
}

function parsePressLength(str?: string | null): [number, number] {
  if (!str) return [Infinity, Infinity];
  const parts = String(str).trim().split('-').map((p) => Number(p.trim()));
  const first = isNaN(parts[0]) ? Infinity : parts[0];
  const second = isNaN(parts[1]) ? 0 : parts[1];
  return [first, second];
}

function getStandardTonForMonths(work: DigitalWork, standardTonMap: Record<string, number>): number {
  const model = String(work.dies_model ?? '').trim();
  const pl = String(work.press_length_mm ?? '').trim();
  if (model && pl) {
    const key = `${model}|${pl}`;
    if (standardTonMap[key] != null) {
      return standardTonMap[key];
    }
  }
  return 0;
}

const cellCenter: React.CSSProperties = {
  textAlign: 'center',
  verticalAlign: 'middle',
};

const thStyle = (width: string): React.CSSProperties => ({
  ...cellCenter,
  width,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  lineHeight: 1.3,
  padding: '8px 6px',
});

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
      ? selected[0]
      : `${selected.length} đã chọn`;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 160 }}>
      <button
        type="button"
        className="form-select text-start"
        style={{ width: '100%', cursor: 'pointer' }}
        onClick={() => setOpen((p) => !p)}
      >
        {buttonLabel} <span style={{ float: 'right' }}>▾</span>
      </button>

      {open && (
        <div
          className="shadow"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 30,
            marginTop: 4,
            minWidth: '100%',
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--card-bg, #1a1d2e)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 6,
            padding: 8,
          }}
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-link p-0 mb-2"
              onClick={() => onChange([])}
              style={{ fontSize: '0.75rem' }}
            >
              ✕ Bỏ chọn tất cả
            </button>
          )}

          {options.length === 0 && (
            <div className="text-muted small px-2">Không có dữ liệu</div>
          )}

          {options.map((opt) => (
            <div className="form-check" key={opt}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`ms-${label}-${opt}`}
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <label
                className="form-check-label"
                htmlFor={`ms-${label}-${opt}`}
                style={{ cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {opt}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function WorksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id');
  const isManagerOrAdmin = can('manager-or-admin');

  const { data, isLoading, isError } = useWorks({ limit: 200, project_id: projectId ? Number(projectId) : undefined });
  const projectsQuery = useQuery({ queryKey: ['projects', 'select'], queryFn: () => db.listProjects(1) });
  const usersQuery = useQuery({ queryKey: ['users', 'select'], queryFn: () => db.listUsers(1), enabled: isManagerOrAdmin });

  const createWork = useCreateWork();
  const updateWork = useUpdateWork();
  const updateProgress = useUpdateWorkProgress();
  const deleteWork = useDeleteWork();

  const [expandedId] = useState<number | null>(null);
  const [selectedWork, setSelectedWork] = useState<DigitalWork | null>(null);
  const [qrWork, setQrWork] = useState<DigitalWork | null>(null);

  const [fModel, setFModel] = useState<string[]>([]);
  const [fHole, setFHole] = useState<string[]>([]);
  const [fPressLength, setFPressLength] = useState<string[]>([]);
  const [fLine, setFLine] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fYear, setFYear] = useState<string[]>([]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [plansByWork, setPlansByWork] = useState<Record<number, any[]>>({});
  const [attachmentsByWork, setAttachmentsByWork] = useState<Record<number, WorkAttachment[]>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const formModalRef = useRef<WorkFormModalHandle>(null);
  const progressModalRef = useRef<ProgressUpdateModalHandle>(null);

  const works = useMemo(() => data?.documents ?? [], [data]);

  const yearOptions = useMemo(() => {
    const yearsSet = new Set<number>();
    works.forEach((w) => {
      const y1 = getYearFromDate(w.created_at);
      const y2 = getYearFromDate(w.expected_deadline);
      const y3 = getYearFromDate(w.completed_at);
      if (y1 !== null) yearsSet.add(y1);
      if (y2 !== null) yearsSet.add(y2);
      if (y3 !== null) yearsSet.add(y3);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [works]);

  const pressLengthOptions = useMemo(() => {
    const set = new Set<string>();
    works.forEach((w) => {
      if (w.press_length_mm && String(w.press_length_mm).trim()) {
        set.add(String(w.press_length_mm).trim());
      }
    });
    return Array.from(set).sort((a, b) => {
      const [a1, a2] = parsePressLength(a);
      const [b1, b2] = parsePressLength(b);
      if (a1 !== b1) return a1 - b1;
      return a2 - b2;
    });
  }, [works]);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => db.listSettings(),
  });

  const standardTonMap = useMemo(() => {
    const m: Record<string, number> = {};
    (settingsQuery.data?.documents ?? []).forEach((s) => {
      if (s.dies_model && s.press_length_mm && s.standard_ton != null) {
        const key = `${s.dies_model.trim()}|${s.press_length_mm.trim()}`;
        m[key] = Number(s.standard_ton);
      }
    });
    return m;
  }, [settingsQuery.data]);

  useEffect(() => {
    if (works.length === 0) return;
    let cancelled = false;
    const fetchAll = async () => {
      const results: Record<number, any[]> = {};
      await Promise.all(
        works.map(async (w) => {
          try {
            const res: any = await db.listTaskPlans(w.id);
            const rawList = Array.isArray(res) ? res : (res?.documents || res?.data || []);
            results[w.id] = rawList;
          } catch (e) {
            results[w.id] = [];
          }
        })
      );
      if (!cancelled) setPlansByWork(results);
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [works]);

  useEffect(() => {
    if (works.length === 0) return;
    let cancelled = false;
    const fetchAttachments = async () => {
      const results: Record<number, WorkAttachment[]> = {};
      await Promise.all(
        works.map(async (w) => {
          try {
            const res = await db.listAttachments(w.id);
            results[w.id] = res.documents || [];
          } catch (e) {
            results[w.id] = [];
          }
        })
      );
      if (!cancelled) setAttachmentsByWork(results);
    };
    fetchAttachments();
    return () => { cancelled = true; };
  }, [works]);

  const filtered = useMemo(() => {
    const norm = (v: any) => String(v ?? '').toLowerCase().trim();
    const list = works.filter((w) => {
      if (fModel.length > 0) {
        if (!fModel.some((m) => norm(m) === norm(w.dies_model))) return false;
      }
      if (fHole.length > 0) {
        if (w.dies_hole_mm === null || w.dies_hole_mm === undefined) return false;
        const holeNum = Number(w.dies_hole_mm);
        if (!fHole.some((h) => Number(h) === holeNum)) return false;
      }
      if (fPressLength.length > 0) {
        const pl = String(w.press_length_mm ?? '').trim();
        if (!pl) return false;
        if (!fPressLength.some((f) => f.trim() === pl)) return false;
      }
      if (fLine.length > 0) {
        const lines = String(w.line_in_use ?? '')
          .split(',')
          .map((s) => s.trim().toUpperCase());
        if (!fLine.some((f) => lines.includes(f.toUpperCase()))) return false;
      }
      if (fStatus.length > 0) {
        const statusLabel = STATUS_LABELS[Number(w.status)] ?? '';
        if (!fStatus.some((s) => norm(s) === norm(statusLabel))) return false;
      }
      if (fYear.length > 0) {
        const years = [
          getYearFromDate(w.created_at),
          getYearFromDate(w.expected_deadline),
          getYearFromDate(w.completed_at),
        ].filter((y): y is number => y !== null);

        if (years.length === 0) return false;
        if (!years.some((y) => fYear.some((fy) => Number(fy) === y))) return false;
      }
      return true;
    });

    if (sortConfig) {
      const { key, direction } = sortConfig;
      const factor = direction === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        if (key === 'press_length_mm') {
          const [a1, a2] = parsePressLength(a.press_length_mm);
          const [b1, b2] = parsePressLength(b.press_length_mm);
          if (a1 !== b1) return (a1 - b1) * factor;
          return (a2 - b2) * factor;
        }
        return 0;
      });
    }

    return list;
  }, [works, fModel, fHole, fPressLength, fLine, fStatus, fYear, sortConfig]);

  const summary = useMemo(() => {
    let totalRemaining = 0;

    filtered.forEach((w) => {
      const standardTon = w.standard_ton != null ? Number(w.standard_ton) : 0;
      const usedTon = w.dies_life_ton != null ? Number(w.dies_life_ton) : 0;
      const remaining = standardTon - usedTon;
      totalRemaining += remaining;
    });

    let standardTonForMonths = 0;
    if (filtered.length > 0) {
      standardTonForMonths = getStandardTonForMonths(filtered[0], standardTonMap);
    }

    const totalMonths = standardTonForMonths > 0
      ? totalRemaining / standardTonForMonths
      : 0;

    return {
      count: filtered.length,
      totalRemaining,
      standardTonForMonths,
      totalMonths,
    };
  }, [filtered, plansByWork, standardTonMap]);

  const handleFormSubmit = async (values: WorkFormValues, editingId: number | null, isAssignMode: boolean) => {
    const payload: Partial<DigitalWork> = {
      task_name: values.task_name || values.dies_model || `Die ${values.dies_code || 'Mới'}`,
      factory_name: values.factory_name || null,
      description: values.description || null,
      priority: values.priority as 'high' | 'medium' | 'low',
      status: values.status ? Number(values.status) : 0,
      lead_project: values.lead_project || null,
      assistant: values.assistant || null,
      representative_name: values.representative_name || null,
      representative_email: values.representative_email || null,
      representative_phone: values.representative_phone || null,
      assigned_to: null,
      support_id: null,
      project_id: values.project_id ? Number(values.project_id) : null,
      expected_deadline: values.expected_deadline || null,
      dies_model: values.dies_model || null,
      dies_code: values.dies_code || null,
      symptom: values.symptom || null,
      supplier: values.supplier || null,
      dies_hole_mm: toNum(values.dies_hole_mm),
      press_length_mm: values.press_length_mm || null,
      ld_ratio: toNum(values.ld_ratio),
      dies_life_ton: toNum(values.dies_life_ton),
      standard_ton: toNum(values.standard_ton),
      remaining_tons: toNum(values.remaining_tons),
      dies_price_vnd: toNum(values.dies_price_vnd),
      price_per_ton_vnd: toNum(values.price_per_ton_vnd),
      result_cost_per_ton_vnd: toNum(values.result_cost_per_ton_vnd),
      line_in_use: values.line_in_use || null,
    };

    if (isAssignMode) payload.workflow_status = 'approved';

    if (editingId) {
      await updateWork.mutateAsync({ id: editingId, payload });
      if (values.files?.length) await db.uploadAttachments(editingId, values.files);
    } else {
      const created = await createWork.mutateAsync({ payload });
      if (values.files?.length && created?.id) {
        await db.uploadAttachments(created.id, values.files);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['works'] });
    await queryClient.invalidateQueries({ queryKey: ['work_attachments'] });
  };

  const handleProgressSubmit = async (workId: number, values: Parameters<typeof db.updateWorkProgress>[1]) => {
    await updateProgress.mutateAsync({ id: workId, payload: values });
    try {
      const res: any = await db.listTaskPlans(workId);
      const rawList = Array.isArray(res) ? res : (res?.documents || res?.data || []);
      setPlansByWork(prev => ({ ...prev, [workId]: rawList }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => exportWorksToExcel(filtered);

  const resetFilters = () => {
    setFModel([]);
    setFHole([]);
    setFPressLength([]);
    setFLine([]);
    setFStatus([]);
    setFYear([]);
    setSortConfig(null);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const hasFilter =
    fModel.length > 0 || fHole.length > 0 || fPressLength.length > 0 || fLine.length > 0 || fStatus.length > 0 || fYear.length > 0 || sortConfig !== null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="h4">Quản lý Dies</h1>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={handleExport}>
            <FiDownload className="me-1" /> {t('works.exportExcel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => formModalRef.current?.openCreate()}>
            <FiPlus className="me-1" /> Thêm Die
          </button>
        </div>
      </div>

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <div className="data-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div
            className="data-table-toolbar"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '12px 16px',
              zIndex: 20,
            }}
          >
            <MultiSelectFilter label="Tất cả Dies Model" options={DIES_MODEL_OPTIONS} selected={fModel} onChange={setFModel} />
            <MultiSelectFilter label="Tất cả Hole (mm)" options={DIES_HOLE_OPTIONS} selected={fHole} onChange={setFHole} />
            <MultiSelectFilter
              label="Tất cả Press Length"
              options={pressLengthOptions}
              selected={fPressLength}
              onChange={setFPressLength}
            />
            <MultiSelectFilter label="Tất cả LINE" options={LINE_OPTIONS} selected={fLine} onChange={setFLine} />
            <MultiSelectFilter label="Tất cả Status" options={STATUS_OPTIONS} selected={fStatus} onChange={setFStatus} />

            <MultiSelectFilter
              label="Tất cả năm"
              options={yearOptions.map(String)}
              selected={fYear}
              onChange={setFYear}
            />

            {hasFilter && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>
                ✕ Xoá lọc / sort
              </button>
            )}

            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '6px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 8,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                  TỔNG SỐ TẤN CÒN LẠI
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#22c55e' }}>
                  {fmtNum(summary.totalRemaining)} <small style={{ fontSize: '0.75rem' }}>tấn</small>
                </div>
              </div>

              <div style={{ width: 1, height: 32, background: 'rgba(148, 163, 184, 0.3)' }} />

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                  DỰ KIẾN SỐ THÁNG
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>
                  {summary.totalMonths.toFixed(1)} <small style={{ fontSize: '0.75rem' }}>tháng</small>
                </div>
              </div>
            </div>
          </div>

          {filtered.length === 0 && <EmptyState message={t('works.noMatch')} />}

          {filtered.length > 0 && (
            <div className="table-responsive-wrap" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="table align-middle mb-0" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg, #1a1d2e)', color: 'var(--text-color, #ffffff)', zIndex: 10 }}>
                  <tr>
                    <th style={thStyle('45px')}>NO.</th>
                    <th style={thStyle('110px')}>Dies Model</th>
                    <th style={thStyle('70px')}>Dies Hole (mm)</th>
                    <th
                      style={{ ...thStyle('95px'), cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('press_length_mm')}
                      title="Click để sort"
                    >
                      Press Length (mm){' '}
                      {sortConfig?.key === 'press_length_mm' && (
                        <span style={{ fontSize: '0.75em', marginLeft: 2 }}>
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th style={thStyle('80px')}>L/D RATIO</th>
                    {/* ✅ CỘT MỚI: DIES CODE */}
                    <th style={thStyle('110px')}>Dies Code</th>
                    <th style={thStyle('120px')}>Dies Price (VND)</th>
                    <th style={thStyle('95px')}>Tiêu chuẩn (tấn)</th>
                    <th style={thStyle('100px')}>Số tấn sử dụng</th>
                    <th style={thStyle('100px')}>Số tấn còn lại</th>
                    <th style={thStyle('110px')}>VNĐ/tấn</th>
                    <th style={thStyle('90px')}>LINE</th>
                    <th style={thStyle('110px')}>STATUS</th>
                    <th style={thStyle('200px')}>LỊCH SỬ</th>
                    <th style={thStyle('110px')}>HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((work, index) => {
                    const currentUserName = user?.name?.trim().toLowerCase() || '';
                    const leadProject = (work.lead_project || work.assigned_to_name || '').trim().toLowerCase();
                    const assistantName = (work.assistant || work.support_name || '').trim().toLowerCase();
                    const isOwner = Boolean(currentUserName) && (leadProject === currentUserName || assistantName === currentUserName);

                    const plans = plansByWork[work.id] || [];
                    const standardTon = work.standard_ton != null ? Number(work.standard_ton) : 0;
                    const usedTons = work.dies_life_ton != null ? Number(work.dies_life_ton) : 0;
                    const remainingTons = standardTon - usedTons;

                    const vndPerTon = work.price_per_ton_vnd != null ? Number(work.price_per_ton_vnd) : null;

                    const images = (attachmentsByWork[work.id] || [])
                      .filter((a) => a.category === 'after_work' && a.mime_type?.startsWith('image/'))
                      .sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0));
                    const latestImage = images[0];

                    const historyList = Array.isArray(plans)
                      ? [...plans].sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
                      : [];

                    const statusLabel = STATUS_LABELS[Number(work.status)] ?? '—';

                    return (
                      <Fragment key={work.id}>
                        <tr>
                          <td style={cellCenter}>{index + 1}</td>
                          <td style={{ ...cellCenter, wordBreak: 'break-word' }}>{work.dies_model || '—'}</td>
                          {/* ✅ SỬA: dùng fmtOneDecimal() để chỉ hiện 1 số lẻ (2.5 thay vì 2.50) */}
                          <td style={cellCenter}>{fmtOneDecimal(work.dies_hole_mm)}</td>
                          <td style={cellCenter}>{work.press_length_mm || '—'}</td>
                          <td style={cellCenter}>{work.ld_ratio ?? '—'}</td>
                          {/* ✅ DIES CODE */}
                          <td style={{ ...cellCenter, wordBreak: 'break-word' }}>{work.dies_code || '—'}</td>
                          <td style={cellCenter}>{fmtNum(work.dies_price_vnd)}</td>
                          <td style={cellCenter}>{fmtNum(standardTon)}</td>
                          <td style={cellCenter}>{fmtNum(usedTons)}</td>
                          <td style={{ ...cellCenter, fontWeight: 600, color: remainingTons < 0 ? '#ef4444' : 'inherit' }}>
                            {fmtNum(remainingTons)}
                          </td>
                          <td style={{ ...cellCenter, fontWeight: 600 }}>
                            {fmtNum(vndPerTon)}
                          </td>
                          <td style={cellCenter}>{work.line_in_use || '—'}</td>
                          <td style={cellCenter}>{statusLabel}</td>

                          <td style={{ ...cellCenter, textAlign: 'left', fontSize: '0.8rem' }}>
                            {historyList.length === 0 ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
                                {historyList.map((p: any, idx: number) => (
                                  <div key={p.id || idx} style={{ lineHeight: 1.4 }}>
                                    <strong>{idx + 1}. {p.step_name || p.name}</strong>
                                    {p.progress_percent != null && (
                                      <span className="text-muted ms-1">: {p.progress_percent} ton</span>
                                    )}
                                    {p.due_date && (
                                      <span className="text-muted ms-1">({formatDueDate(p.due_date)})</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          <td style={cellCenter}>
                            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0"
                                title="Xem QR"
                                onClick={() => setQrWork(work)}
                              >
                                <MdQrCode2 />
                              </button>
                              <button type="button" className="btn btn-sm btn-link p-0" title="Xem chi tiết" onClick={() => setSelectedWork(work)}>
                                <FiEye />
                              </button>
                              {latestImage && (
                                <button type="button" className="btn btn-sm btn-link p-0" title="Xem ảnh" onClick={() => setZoomImage(latestImage.url)}>
                                  <FiImage />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0"
                                title="Cập nhật tiến độ"
                                disabled={!isManagerOrAdmin && !isOwner}
                                style={(!isManagerOrAdmin && !isOwner) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                onClick={() => {
                                  if (isManagerOrAdmin || isOwner) progressModalRef.current?.open(work);
                                }}
                              >
                                <FiEdit2 />
                              </button>
                              {isManagerOrAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-danger p-0"
                                  title="Xóa"
                                  onClick={() => deleteWork.mutate({ id: work.id, type: 'die' })}
                                >
                                  <FiTrash2 />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <WorkFormModal
        ref={formModalRef}
        projects={projectsQuery.data?.documents ?? []}
        users={usersQuery.data?.documents ?? []}
        onSubmit={handleFormSubmit}
      />
      <ProgressUpdateModal ref={progressModalRef} isReviewer={isManagerOrAdmin} onSubmit={handleProgressSubmit} />

      <WorkDetailModal work={selectedWork} onClose={() => setSelectedWork(null)} />

      {/* ✅ Modal QR Code */}
      {qrWork && (
        <div
          onClick={() => setQrWork(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
            cursor: 'pointer',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              padding: 32,
              borderRadius: 12,
              textAlign: 'center',
              maxWidth: 400,
              cursor: 'default',
            }}
          >
            <h5 style={{ color: '#1f2937', marginBottom: 4 }}>
              {qrWork.dies_model || 'Die'}
              {(qrWork.dies_hole_mm || qrWork.press_length_mm) && (
                <span style={{ color: '#6b7280', fontWeight: 400 }}>
                  {' — '}
                  {[
                    qrWork.dies_hole_mm != null ? `⌀${fmtOneDecimal(qrWork.dies_hole_mm)}mm` : null,
                    qrWork.press_length_mm || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </h5>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 20 }}>
              {qrWork.dies_code || ''}
            </p>

            <QRCodeSVG
              value={`${window.location.origin}/die/${qrWork.id}`}
              size={220}
              level="H"
              includeMargin
            />

            <p style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              marginTop: 16,
              wordBreak: 'break-all',
            }}>
              {window.location.origin}/die/{qrWork.id}
            </p>

            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={() => setQrWork(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ✅ Modal Zoom Image */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={zoomImage}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="btn btn-light"
            onClick={() => setZoomImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}