import { useMemo } from 'react';
import { useWorks } from '../../works/hooks/useWorks';

export default function FinancePage() {
  const workResult = useWorks();

  // Tự động quét mảng dữ liệu
  const works = useMemo(() => {
    if (!workResult) return [];
    if (Array.isArray(workResult)) return workResult;

    try {
      const keys = Object.keys(workResult);
      for (const key of keys) {
        const val = (workResult as any)[key];
        if (Array.isArray(val)) return val;
        
        if (val && typeof val === 'object') {
          const subKeys = Object.keys(val);
          for (const subKey of subKeys) {
            if (Array.isArray(val[subKey])) return val[subKey];
          }
        }
      }
    } catch (e) {
      console.error("Lỗi khi quét dữ liệu từ Proxy:", e);
    }

    return [];
  }, [workResult]);

  const loading = (workResult as any)?.loading || (workResult as any)?.isLoading || false;

  // Tính toán các chỉ số tổng quan
  const stats = useMemo(() => {
    let totalCapex = 0;
    let totalSaving = 0;

    works.forEach((w: any) => {
      totalCapex += Number(w.capex_amount || w.capex || 0);
      totalSaving += Number(w.estimated_saving_per_year || w.saving || w.estimated_saving || 0);
    });

    const paybackPeriod = totalSaving > 0 ? (totalCapex / totalSaving).toFixed(1) : '0';
    const cumulativeSaving5Years = totalSaving * 5;

    return {
      totalCapex,
      totalSaving,
      paybackPeriod,
      cumulativeSaving5Years,
    };
  }, [works]);

  const formatCurrency = (amount: number) => {
    if (!amount || isNaN(amount)) return '—';
    if (amount >= 1e9) {
      return `${(amount / 1e9).toFixed(2)} tỷ`;
    }
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  const formatRawNumber = (amount: number) => {
    if (!amount || isNaN(amount)) return '';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ/năm';
  };

  if (loading) {
    return <div className="p-4">Đang tải dữ liệu tài chính...</div>;
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: '16px',
      }}
    >
      {/* ✅ CSS cho bảng — chữ rõ ở cả light và dark mode */}
      <style>{`
        .finance-table {
          color: var(--text-color, #e5e7eb);
        }
        .finance-table tbody td {
          color: var(--text-color, #e5e7eb) !important;
          border-color: rgba(148, 163, 184, 0.15) !important;
          vertical-align: middle;
        }
        .finance-table tbody tr:hover {
          background: rgba(148, 163, 184, 0.08);
        }
        .finance-table thead th {
          color: var(--text-color, #ffffff) !important;
          background: var(--card-bg, #1a1d2e) !important;
          border-bottom: 2px solid #334155 !important;
          font-weight: 600;
          padding: 12px 8px;
        }
        .finance-table .cell-name {
          color: var(--text-color, #f1f5f9) !important;
          font-weight: 600;
        }
        .finance-table .cell-capex {
          color: var(--text-color, #cbd5e1) !important;
        }
        .finance-table .cell-saving {
          color: #38bdf8 !important;
          font-weight: 600;
        }
        .finance-table .cell-payback {
          color: #4ade80 !important;
          font-weight: 600;
        }
        .finance-table .cell-benefit {
          color: var(--text-color, #cbd5e1) !important;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .finance-table .cell-empty {
          color: #64748b !important;
          opacity: 0.7;
        }
      `}</style>

      {/* 4 Thẻ thống kê tổng quan */}
      <div className="row g-3" style={{ flexShrink: 0 }}>
        <div className="col-md-3">
          <div className="card-surface h-100">
            <span className="text-muted small fw-bold text-uppercase">Tổng vốn đầu tư (CAPEX)</span>
            <h3 className="fw-bold mt-2 mb-1">{formatCurrency(stats.totalCapex)}</h3>
            <span className="text-muted small">{formatRawNumber(stats.totalCapex).replace('/năm', '')}</span>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card-surface h-100">
            <span className="text-muted small fw-bold text-uppercase">Tổng tiết kiệm / năm</span>
            <h3 className="fw-bold mt-2 mb-1" style={{ color: '#38bdf8' }}>
              {formatCurrency(stats.totalSaving)}
            </h3>
            <span className="text-muted small">{formatRawNumber(stats.totalSaving)}</span>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card-surface h-100">
            <span className="text-muted small fw-bold text-uppercase">Thời gian hoàn vốn</span>
            <h3 className="fw-bold mt-2 mb-1" style={{ color: '#4ade80' }}>
              {stats.paybackPeriod} năm
            </h3>
            <span className="text-muted small">Capex ÷ Saving/năm</span>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card-surface h-100">
            <span className="text-muted small fw-bold text-uppercase">Tiết kiệm tích lũy (5 năm)</span>
            <h3 className="fw-bold mt-2 mb-1" style={{ color: '#38bdf8' }}>
              {formatCurrency(stats.cumulativeSaving5Years)}
            </h3>
            <span className="text-muted small">Chưa trừ Capex</span>
          </div>
        </div>
      </div>

      {/* Bảng danh sách Capex & Saving */}
      <div
        className="card-surface"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          padding: 0,
        }}
      >
        <div
          className="d-flex justify-content-between align-items-center"
          style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}
        >
          <h5 className="mb-0 fw-bold">Danh sách Capex & Saving</h5>
          <span className="text-muted small">{works.length} khoản mục</span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            minHeight: 0,
          }}
        >
          <table className="table align-middle mb-0 finance-table">
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <tr>
                <th className="ps-3" style={{ width: '28%' }}>HẠNG MỤC / DỰ ÁN</th>
                <th style={{ width: '13%' }}>CAPEX (VND)</th>
                <th style={{ width: '14%' }}>SAVING (VND) / NĂM</th>
                <th className="text-center" style={{ width: '10%' }}>HOÀN VỐN</th>
                <th className="pe-3" style={{ width: '35%' }}>LỢI ÍCH KHÁC</th>
              </tr>
            </thead>
            <tbody>
              {works.map((work: any, index: number) => {
                const capexVal = Number(work.capex_amount || work.capex || 0);
                const savingVal = Number(work.estimated_saving_per_year || work.saving || work.estimated_saving || 0);
                
                let paybackVal = work.payback_years ? Number(work.payback_years) : 0;
                if (!paybackVal && savingVal > 0 && capexVal > 0) {
                  paybackVal = Number((capexVal / savingVal).toFixed(1));
                }

                const benefits = work.other_benefits || work.manager_comment || '';

                return (
                  <tr key={work.id || index}>
                    <td className="ps-3 cell-name">
                      {work.task_name || work.name || 'Không có tên'}{' '}
                      {work.factory_name ? `(${work.factory_name})` : ''}
                    </td>
                    <td className="cell-capex">
                      {capexVal ? (
                        new Intl.NumberFormat('vi-VN').format(capexVal)
                      ) : (
                        <span className="cell-empty">—</span>
                      )}
                    </td>
                    <td className="cell-saving">
                      {savingVal ? (
                        new Intl.NumberFormat('vi-VN').format(savingVal)
                      ) : (
                        <span className="cell-empty">—</span>
                      )}
                    </td>
                    <td className="text-center cell-payback">
                      {paybackVal ? `${paybackVal} năm` : <span className="cell-empty">—</span>}
                    </td>
                    <td className="pe-3 cell-benefit">
                      {benefits || <span className="cell-empty">—</span>}
                    </td>
                  </tr>
                );
              })}
              {works.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    Chưa có dữ liệu dự án nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}