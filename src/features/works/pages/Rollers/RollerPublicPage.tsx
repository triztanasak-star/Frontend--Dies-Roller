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

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function RollerPublicPage() {  // ✅ Đổi tên function
  const { id } = useParams<{ id: string }>();
  const workId = Number(id);

  const { data, isLoading, isError } = useQuery({
    // ✅ Đổi queryKey để không trùng cache với Die
    queryKey: ['roller-public', workId],
    queryFn: () => db.getWorkPublic(workId),
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
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          padding: '24px',
          borderRadius: 12,
          marginBottom: 20,
          textAlign: 'center',
        }}>
          {/* ✅ Đổi text hiển thị */}
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: 4 }}>
            THÔNG TIN ROLLER
          </div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
            {work.dies_model || 'Không xác định'}
          </h1>
          <div style={{ fontSize: '1rem', marginTop: 8, opacity: 0.9 }}>
            {/* ✅ Đổi text hiển thị */}
            Mã trục: <strong>{work.dies_code || '—'}</strong>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: Number(work.status) === 0 ? '#22c55e' : '#f59e0b',
          color: '#fff',
          borderRadius: 999,
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: 16,
        }}>
          {STATUS_LABELS[Number(work.status)] ?? '—'}
        </div>

        {/* Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* ✅ Đổi label hiển thị, giữ nguyên tên field */}
          <InfoCard label="Roller Model" value={work.dies_model} />
          <InfoCard label="Roller Code" value={work.dies_code} />
          <InfoCard label="Supplier" value={work.supplier} />
          <InfoCard label="Roller Hole (mm)" value={fmtNum(work.dies_hole_mm)} />
          <InfoCard label="Press Length (mm)" value={work.press_length_mm} />
          <InfoCard label="L/D Ratio" value={fmtNum(work.ld_ratio)} />
          <InfoCard label="Line in use" value={work.line_in_use} />
          <InfoCard label="Tiêu chuẩn (tấn)" value={fmtNum(work.standard_ton)} />
          <InfoCard label="Số tấn đã dùng" value={fmtNum(work.dies_life_ton)} />
          <InfoCard label="Số tấn còn lại" value={fmtNum(work.remaining_tons)} highlight />
          <InfoCard label="Giá Roller (VND)" value={fmtNum(work.dies_price_vnd)} />
          <InfoCard label="VNĐ/tấn" value={fmtNum(work.price_per_ton_vnd)} />
        </div>

        {/* Symptom / Note */}
        {work.symptom && (
          <div style={{
            background: 'rgba(148, 163, 184, 0.1)',
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            border: '1px solid rgba(148, 163, 184, 0.2)',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>
              GHI CHÚ / SYMPTOM
            </div>
            <div style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {work.symptom}
            </div>
          </div>
        )}

        {/* Dates */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          <InfoCard label="Ngày nhập kho" value={fmtDate(work.created_at)} />
          <InfoCard label="Start Date" value={fmtDate(work.expected_deadline)} />
          <InfoCard label="End Date" value={fmtDate(work.completed_at)} />
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 32,
          fontSize: '0.8rem',
          color: '#64748b',
        }}>
          {/* ✅ Đổi text footer */}
          Dies Roller Manager — Feed Digital
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.08)',
      border: highlight ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: highlight ? '#22c55e' : '#e5e7eb',
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}