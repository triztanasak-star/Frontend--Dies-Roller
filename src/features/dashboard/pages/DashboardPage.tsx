import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import * as db from '../../../lib/db';
import type { DigitalWork } from '../../../lib/db';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import { useTheme } from '../../../context/ThemeContext';

// ============================================================
// Helpers
// ============================================================
function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Trong kho',
  1: 'Đang sử dụng',
  2: 'Chờ mài',
  3: 'Chờ sử dụng',
  4: 'Hết tuổi thọ',
  5: 'Hư bể',
  6: 'Đang đặt',
};

const STATUS_COLORS: Record<number, string> = {
  0: '#22c55e',
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#8b5cf6',
  4: '#ef4444',
  5: '#dc2626',
  6: '#0ea5e9',
};

const MODEL_ORDER = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];
const MODEL_COLORS: Record<string, string> = {
  'PM 717-TW': '#3b82f6',
  'CPM 7726SW': '#22c55e',
  'CPM 7730SW': '#f59e0b',
};

const HOLE_ORDER = ['2.5', '2.8', '3.5', '4.0'];
const LINE_ORDER = ['PL#1', 'PL#2', 'PL#3', 'PL#4', 'PL#5'];
const PRESS_ORDER = [
  '60-0', '60-5', '60-10', '60-15', '60-20', '60-45',
  '65-0', '65-5', '65-10', '65-15', '65-45', '65-50',
  '70-0', '70-5', '75-0',
];
const SUPPLIER_ORDER = [
  'GRAF', 'MUNCH', 'JUMELIA', 'SHZY', 'FAMSUN', 'CPM',
  'KPI', 'BUHLER', 'ANDRITZ', 'PCE', 'SALMATEC',
  'HOANG THIEN', 'HAYNE', 'JACOB', 'FEROTECH',
  'LAMECCANICA', 'VIETNAM LOCAL',
];

function sortByOrder(items: string[], order: string[]): string[] {
  const known = items.filter((i) => order.includes(i));
  const unknown = items.filter((i) => !order.includes(i));
  known.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...known, ...unknown];
}

