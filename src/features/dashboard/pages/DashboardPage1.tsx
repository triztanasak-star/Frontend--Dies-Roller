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

// Trạng thái Roller
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

// Model Roller
const MODEL_ORDER = ['CPM 7726SW', 'PM 717-TW', 'CPM 7730SW'];
const MODEL_COLORS: Record<string, string> = {
  'PM 717-TW': '#3b82f6',
  'CPM 7726SW': '#22c55e',
  'CPM 7730SW': '#f59e0b',
};

// ✅ MỤC 6: Roller Shell Hole (mm)
const SHELL_HOLE_ORDER = ['8x10', '8x12', '6x8', '6x9', '6x10', 'No Hole'];

const LINE_ORDER = ['PL#1', 'PL#2', 'PL#3', 'PL#4', 'PL#5'];

// ✅ MỤC 7: Roller Shell Type
const SHELL_TYPE_ORDER = [
  'Dimpled',
  'Corrugate closed end',
  'Corrugate open end',
  'Corrugate with dimpled end',
  'Fish bone',
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

// ============================================================
// Dashboard Rollers
// ============================================================
export default function DashboardPage1() {
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

  // ✅ LẤY DỮ LIỆU TỪ BẢNG digital_roller_works
  const rollersQuery = useQuery({
    queryKey: ['rollers', 'dashboard'],
    queryFn: () => db.listWorks({ limit: 500, type: 'roller' }),
  });

  // ✅ THÊM: Query lấy dữ liệu cấu hình từ bảng app_settings
  const settingsQuery = useQuery({
    queryKey: ['settings', 'dashboard'],
    queryFn: () => db.listSettings(),
  });

  const rollers = useMemo(
    () => rollersQuery.data?.documents ?? [],
    [rollersQuery.data],
  );

  const settings = useMemo(
    () => settingsQuery.data?.documents ?? [],
    [settingsQuery.data],
  );

  // ============================================================
  // Stats tổng
  // ============================================================
  const stats = useMemo(() => {
    const total = rollers.length;

    let totalStandardTon = 0;
    let totalUsedTon = 0;
    let totalRemaining = 0;
    let totalValue = 0;

    const byModel: Record<string, number> = {};
    const byShellHole: Record<string, number> = {};
    const byShellType: Record<string, number> = {};
    const byLine: Record<string, number> = {};
    const bySupplier: Record<string, number> = {};
    const byStatus: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    const lowLifeDanger: DigitalWork[] = [];

    rollers.forEach((r) => {
      const std = r.standard_ton != null ? Number(r.standard_ton) : 0;
      const used = r.dies_life_ton != null ? Number(r.dies_life_ton) : 0;
      const remaining = std - used;

      totalStandardTon += std;
      totalUsedTon += used;
      totalRemaining += remaining;
      totalValue += r.dies_price_vnd != null ? Number(r.dies_price_vnd) : 0;

      if (r.dies_model) byModel[r.dies_model] = (byModel[r.dies_model] ?? 0) + 1;

      if (r.dies_hole_mm != null) {
        const hole = String(r.dies_hole_mm);
        byShellHole[hole] = (byShellHole[hole] ?? 0) + 1;
      }

      if (r.press_length_mm) {
        byShellType[r.press_length_mm] = (byShellType[r.press_length_mm] ?? 0) + 1;
      }

      if (r.line_in_use) {
        const lines = r.line_in_use.split(',').map((s) => s.trim()).filter(Boolean);
        lines.forEach((l) => {
          byLine[l] = (byLine[l] ?? 0) + 1;
        });
      }
      if (r.supplier) {
        const sup = r.supplier.trim().toUpperCase();
        bySupplier[sup] = (bySupplier[sup] ?? 0) + 1;
      }
      if (r.status !== undefined) {
        byStatus[Number(r.status)] = (byStatus[Number(r.status)] ?? 0) + 1;
      }

      if (std > 0 && remaining / std < 0.2 && remaining >= 0) {
        lowLifeDanger.push(r);
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
      byShellHole,
      byShellType,
      byLine,
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
  }, [rollers]);

  // ============================================================
  // Chart data
  // ============================================================
  const modelChartData = useMemo(() => {
    const known = MODEL_ORDER.filter((m) => stats.byModel[m] != null);
    return known.map((m) => ({
      name: m,
      count: stats.byModel[m],
      fill: MODEL_COLORS[m] ?? '#3b82f6',
    }));
  }, [stats.byModel]);

  // ✅ MỤC 6: Chart data cho Roller Shell Hole
  const shellHoleChartData = useMemo(() => {
    const known = SHELL_HOLE_ORDER.filter((h) => stats.byShellHole[h] != null);
    return known.map((h) => ({ name: h, count: stats.byShellHole[h] }));
  }, [stats.byShellHole]);

  // ✅ MỤC 7: Chart data cho Roller Shell Type
  const shellTypeChartData = useMemo(() => {
    const known = SHELL_TYPE_ORDER.filter((t) => stats.byShellType[t] != null);
    return known.map((t) => ({ name: t, count: stats.byShellType[t] }));
  }, [stats.byShellType]);

  const lineChartData = useMemo(() => {
    const known = LINE_ORDER.filter((l) => stats.byLine[l] != null);
    return known.map((l) => ({ name: l, count: stats.byLine[l] }));
  }, [stats.byLine]);

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

  // ✅ CẤU HÌNH ROLLER: Mỗi cột là 1 cặp (Model + Shell Type)
  // Dữ liệu lấy từ bảng app_settings, lọc key bắt đầu bằng 'std_roller_'
  const configByShellTypeData = useMemo(() => {
    const items: {
      name: string;           // Label trên trục X: "CPM 7726SW | Dimpled"
      model: string;          // Model để tô màu
      shellType: string;      // Roller Shell Type
      standardTon: number;    // Standard Ton
    }[] = [];

    settings.forEach((s) => {
      // ✅ CHỈ LẤY KEY CỦA ROLLER (bỏ qua Die)
      // Với Roller, trường press_length_mm trong DB thực chất lưu Shell Type
      if (s.key.startsWith('std_roller_') && s.dies_model && s.press_length_mm) {
        items.push({
          name: `${s.dies_model} | ${s.press_length_mm}`, // "CPM 7726SW | Dimpled"
          model: s.dies_model,
          shellType: s.press_length_mm,
          standardTon: Number(s.value || 0),
        });
      }
    });

    // Sắp xếp theo MODEL_ORDER, sau đó theo SHELL_TYPE_ORDER
    items.sort((a, b) => {
      const modelIdxA = MODEL_ORDER.indexOf(a.model);
      const modelIdxB = MODEL_ORDER.indexOf(b.model);
      if (modelIdxA !== modelIdxB) {
        return (modelIdxA === -1 ? 999 : modelIdxA) - (modelIdxB === -1 ? 999 : modelIdxB);
      }
      const typeIdxA = SHELL_TYPE_ORDER.indexOf(a.shellType);
      const typeIdxB = SHELL_TYPE_ORDER.indexOf(b.shellType);
      return (typeIdxA === -1 ? 999 : typeIdxA) - (typeIdxB === -1 ? 999 : typeIdxB);
    });

    return items;
  }, [settings]);

  // ============================================================
  // Loading / Error
  // ============================================================
  if (rollersQuery.isLoading || settingsQuery.isLoading) return <LoadingOverlay />;
  if (rollersQuery.isError || settingsQuery.isError) return <ErrorState />;

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
          <h1 className="h4 mb-0">Dashboard Rollers</h1>
        </div>
      </div>

      {/* 4 thẻ thống kê */}
      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <div className="card-surface h-100">
            <div className="text-muted small">TỔNG SỐ ROLLER</div>
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
            <div className="text-muted small">TỔNG GIÁ TRỊ ROLLER</div>
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

      {/* Hàng 1: Model + Shell Hole + Config */}
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Số lượng Roller theo Model" height={260}>
            {modelChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 10, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip contentStyle={tooltipStyle} />
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

        {/* ✅ MỤC 6: Roller Shell Hole */}
        <div className="col-12 col-lg-4">
          <ChartCard title="📊 Số lượng Roller theo Roller Shell Hole (mm)" height={260}>
            {shellHoleChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shellHoleChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={MUTED_COLOR} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <YAxis stroke={MUTED_COLOR} allowDecimals={false} tick={{ fontSize: 11, fill: TEXT_COLOR }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    <LabelList dataKey="count" {...labelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ✅ Biểu đồ cấu hình Roller theo Shell Type */}
        <div className="col-12 col-lg-4">
          <ChartCard title="⚙️ Cấu hình Standard Ton theo Shell Type (Roller)" height={280}>
            {configByShellTypeData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={configByShellTypeData}
                  margin={{ top: 25, right: 10, left: -20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="name"
                    stroke={MUTED_COLOR}
                    tick={{ fontSize: 9, fill: TEXT_COLOR }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
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
                            <div>Shell Type: <strong>{data.shellType}</strong></div>
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
                    {configByShellTypeData.map((entry, idx) => (
                      <Cell key={idx} fill={MODEL_COLORS[entry.model] ?? '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ✅ Hàng 2: Roller Shell Type (thay cho Chiều dài Roller) */}
      <div className="row g-3">
        <div className="col-12">
          <ChartCard title="📊 Số lượng Roller theo Roller Shell Type" height={300}>
            {shellTypeChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shellTypeChartData}
                  margin={{ top: 20, right: 10, left: -20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="name"
                    stroke={MUTED_COLOR}
                    tick={{ fontSize: 11, fill: TEXT_COLOR }}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                    interval={0}
                  />
                  <YAxis
                    stroke={MUTED_COLOR}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: TEXT_COLOR }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={60}>
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
          <ChartCard title="📊 Số lượng Roller theo Supplier" height={280}>
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

      {/* Bảng Roller sắp hết tuổi thọ */}
      <div className="card-surface">
        <h6 className="mb-3">
          ⚠️ Roller sắp hết tuổi thọ (còn lại &lt; 20% tiêu chuẩn)
          {stats.lowLifeDanger.length > 0 && (
            <span className="badge bg-danger ms-2">{stats.lowLifeDanger.length}</span>
          )}
        </h6>
        {stats.lowLifeDanger.length === 0 ? (
          <EmptyState message="Không có Roller nào sắp hết tuổi thọ" />
        ) : (
          <div className="table-responsive-wrap">
            <table className="table align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>Roller Model</th>
                  <th>Roller Code</th>
                  <th>Shell Hole</th>
                  <th>Shell Type</th>
                  <th>Tiêu chuẩn (tấn)</th>
                  <th>Đã dùng (tấn)</th>
                  <th>Còn lại (tấn)</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowLifeDanger.slice(0, 20).map((r, idx) => {
                  const std = Number(r.standard_ton ?? 0);
                  const used = Number(r.dies_life_ton ?? 0);
                  const remaining = std - used;
                  const percent = std > 0 ? Math.round((remaining / std) * 100) : 0;
                  return (
                    <tr key={r.id}>
                      <td>{idx + 1}</td>
                      <td className="fw-semibold">{r.dies_model || '—'}</td>
                      <td>{r.dies_code || '—'}</td>
                      <td>{r.dies_hole_mm != null ? String(r.dies_hole_mm) : '—'}</td>
                      <td>{r.press_length_mm || '—'}</td>
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