import { useMemo, useState, type FormEvent } from 'react';
import { useCreateTaskPlan, useDeleteTaskPlan, useTaskPlans, useUpdateTaskPlan } from '../hooks/useWorks';
import EmptyState from '../../../components/EmptyState';
import type { TaskPlan } from '../../../lib/db';

const STATUS_LABEL: Record<TaskPlan['status'], string> = {
  pending: 'Chưa bắt đầu',
  in_progress: 'Đang thực hiện',
  done: 'Hoàn thành',
};

export default function TaskPlansPanel({ workId, canEdit }: { workId: number; canEdit: boolean }) {
  const { data, isLoading } = useTaskPlans(workId);
  const createPlan = useCreateTaskPlan();
  const updatePlan = useUpdateTaskPlan(workId);
  const deletePlan = useDeleteTaskPlan(workId);
  const [stepName, setStepName] = useState('');

  const plans = useMemo(() => data?.documents ?? [], [data]);
  const averagePercent = useMemo(() => {
    if (plans.length === 0) return null;
    return Math.round(plans.reduce((sum, p) => sum + p.progress_percent, 0) / plans.length);
  }, [plans]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!stepName.trim()) return;
    await createPlan.mutateAsync({ workId, payload: { step_name: stepName } });
    setStepName('');
  };

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Kế hoạch thực hiện (hạng mục)</h6>
        {averagePercent !== null && (
          <span className="text-muted small">Tổng tiến độ trung bình: <strong>{averagePercent}%</strong></span>
        )}
      </div>
      {canEdit && (
        <form className="d-flex gap-2 mb-3" onSubmit={handleAdd}>
          <input
            className="form-control form-control-sm"
            placeholder="Thêm hạng mục mới..."
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
          />
          <button type="submit" className="btn btn-sm btn-primary" disabled={createPlan.isPending}>
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
                type="number"
                min={0}
                max={100}
                className="form-control form-control-sm"
                style={{ width: 80 }}
                defaultValue={plan.progress_percent}
                disabled={!canEdit}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value !== plan.progress_percent) {
                    updatePlan.mutate({ id: plan.id, payload: { progress_percent: value } });
                  }
                }}
              />
              <span className="text-muted small">%</span>
              <select
                className="form-select form-select-sm"
                value={plan.status}
                disabled={!canEdit}
                onChange={(e) => updatePlan.mutate({ id: plan.id, payload: { status: e.target.value as TaskPlan['status'] } })}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {canEdit && (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deletePlan.mutate(plan.id)}>
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