// ============================================================
// Chart wrapper
// ============================================================
function ChartCard({
  title,
  children,
  height = 260,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="card-surface h-100 d-flex flex-column">
      <h6 className="mb-3" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{title}</h6>
      <div style={{ height, width: '100%' }}>{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
      Chưa có dữ liệu
    </div>
  );
}

// ✅ Component Tooltip tái sử dụng: hiện Die Hole + Số lượng
function HoleTooltip({ active, payload, label, tooltipStyle, TEXT_COLOR, TOOLTIP_BORDER }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const holes: { hole: string; count: number }[] = data.holes || [];

  return (
    <div style={tooltipStyle}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: TEXT_COLOR }}>{label}</div>
      <div style={{ marginBottom: 4 }}>
        <strong>Tổng số lượng:</strong> {data.count}
      </div>
      {holes.length > 0 && (
        <div style={{ borderTop: `1px solid ${TOOLTIP_BORDER}`, marginTop: 6, paddingTop: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Chi tiết Die Hole:</div>
          {holes.map((h, idx) => (
            <div key={idx} style={{ fontSize: 11, marginBottom: 2 }}>
              • Die Hole <strong>{h.hole}</strong>: {h.count} cái
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================
export default function DashboardPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const TEXT_COLOR = isDark ? '#e5e7eb' : '#1f2937';
  const MUTED_COLOR = isDark ? '#94a3b8' : '#6b7280';
  const GRID_COLOR = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.3)';
  const TOOLTIP_BG = isDark ? '#1a1d2e' : '#ffffff';
  const TOOLTIP_BORDER = isDark ? '#334155' : '#d1d5db';

  const labelProps = {
    position: 'top' as const,
    fill: TEXT_COLOR,
    fontSize: 12,
    fontWeight: 700,
  };

  const tooltipStyle = {
    background: TOOLTIP_BG,
    border: `1px solid ${TOOLTIP_BORDER}`,
    borderRadius: 8,
    color: TEXT_COLOR,
    fontSize: 12,
    padding: '6px 10px',
  };

  // ============================================================
  // Queries
  // ============================================================
  const worksQuery = useQuery({
    queryKey: ['works', 'dashboard'],
    queryFn: () => db.listWorks({ limit: 500 }),
  });

  const settingsQuery = useQuery({
    queryKey: ['settings', 'dashboard'],
    queryFn: () => db.listSettings(),
  });

  const works = useMemo(() => worksQuery.data?.documents ?? [], [worksQuery.data]);
  const settings = useMemo(() => settingsQuery.data?.documents ?? [], [settingsQuery.data]);

  // ============================================================
  // Stats tổng + Chi tiết Die Hole theo từng nhóm
  // ============================================================
  const stats = useMemo(() => {
    const total = works.length;

    let totalStandardTon = 0;
    let totalUsedTon = 0;
    let totalRemaining = 0;
    let totalValue = 0;

    const byModel: Record<string, number> = {};
    const byModelHole: Record<string, Record<string, number>> = {}; // ✅ Model -> {hole -> count}
    const byHole: Record<string, number> = {};
    const byPressLength: Record<string, number> = {};
    const byPressHole: Record<string, Record<string, number>> = {}; // ✅ PressLength -> {hole -> count}
    const byLine: Record<string, number> = {};
    const byLineHole: Record<string, Record<string, number>> = {}; // ✅ Line -> {hole -> count}
    const bySupplier: Record<string, number> = {};
    const byStatus: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    const lowLifeDanger: DigitalWork[] = [];

    works.forEach((w) => {
      const std = w.standard_ton != null ? Number(w.standard_ton) : 0;
      const used = w.dies_life_ton != null ? Number(w.dies_life_ton) : 0;
      const remaining = std - used;

      totalStandardTon += std;
      totalUsedTon += used;
      totalRemaining += remaining;
      totalValue += w.dies_price_vnd != null ? Number(w.dies_price_vnd) : 0;

      const holeStr = w.dies_hole_mm != null ? String(w.dies_hole_mm) : '—';

      // ✅ Theo Model + Hole
      if (w.dies_model) {
        byModel[w.dies_model] = (byModel[w.dies_model] ?? 0) + 1;
        if (!byModelHole[w.dies_model]) byModelHole[w.dies_model] = {};
        byModelHole[w.dies_model][holeStr] = (byModelHole[w.dies_model][holeStr] ?? 0) + 1;
      }

      if (w.dies_hole_mm != null) {
        byHole[holeStr] = (byHole[holeStr] ?? 0) + 1;
      }

      // ✅ Theo Press Length + Hole
      if (w.press_length_mm) {
        byPressLength[w.press_length_mm] = (byPressLength[w.press_length_mm] ?? 0) + 1;
        if (!byPressHole[w.press_length_mm]) byPressHole[w.press_length_mm] = {};
        byPressHole[w.press_length_mm][holeStr] = (byPressHole[w.press_length_mm][holeStr] ?? 0) + 1;
      }

      // ✅ Theo Line + Hole
      if (w.line_in_use) {
        const lines = w.line_in_use.split(',').map((s) => s.trim()).filter(Boolean);
        lines.forEach((l) => {
          byLine[l] = (byLine[l] ?? 0) + 1;
          if (!byLineHole[l]) byLineHole[l] = {};
          byLineHole[l][holeStr] = (byLineHole[l][holeStr] ?? 0) + 1;
        });
      }

      if (w.supplier) {
        const sup = w.supplier.trim().toUpperCase();
        bySupplier[sup] = (bySupplier[sup] ?? 0) + 1;
      }
      if (w.status !== undefined) {
        byStatus[Number(w.status)] = (byStatus[Number(w.status)] ?? 0) + 1;
      }

      if (std > 0 && remaining / std < 0.2 && remaining >= 0) {
        lowLifeDanger.push(w);
      }
    });

    const overallPercent = totalStandardTon > 0
      ? Math.round((totalUsedTon / totalStandardTon) * 100)
      : 0;

    return {
      total,
      totalStandardTon,
      totalUsedTon,
      totalRemaining,
      totalValue,
      overallPercent,
      byModel,
      byModelHole,
      byHole,
      byPressLength,
      byPressHole,
      byLine,
      byLineHole,
      bySupplier,
      byStatus,
      lowLifeDanger: lowLifeDanger.sort((a, b) => {
        const aStd = Number(a.standard_ton ?? 0);
        const aRem = aStd - Number(a.dies_life_ton ?? 0);
        const bStd = Number(b.standard_ton ?? 0);
        const bRem = bStd - Number(b.dies_life_ton ?? 0);
        return (bRem / bStd) - (aRem / aStd);
      }),
    };
  }, [works]);

  // ============================================================
  // Chart data
  // ============================================================

  // ✅ 1. Số lượng Die theo Model (có chi tiết Die Hole)
  const modelChartData = useMemo(() => {
    const known = MODEL_ORDER.filter((m) => stats.byModel[m] != null);
    return known.map((m) => ({
      name: m,
      count: stats.byModel[m],
      fill: MODEL_COLORS[m] ?? '#3b82f6',
      holes: Object.entries(stats.byModelHole[m] ?? {}).map(([hole, count]) => ({ hole, count })),
    }));
  }, [stats.byModel, stats.byModelHole]);

  // ✅ 2. Số lượng Die theo Line in use (có chi tiết Die Hole)
  const lineChartData = useMemo(() => {
    const known = LINE_ORDER.filter((l) => stats.byLine[l] != null);
    return known.map((l) => ({
      name: l,
      count: stats.byLine[l],
      holes: Object.entries(stats.byLineHole[l] ?? {}).map(([hole, count]) => ({ hole, count })),
    }));
  }, [stats.byLine, stats.byLineHole]);

  // ✅ 3. Press Length (có chi tiết Die Hole)
  const pressChartData = useMemo(() => {
    const known = PRESS_ORDER.filter((p) => stats.byPressLength[p] != null);
    return known.map((p) => ({
      name: p,
      count: stats.byPressLength[p],
      holes: Object.entries(stats.byPressHole[p] ?? {}).map(([hole, count]) => ({ hole, count })),
    }));
  }, [stats.byPressLength, stats.byPressHole]);

  // Cấu hình Die (giữ nguyên)
  const configByPressData = useMemo(() => {
    const items: {
      name: string;
      model: string;
      pressLength: string;
      dieHole: string;
      standardTon: number;
    }[] = [];

    settings.forEach((s) => {
      if (s.key.startsWith('std_die_') && s.dies_model && s.press_length_mm) {
        items.push({
          name: `${s.press_length_mm} | ${s.die_hole ?? '—'}`,
          model: s.dies_model,
          pressLength: s.press_length_mm,
          dieHole: s.die_hole ?? '—',
          standardTon: Number(s.value || 0),
        });
      }
    });

    items.sort((a, b) => {
      const modelIdxA = MODEL_ORDER.indexOf(a.model);
      const modelIdxB = MODEL_ORDER.indexOf(b.model);
      if (modelIdxA !== modelIdxB) {
        return (modelIdxA === -1 ? 999 : modelIdxA) - (modelIdxB === -1 ? 999 : modelIdxB);
      }
      const pressIdxA = PRESS_ORDER.indexOf(a.pressLength);
      const pressIdxB = PRESS_ORDER.indexOf(b.pressLength);
      return (pressIdxA === -1 ? 999 : pressIdxA) - (pressIdxB === -1 ? 999 : pressIdxB);
    });

    return items;
  }, [settings]);

  const supplierChartData = useMemo(() => {
    const items = Object.keys(stats.bySupplier);
    const sorted = sortByOrder(items, SUPPLIER_ORDER);
    return sorted.map((s) => ({ name: s, count: stats.bySupplier[s] }));
  }, [stats.bySupplier]);

  const statusChartData = useMemo(() => {
    return Object.entries(stats.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[Number(status)] ?? '—',
        value: count,
        color: STATUS_COLORS[Number(status)] ?? '#94a3b8',
      }));
  }, [stats.byStatus]);

  const press60Data = useMemo(() => pressChartData.filter((p) => p.name.startsWith('60-')), [pressChartData]);
  const press65Data = useMemo(() => pressChartData.filter((p) => p.name.startsWith('65-')), [pressChartData]);
  const press70Data = useMemo(
    () => pressChartData.filter((p) => p.name.startsWith('70-') || p.name.startsWith('75-')),
    [pressChartData],
  );

  // ============================================================
  // Loading / Error
  // ============================================================
  if (worksQuery.isLoading || settingsQuery.isLoading) return <LoadingOverlay />;
  if (worksQuery.isError || settingsQuery.isError) return <ErrorState />;

  return (
    <div
      className="dashboard-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingBottom: '24px',
      }}
    >
      <div className="page-header mb-0">
        <div>
          <h1 className="h4 mb-0">Tổng quan Dies</h1>
        </div>
      </div>

      {/* 4 thẻ thống kê */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <div className="card-surface h-100">
            <div className="text-muted small">TỔNG SỐ DIE</div>
            <div className="fs-3 fw-bold">{fmtNum(stats.total)}</div>
            <div className="text-muted small">Đang quản lý</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card-surface h-100">
            <div className="text-muted small">TỔNG SỐ TẤN CÒN LẠI</div>
            <div className="fs-3 fw-bold text-success">{fmtNum(stats.totalRemaining)}</div>
            <div className="text-muted small">tấn</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card-surface h-100">
            <div className="text-muted small">TỔNG GIÁ TRỊ DIES</div>
            <div className="fs-3 fw-bold" style={{ color: '#3b82f6' }}>
              {fmtNum(stats.totalValue)}
            </div>
            <div className="text-muted small">VND</div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card-surface h-100">
            <div className="text-muted small">% TẤN ĐÃ DÙNG / TIÊU CHUẨN</div>
            <div
              className="fs-3 fw-bold"
              style={{
                color: stats.overallPercent >= 80 ? '#ef4444'
                  : stats.overallPercent >= 50 ? '#f59e0b'
                  : '#22c55e',
              }}
            >
              {stats.overallPercent}%
            </div>
            <div className="text-muted small">
              {fmtNum(stats.totalUsedTon)} / {fmtNum(stats.totalStandardTon)} tấn
            </div>
          </div>
        </div>
      </div>

      {/* Hàng 1: Model + Config + Line */}
      <div className="row g-3">
        {/* ✅ 1. Model với Tooltip Die Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Số lượng Die theo Model" height={260}>
            {modelChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 10, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    content={
                      <HoleTooltip
                        tooltipStyle={tooltipStyle}
                        TEXT_COLOR={TEXT_COLOR}
                        TOOLTIP_BORDER={TOOLTIP_BORDER}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                    {modelChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Cấu hình Die */}
        <div className="col-12 col-lg-4">
          <ChartCard title="⚙️ Cấu hình Standard Ton theo Press Length (Die)" height={280}>
            {configByPressData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={configByPressData}
                  margin={{ top: 25, right: 10, left: -20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="name"
                    stroke={MUTED_COLOR}
                    tick={{ fontSize: 9, fill: TEXT_COLOR }}
                    angle={-30}
                    textAnchor="end"
                    height={55}
                    interval={0}
                  />
                  <YAxis stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={tooltipStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{data.model}</div>
                            <div>Press Length: <strong>{data.pressLength}</strong></div>
                            <div>Die Hole: <strong>{data.dieHole}</strong></div>
                            <div>Tiêu chuẩn: <strong>{data.standardTon.toLocaleString('vi-VN')} tấn</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="standardTon" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    <LabelList
                      dataKey="standardTon"
                      position="top"
                      fill={TEXT_COLOR}
                      fontSize={10}
                      fontWeight={700}
                      formatter={(value: number) => value.toLocaleString('vi-VN')}
                    />
                    {configByPressData.map((entry, idx) => (
                      <Cell key={idx} fill={MODEL_COLORS[entry.model] ?? '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ✅ 2. Line in use với Tooltip Die Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Số lượng Die theo Line in use" height={260}>
            {lineChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    content={
                      <HoleTooltip
                        tooltipStyle={tooltipStyle}
                        TEXT_COLOR={TEXT_COLOR}
                        TOOLTIP_BORDER={TOOLTIP_BORDER}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Hàng 2: Press Length 60-x, 65-x, 70-x/75-x */}
      <div className="row g-3">
        {/* ✅ 3. Press Length 60-x với Tooltip Die Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Press Length 60-x (mm)" height={260}>
            {press60Data.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={press60Data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    content={
                      <HoleTooltip
                        tooltipStyle={tooltipStyle}
                        TEXT_COLOR={TEXT_COLOR}
                        TOOLTIP_BORDER={TOOLTIP_BORDER}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ✅ 4. Press Length 65-x với Tooltip Die Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Press Length 65-x (mm)" height={260}>
            {press65Data.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={press65Data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    content={
                      <HoleTooltip
                        tooltipStyle={tooltipStyle}
                        TEXT_COLOR={TEXT_COLOR}
                        TOOLTIP_BORDER={TOOLTIP_BORDER}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="#ec4899" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ✅ 5. Press Length 70-x / 75-x với Tooltip Die Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Press Length 70-x / 75-x (mm)" height={260}>
            {press70Data.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={press70Data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip
                    content={
                      <HoleTooltip
                        tooltipStyle={tooltipStyle}
                        TEXT_COLOR={TEXT_COLOR}
                        TOOLTIP_BORDER={TOOLTIP_BORDER}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Hàng 3: Supplier + Status */}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <ChartCard title="📊 Số lượng Die theo Supplier" height={280}>
            {supplierChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierChartData} margin={{ top: 20, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="name"
                    stroke={MUTED_COLOR}
                    tick={{ fontSize: 10, fill: TEXT_COLOR }}
                    angle={-40}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <div className="col-12 col-lg-5">
          <ChartCard title="📊 Phân bố theo trạng thái" height={280}>
            {statusChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Bảng Die sắp hết tuổi thọ */}
      <div className="card-surface">
        <h6 className="mb-3">
          ⚠️ Die sắp hết tuổi thọ (còn lại &lt; 20% tiêu chuẩn)
          {stats.lowLifeDanger.length > 0 && (
            <span className="badge bg-danger ms-2">{stats.lowLifeDanger.length}</span>
          )}
        </h6>
        {stats.lowLifeDanger.length === 0 ? (
          <EmptyState message="Không có Die nào sắp hết tuổi thọ" />
        ) : (
          <div className="table-responsive-wrap">
            <table className="table align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>Dies Model</th>
                  <th>Dies Code</th>
                  <th>Press Length</th>
                  <th>Tiêu chuẩn (tấn)</th>
                  <th>Đã dùng (tấn)</th>
                  <th>Còn lại (tấn)</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowLifeDanger.slice(0, 20).map((w, idx) => {
                  const std = Number(w.standard_ton ?? 0);
                  const used = Number(w.dies_life_ton ?? 0);
                  const remaining = std - used;
                  const percent = std > 0 ? Math.round((remaining / std) * 100) : 0;
                  return (
                    <tr key={w.id}>
                      <td>{idx + 1}</td>
                      <td className="fw-semibold">{w.dies_model || '—'}</td>
                      <td>{w.dies_code || '—'}</td>
                      <td>{w.press_length_mm || '—'}</td>
                      <td>{fmtNum(std)}</td>
                      <td>{fmtNum(used)}</td>
                      <td className="fw-semibold text-danger">{fmtNum(remaining)}</td>
                      <td>
                        <span className="badge bg-danger">{percent}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}