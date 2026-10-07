import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FiPaperclip, FiImage } from 'react-icons/fi';
import * as db from '../../../../lib/db';
import type { DigitalWork } from '../../../../lib/db';

// ✅ Helper: Format số có dấu chấm phân cách
function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

// ✅ Helper: Format ngày
function fmtDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale);
}

// ✅ Helper: Format ngày giờ
function fmtDateTime(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale);
}

// ============================================================
// Component hiển thị danh sách tài liệu đính kèm
// ============================================================
function WorkAttachmentsList({ workId, category }: { workId: number; category?: 'after_work' | 'before_work' }) {
  const { data } = useQuery({
    queryKey: ['work_attachments', workId],
    queryFn: () => db.listAttachments(workId),
  });

  const attachments = (data?.documents ?? []).filter((f: any) =>
    category ? f.category === category : !f.category || (f.category !== 'after_work' && f.category !== 'before_work')
  );

  if (attachments.length === 0) {
    return <span className="text-muted small">—</span>;
  }

  const handleDownload = async (
    e: React.MouseEvent,
    fileUrl?: string,
    fileName?: string
  ) => {
    e.preventDefault();
    if (!fileUrl) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="d-flex flex-column gap-1">
      {attachments.map((file: any) => {
        const fileUrl = file.url || file.file_path;
        const isImage = file.mime_type?.startsWith('image/');
        return (
          <a
            key={file.id}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => handleDownload(e, fileUrl, file.original_name)}
            className="text-decoration-none small d-flex align-items-center gap-1"
            style={{ cursor: 'pointer' }}
            title={file.original_name}
          >
            {isImage ? <FiImage size={12} /> : <FiPaperclip size={12} />}
            {' '}{file.original_name}
          </a>
        );
      })}
    </div>
  );
}

// ============================================================
// MODAL CHI TIẾT DIE
// ============================================================
interface WorkDetailModalProps {
  work: DigitalWork | null;
  onClose: () => void;
}

