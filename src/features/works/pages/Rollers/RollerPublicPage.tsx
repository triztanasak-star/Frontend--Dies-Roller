import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as db from '../../../../lib/db';
import LoadingOverlay from '../../../../components/LoadingOverlay';
import ErrorState from '../../../../components/ErrorState';

const STATUS_LABELS: Record<number, string> = {
  0: 'Trong kho',
  1: 'Đang sử dụng',
  2: 'Chờ mài',
  3: 'Chờ sử dụng',
  4: 'Hết tuổi thọ',
  5: 'Hư bể',
  6: 'Đang đặt',
};

function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 3,
  }).format(n);
}

function fmtDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function RollerPublicPage() {
  const { id } = useParams<{ id: string }>();
  const workId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['roller-public', workId],
    queryFn: () => db.getWorkPublic(workId, 'roller'),
    enabled: !isNaN(workId) && workId > 0,
  });

  if (isLoading) return <LoadingOverlay />;
  if (isError || !data) return <ErrorState />;

  const work = data;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--card-bg, #0f172a)',
      color: 'var(--text-color, #e5e7eb)',
      padding: '24px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      // ✅ THÊM 2 DÒNG NÀY ĐỂ CHO PHÉP VUỐT
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: '40px' }}>
        
        {/* ============ HEADER ============ */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          padding: '24px',
          borderRadius: 12,
          marginBottom: 20,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: 4 }}>
            THÔNG TIN ROLLER
          </div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
            {work.dies_model || 'Không xác định'}
          </h1>
          <div style={{ fontSize: '1rem', marginTop: 8, opacity: 0.9 }}>
            Mã trục: <strong>{work.dies_code || '—'}</strong>
          </div>
        </div>

        {/* ============ STATUS BADGE ============ */}
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: Number(work.status) === 0 ? '#22c55e' : '#f59e0b',
          color: '#fff',
          borderRadius: 999,
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: 20,
        }}>
          {STATUS_LABELS[Number(work.status)] ?? '—'}
        </div>

        {/* ============ PHẦN 1: THÔNG TIN ROLLER ============ */}
        <SectionTitle title="📦 THÔNG TIN ROLLER" />
        <div style={gridStyle}>
          <InfoCard label="Roller Model" value={work.dies_model} />
          <InfoCard label="Roller Code (Mã trục)" value={work.dies_code} />
          <InfoCard label="Supplier" value={work.supplier} />
          <InfoCard label="Roller Shell Hole (mm)" value={fmtNum(work.dies_hole_mm)} />
          <InfoCard label="Roller Shell Type" value={work.press_length_mm} />
          <InfoCard label="Line in use" value={work.line_in_use} />
        </div>

        {/* ============ PHẦN 2: TẤN & GIÁ ============ */}
        <SectionTitle title="📊 TẤN & GIÁ" />
        <div style={gridStyle}>
          <InfoCard label="Tiêu chuẩn (tấn)" value={fmtNum(work.standard_ton)} />
          <InfoCard label="Số tấn sử dụng" value={fmtNum(work.dies_life_ton)} />
          <InfoCard label="Số tấn còn lại" value={fmtNum(work.remaining_tons)} highlight />
          <InfoCard label="Giá Roller (VND)" value={fmtNum(work.dies_price_vnd)} />
          <InfoCard label="VNĐ/tấn" value={fmtNum(work.price_per_ton_vnd)} />
          <InfoCard label="VNĐ/tấn Standard" value={fmtNum(work.result_cost_per_ton_vnd)} />
        </div>

        {/* ============ PHẦN 3: NGÀY THÁNG ============ */}
        <SectionTitle title="📅 NGÀY THÁNG" />
        <div style={gridStyle}>
          <InfoCard label="Ngày nhập kho (Ngày tạo)" value={fmtDateTime(work.created_at)} />
          <InfoCard label="Start Date" value={fmtDate(work.expected_deadline)} />
          <InfoCard label="End Date (Hoàn thành)" value={fmtDateTime(work.completed_at)} />
        </div>

        {/* ============ PHẦN 4: GHI CHÚ / SYMPTOM ============ */}
        {work.symptom && (
          <>
            <SectionTitle title="📝 GHI CHÚ / SYMPTOM" />
            <div style={boxStyle}>
              {work.symptom}
            </div>
          </>
        )}

        {/* ============ PHẦN 5: LỊCH SỬ ROLLER ============ */}
        {work.progress_comment && (
          <>
            <SectionTitle title="🕓 LỊCH SỬ ROLLER" />
            <div style={boxStyle}>
              {work.progress_comment}
            </div>
          </>
        )}

        {/* ============ PHẦN 6: BÌNH LUẬN QUẢN LÝ ============ */}
        {work.manager_comment && (
          <>
            <SectionTitle title="👔 BÌNH LUẬN QUẢN LÝ" />
            <div style={boxStyle}>
              {work.manager_comment}
            </div>
          </>
        )}

        {/* ============ FOOTER ============ */}
        <div style={{
          textAlign: 'center',
          marginTop: 40,
          fontSize: '0.8rem',
          color: '#64748b',
        }}>
          Dies Roller Manager — Feed Digital
        </div>
      </div>
    </div>
  );
}

// ... (Các component SectionTitle, InfoCard, gridStyle, boxStyle giữ nguyên như cũ)
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  marginBottom: 24,
};

const boxStyle = {
  background: 'rgba(148, 163, 184, 0.1)',
  padding: 16,
  borderRadius: 8,
  marginBottom: 24,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  fontSize: '0.95rem',
  whiteSpace: 'pre-wrap' as const,
  lineHeight: '1.6',
};

function SectionTitle({ title }: { title: string }) {
  return (
    <h6 style={{
      fontSize: '0.85rem',
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 0,
    }}>
      {title}
    </h6>
  );
}

function InfoCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.08)',
      border: highlight ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.95rem',
        fontWeight: 600,
        color: highlight ? '#22c55e' : '#e5e7eb',
        wordBreak: 'break-word',
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}