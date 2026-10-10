import { useMemo, useState, useRef, useEffect, type FormEvent } from 'react';
// ✅ Sửa: thêm 1 cấp ../ vì file nằm trong thư mục Rollers/
import { useCreateTaskPlan, useDeleteTaskPlan, useTaskPlans, useUpdateTaskPlan } from '../../hooks/useWorks';
import EmptyState from '../../../../components/EmptyState';
import type { TaskPlan } from '../../../../lib/db';

// ✅ Helper: Format số nguyên có dấu chấm phân cách hàng nghìn
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return '';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(value)));
};

// ✅ Helper: Parse chuỗi "2.000" → số 2000
const parseFormattedNumber = (str: string): number | null => {
  if (!str) return null;
  const cleaned = String(str).replace(/\./g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

// ✅ Helper: Format input khi đang nhập: "2000" → "2.000"
const formatInputValue = (str: string): string => {
  if (!str) return '';
  const cleaned = String(str).replace(/\./g, '').replace(/[^\d]/g, '');
  if (!cleaned) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(cleaned));
};

export default function RollerTaskPlansPanel({ workId, canEdit }: { workId: number; canEdit: boolean }) {
  // ✅ SỬA: Truyền 'roller' để lấy đúng kế hoạch của Roller
  const { data, isLoading } = useTaskPlans(workId, 'roller');
  
  // ✅ SỬA: Truyền 'roller' vào các mutation (nếu hook của bạn hỗ trợ tham số thứ 2)
  const createPlan = useCreateTaskPlan('roller'); 
  const updatePlan = useUpdateTaskPlan(workId, 'roller');
  const deletePlan = useDeleteTaskPlan(workId, 'roller');

  const [stepName, setStepName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tons, setTons] = useState('');
  const [tonsInputs, setTonsInputs] = useState<Record<number, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [stepName]);

  const plans = useMemo(() => {
    const raw = data?.documents ?? [];
    return [...raw].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }, [data]);

  // ✅ Khi plans thay đổi, cập nhật state formatted cho từng plan
  useEffect(() => {
    const newInputs: Record<number, string> = {};
    plans.forEach((p) => {
      newInputs[p.id] = formatNumber(p.progress_percent);
    });
    setTonsInputs(newInputs);
  }, [plans]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!stepName.trim()) return;

    await createPlan.mutateAsync({
      workId,
      payload: {
        step_name: stepName,
        ...(dueDate && { due_date: dueDate }),
        ...(tons !== '' && { progress_percent: Number(parseFormattedNumber(tons) ?? 0) }),
      },
    });

    setStepName('');
    setDueDate('');
    setTons('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="mt-3">
      <div className="mb-2">
        <h6 className="mb-0">Kế hoạch thực hiện (hạng mục)</h6>
      </div>

      {canEdit && (
        <form className="d-flex gap-2 mb-3 align-items-start" onSubmit={handleAdd}>
          <textarea
            ref={textareaRef}
            className="form-control form-control-sm"
            placeholder="Thêm hạng mục mới..."
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            rows={1}
            style={{
              resize: 'none',
              overflow: 'hidden',
              minHeight: '31px',
              lineHeight: '1.5',
              paddingTop: '4px',
              paddingBottom: '4px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              flex: 1,
            }}
          />

          <input
            type="text"
            inputMode="numeric"
            className="form-control form-control-sm"
            value={tons}
            onChange={(e) => setTons(formatInputValue(e.target.value))}
            placeholder="Số tấn"
            style={{ width: 100, flexShrink: 0 }}
            title="Số tấn"
          />

          <input
            type="date"
            className="form-control form-control-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ width: 150, flexShrink: 0 }}
            title="Ngày hoàn thành dự kiến"
          />

          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={createPlan.isPending}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Thêm
          </button>
        </form>
      )}

      {isLoading && <div className="text-muted small">Đang tải kế hoạch...</div>}
      {!isLoading && plans.length === 0 && <EmptyState message="Chưa có hạng mục nào." />}

      <ul className="list-group">
        {plans.map((plan) => (
          <li key={plan.id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
            <span className="flex-grow-1">{plan.step_name}</span>
            <div className="d-flex gap-2 align-items-center">

              <input
                type="text"
                inputMode="numeric"
                className="form-control form-control-sm"
                style={{ width: 100 }}
                value={tonsInputs[plan.id] ?? ''}
                disabled={!canEdit}
                onChange={(e) => {
                  const formatted = formatInputValue(e.target.value);
                  setTonsInputs((prev) => ({ ...prev, [plan.id]: formatted }));
                }}
                onBlur={(e) => {
                  const formatted = formatInputValue(e.target.value);
                  const numValue = parseFormattedNumber(formatted) ?? 0;
                  setTonsInputs((prev) => ({ ...prev, [plan.id]: formatNumber(numValue) }));
                  if (numValue !== Number(plan.progress_percent)) {
                    updatePlan.mutate({ id: plan.id, payload: { progress_percent: numValue } });
                  }
                }}
              />
              <span className="text-muted small">ton</span>

              <input
                type="date"
                className="form-control form-control-sm"
                style={{ width: 150 }}
                defaultValue={plan.due_date || ''}
                disabled={!canEdit}
                title="Ngày hoàn thành dự kiến"
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value !== (plan.due_date || '')) {
                    updatePlan.mutate({
                      id: plan.id,
                      payload: {
                        ...(value ? { due_date: value } : {}),
                      },
                    });
                  }
                }}
              />

              {canEdit && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => deletePlan.mutate(plan.id)}
                >
                  Xoá
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}