export default function WorkDetailModal({ work, onClose }: WorkDetailModalProps) {
  const { t, i18n } = useTranslation();

  if (!work) return null;

  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const STATUS_LABELS: Record<number, string> = {
    0: 'Trong kho',
    1: 'Đang sử dụng',
    2: 'Chờ mài',
    3: 'Chờ sử dụng',
    4: 'Hết tuổi thọ',
    5: 'Hư bể',
    6: 'Đang đặt',
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div
          className="modal-content"
          style={{
            background: 'var(--card-bg, #1a1d2e)',
            color: 'var(--text-color, #fff)',
          }}
        >
          {/* Header */}
          <div className="modal-header border-secondary">
            <h5 className="modal-title">
              Chi tiết Die:{' '}
              <span className="text-primary">
                {work.dies_model || work.task_name}
              </span>
              {work.dies_code && (
                <span className="text-muted ms-2">({work.dies_code})</span>
              )}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body">

            {/* ============ PHẦN 1: THÔNG TIN DIES ============ */}
            <h6 className="text-muted text-uppercase small mb-3">
              📦 THÔNG TIN DIES
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <label className="text-muted small d-block">Dies Model</label>
                <span className="fw-semibold">{work.dies_model || '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Dies Code (Mã khuôn)</label>
                <span className="fw-semibold">{work.dies_code || '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Supplier</label>
                <span>{work.supplier || '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Dies Hole (mm)</label>
                <span>{work.dies_hole_mm ?? '—'}</span>
              </div>

              <div className="col-md-3">
                <label className="text-muted small d-block">Press Length (mm)</label>
                <span>{work.press_length_mm || '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">L/D Ratio</label>
                <span>{work.ld_ratio ?? '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Line in use</label>
                <span>{work.line_in_use || '—'}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Trạng thái</label>
                <span>{STATUS_LABELS[Number(work.status)] ?? '—'}</span>
              </div>
            </div>

            <hr className="border-secondary" />

            {/* ============ PHẦN 2: TẤN & GIÁ ============ */}
            <h6 className="text-muted text-uppercase small mb-3">
              📊 TẤN & GIÁ
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <label className="text-muted small d-block">Tiêu chuẩn (tấn)</label>
                <span className="fw-semibold">{fmtNum(work.standard_ton)}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Số tấn sử dụng</label>
                <span className="fw-semibold">{fmtNum(work.dies_life_ton)}</span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Số tấn còn lại</label>
                <span className="fw-semibold text-success">
                  {fmtNum(work.remaining_tons)}
                </span>
              </div>
              <div className="col-md-3">
                <label className="text-muted small d-block">Giá Die (VND)</label>
                <span className="fw-semibold">{fmtNum(work.dies_price_vnd)}</span>
              </div>

              <div className="col-md-3">
                <label className="text-muted small d-block">VNĐ/tấn</label>
                <span className="fw-semibold">{fmtNum(work.price_per_ton_vnd)}</span>
              </div>
              {/* ✅ ĐÃ ĐỔI TÊN */}
              <div className="col-md-3">
                <label className="text-muted small d-block">VNĐ/tấn Standard</label>
                <span className="fw-semibold">{fmtNum(work.result_cost_per_ton_vnd)}</span>
              </div>
            </div>

            <hr className="border-secondary" />

            {/* ============ PHẦN 3: NGÀY THÁNG ============ */}
            <h6 className="text-muted text-uppercase small mb-3">
              📅 NGÀY THÁNG
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="text-muted small d-block">Ngày nhập kho (Ngày tạo)</label>
                <span>{fmtDateTime(work.created_at, locale)}</span>
              </div>
              <div className="col-md-4">
                <label className="text-muted small d-block">Start Date</label>
                <span>{fmtDate(work.expected_deadline, locale)}</span>
              </div>
              <div className="col-md-4">
                <label className="text-muted small d-block">End Date (Hoàn thành)</label>
                <span>{fmtDateTime(work.completed_at, locale)}</span>
              </div>
            </div>

            {/* ============ PHẦN 4: GHI CHÚ / SYMPTOM ============ */}
            {work.symptom && (
              <>
                <hr className="border-secondary" />
                <h6 className="text-muted text-uppercase small mb-3">
                  📝 GHI CHÚ / SYMPTOM
                </h6>
                <div
                  className="p-3 rounded mb-4"
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color, #2d3748)',
                  }}
                >
                  {work.symptom}
                </div>
              </>
            )}

            <hr className="border-secondary" />

            {/* ============ PHẦN 5: TÀI LIỆU ĐÍNH KÈM ============ */}
            <h6 className="text-muted text-uppercase small mb-3">
              📎 TÀI LIỆU & HÌNH ẢNH
            </h6>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="text-muted small d-block">Tài liệu đính kèm</label>
                <WorkAttachmentsList workId={work.id} />
              </div>
              <div className="col-md-6">
                <label className="text-muted small d-block">Hình ảnh hiện tại</label>
                <WorkAttachmentsList workId={work.id} category="after_work" />
              </div>
            </div>

            <hr className="border-secondary" />

            {/* ============ PHẦN 6: LỊCH SỬ DIE ============ */}
            {work.progress_comment && (
              <>
                <h6 className="text-muted text-uppercase small mb-3">
                  🕓 LỊCH SỬ DIE
                </h6>
                <div
                  className="p-3 rounded"
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color, #2d3748)',
                  }}
                >
                  {work.progress_comment}
                </div>
              </>
            )}

            {/* ============ PHẦN 7: BÌNH LUẬN QUẢN LÝ ============ */}
            {work.manager_comment && (
              <>
                <hr className="border-secondary" />
                <h6 className="text-muted text-uppercase small mb-3">
                  👔 BÌNH LUẬN QUẢN LÝ
                </h6>
                <div
                  className="p-3 rounded"
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color, #2d3748)',
                  }}
                >
                  {work.manager_comment}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer border-secondary">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}