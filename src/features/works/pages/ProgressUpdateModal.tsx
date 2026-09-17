import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from 'react';
import { listTaskPlans, createTaskPlan, updateTaskPlan, deleteTaskPlan, type DigitalWork, type MilestoneItem } from '../../../lib/db';

export interface ProgressFormValues {
  status: number;
  progress_percent: number;
  progress_comment: string;
  manager_comment: string;
  capex_amount: number | null;
  estimated_saving_per_year: number | null;
  payback_years: number | null;
}

export interface ProgressUpdateModalHandle {
  open: (work: DigitalWork) => void;
}

interface ProgressUpdateModalProps {
  canEditFinance?: boolean;
  isReviewer?: boolean;
  onSubmit: (workId: number, values: Partial<ProgressFormValues>) => Promise<void>;
}

const ProgressUpdateModal = forwardRef<ProgressUpdateModalHandle, ProgressUpdateModalProps>(
  ({ onSubmit }, ref) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [workId, setWorkId] = useState<number | null>(null);
    const [taskName, setTaskName] = useState('');
    
    const [form, setForm] = useState<ProgressFormValues>({
      status: 0, 
      progress_percent: 0, 
      progress_comment: '', 
      manager_comment: '', 
      capex_amount: null,
      estimated_saving_per_year: null,
      payback_years: null,
    });

    const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
    const [newMilestoneName, setNewMilestoneName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const showFinanceSection = true;

    useImperativeHandle(ref, () => ({
      open: async (work: DigitalWork) => {
        setWorkId(work.id);
        setTaskName(work.task_name || '');

        setForm({
          status: work.status ?? 0,
          progress_percent: work.progress_percent ?? 0,
          progress_comment: work.progress_comment ?? '',
          manager_comment: work.manager_comment ?? '',
          capex_amount: work.capex_amount !== null && work.capex_amount !== undefined ? Number(work.capex_amount) : null,
          estimated_saving_per_year: work.estimated_saving_per_year !== null && work.estimated_saving_per_year !== undefined ? Number(work.estimated_saving_per_year) : null,
          payback_years: work.payback_years !== null && work.payback_years !== undefined ? Number(work.payback_years) : null,
        });

        try {
          const res: any = await listTaskPlans(work.id);
          const rawList = Array.isArray(res) ? res : (res?.documents || res?.data || []);
          
          const loadedPlans = rawList.map((p: any) => ({
            id: p.id,
            name: p.step_name || p.name,
            progress: p.progress_percent ?? p.progress ?? 0,
            status: p.status === 'done' || p.status === 'Hoàn thành' ? 'Hoàn thành' 
                    : p.status === 'in_progress' || p.status === 'Đang thực hiện' ? 'Đang thực hiện' 
                    : 'Chưa bắt đầu',
          }));
          setMilestones(loadedPlans);
        } catch (error) {
          console.error("Không thể tải danh sách hạng mục:", error);
          setMilestones([]);
        }

        if (modalRef.current && window.bootstrap) {
          const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalRef.current);
          modalInstance.show();
        }
      },
    }));

    const handleClose = () => {
      if (modalRef.current && window.bootstrap) {
        const modalInstance = window.bootstrap.Modal.getInstance(modalRef.current);
        modalInstance?.hide();
      }
    };

    const calculateAndUpdateFromMilestones = (updatedMilestones: MilestoneItem[]) => {
      if (updatedMilestones.length === 0) {
        setForm(prev => ({ ...prev, progress_percent: 0, status: 0, progress_comment: '' }));
        return;
      }

      const totalProgress = updatedMilestones.reduce((sum, item) => sum + Number(item.progress || 0), 0);
      const avgProgress = Math.round(totalProgress / updatedMilestones.length);

      const combinedNotes = updatedMilestones
        .map((item) => `- ${item.name}: ${item.progress}% [${item.status}]`)
        .join('\n');

      const allCompleted = updatedMilestones.every((item) => item.status === 'Hoàn thành' || Number(item.progress) === 100);
      const anyInProgress = updatedMilestones.some((item) => item.status === 'Đang thực hiện' || (Number(item.progress) > 0 && Number(item.progress) < 100));

      let computedStatus = 0;
      if (allCompleted) computedStatus = 2;
      else if (anyInProgress || avgProgress > 0) computedStatus = 1;

      setForm(prev => ({
        ...prev,
        progress_percent: avgProgress,
        status: computedStatus,
        progress_comment: combinedNotes,
      }));
    };

    const handleAddMilestone = async () => {
      if (!newMilestoneName.trim() || !workId) return;
      try {
        const createdPlan = await createTaskPlan(workId, {
          step_name: newMilestoneName.trim(),
          step_order: milestones.length + 1,
          progress_percent: 0,
        });

        const newItem: MilestoneItem = {
          id: createdPlan.id,
          name: createdPlan.step_name || newMilestoneName.trim(),
          progress: createdPlan.progress_percent ?? 0,
          status: 'Chưa bắt đầu',
        };

        const updated = [...milestones, newItem];
        setMilestones(updated);
        setNewMilestoneName('');
        calculateAndUpdateFromMilestones(updated);
      } catch (error) {
        console.error("Lỗi khi thêm hạng mục:", error);
      }
    };

    const handleDeleteMilestone = async (id: string | number) => {
      if (typeof id === 'number') {
        try {
          await deleteTaskPlan(id);
        } catch (error) {
          console.error("Lỗi khi xóa hạng mục trên server:", error);
          return;
        }
      }
      const updated = milestones.filter((item) => item.id !== id);
      setMilestones(updated);
      calculateAndUpdateFromMilestones(updated);
    };

    const handleUpdateMilestone = async (id: string | number, field: keyof MilestoneItem, val: any) => {
      const updated = milestones.map((item) => {
        if (item.id === id) {
          const itemUpdated = { ...item, [field]: val };
          if (field === 'progress') {
            const numVal = Number(val);
            if (numVal === 100) itemUpdated.status = 'Hoàn thành';
            else if (numVal > 0) itemUpdated.status = 'Đang thực hiện';
            else itemUpdated.status = 'Chưa bắt đầu';
          }
          return itemUpdated;
        }
        return item;
      });

      setMilestones(updated);
      calculateAndUpdateFromMilestones(updated);

      if (typeof id === 'number') {
        try {
          const target = updated.find(i => i.id === id);
          if (target) {
            let apiStatus: 'pending' | 'in_progress' | 'done' = 'pending';
            if (target.status === 'Hoàn thành') apiStatus = 'done';
            else if (target.status === 'Đang thực hiện') apiStatus = 'in_progress';

            await updateTaskPlan(id, {
              step_name: target.name,
              progress_percent: Number(target.progress),
              status: apiStatus,
            });
          }
        } catch (error) {
          console.error("Lỗi cập nhật hạng mục:", error);
        }
      }
    };

    const handleSubmit = async (event: FormEvent) => {
      event.preventDefault();
      if (workId === null) return;
      setIsSubmitting(true);
      try {
        const payload: Partial<ProgressFormValues> = {
          status: form.status,
          progress_percent: form.progress_percent,
          progress_comment: form.progress_comment,
          manager_comment: form.manager_comment,
          capex_amount: form.capex_amount,
          estimated_saving_per_year: form.estimated_saving_per_year,
          payback_years: form.payback_years,
        };

        await onSubmit(workId, payload);
        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="modal fade" ref={modalRef} tabIndex={-1} aria-hidden="true">
        <style>{`
          /* ✅ Ô input trong modal tự động theo theme */
          .progress-modal-input {
            background: var(--input-bg, rgba(148, 163, 184, 0.08)) !important;
            color: var(--text-color, #e5e7eb) !important;
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.25)) !important;
          }
          .progress-modal-input:focus {
            background: var(--input-bg, rgba(148, 163, 184, 0.12)) !important;
            color: var(--text-color, #e5e7eb) !important;
            border-color: var(--primary-color, #3b82f6) !important;
            box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.15) !important;
          }
          .progress-modal-input::placeholder {
            color: var(--text-muted, #94a3b8) !important;
            opacity: 0.7;
          }
          .progress-milestone-row {
            background: var(--milestone-bg, rgba(148, 163, 184, 0.08)) !important;
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2)) !important;
            border-radius: 6px;
          }
          .progress-milestone-empty {
            background: var(--milestone-bg, rgba(148, 163, 184, 0.05)) !important;
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.15)) !important;
          }

          /* Dark mode override */
          [data-theme="dark"] .progress-modal-input {
            background: rgba(30, 41, 59, 0.6) !important;
            color: #e5e7eb !important;
            border-color: rgba(148, 163, 184, 0.25) !important;
          }
          [data-theme="dark"] .progress-milestone-row {
            background: rgba(30, 41, 59, 0.4) !important;
            border-color: rgba(148, 163, 184, 0.15) !important;
          }
        `}</style>

        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">Cập nhật tiến độ — {taskName}</h5>
                <button type="button" className="btn-close" onClick={handleClose} aria-label="Đóng" />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  
                  {/* KẾ HOẠCH THỰC HIỆN (HẠNG MỤC) */}
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label fw-bold m-0">Kế hoạch thực hiện (hạng mục)</label>
                      <span className="text-muted small fw-semibold">
                        Tổng tiến độ trung bình: {form.progress_percent}%
                      </span>
                    </div>
                    
                    <div className="d-flex gap-2 mb-3 align-items-start">
                      <textarea
                        className="form-control progress-modal-input"
                        placeholder="Thêm hạng mục mới..."
                        value={newMilestoneName}
                        rows={1}
                        style={{
                          resize: 'none',
                          overflow: 'hidden',
                          minHeight: '38px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                        }}
                        onChange={(e) => setNewMilestoneName(e.target.value)}
                        onInput={(e: any) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddMilestone();
                            (e.target as HTMLTextAreaElement).style.height = 'auto';
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary px-4"
                        onClick={handleAddMilestone}
                        style={{ height: '38px', flexShrink: 0 }}
                      >
                        Thêm
                      </button>
                    </div>

                    <div className="d-flex flex-column gap-2" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      {milestones.length === 0 ? (
                        <div className="text-muted text-center py-2 progress-milestone-empty small">
                          Chưa có hạng mục nào.
                        </div>
                      ) : (
                        milestones.map((item) => (
                          <div key={item.id} className="d-flex align-items-center gap-2 p-2 progress-milestone-row">
                            <textarea
                              className="form-control form-control-sm progress-modal-input"
                              value={item.name}
                              rows={1}
                              style={{ resize: 'none', overflow: 'hidden', minHeight: '31px', lineHeight: '1.4' }}
                              onInput={(e: any) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              onChange={(e) => handleUpdateMilestone(item.id, 'name', e.target.value)}
                              placeholder="Tên hạng mục"
                            />
                            <div className="input-group input-group-sm" style={{ width: '150px' }}>
                              <input
                                type="number"
                                className="form-control text-center progress-modal-input"
                                value={item.progress}
                                min={0}
                                max={100}
                                onChange={(e) => handleUpdateMilestone(item.id, 'progress', e.target.value)}
                              />
                              <span className="input-group-text" style={{
                                background: 'var(--input-bg, rgba(148,163,184,0.08))',
                                color: 'var(--text-color, #e5e7eb)',
                                borderColor: 'var(--border-color, rgba(148,163,184,0.25))',
                              }}>%</span>
                            </div>
                            <select
                              className="form-select form-select-sm progress-modal-input"
                              style={{ width: '140px' }}
                              value={item.status}
                              onChange={(e) => handleUpdateMilestone(item.id, 'status', e.target.value)}
                            >
                              <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                              <option value="Đang thực hiện">Đang thực hiện</option>
                              <option value="Hoàn thành">Hoàn thành</option>
                            </select>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger px-3"
                              onClick={() => handleDeleteMilestone(item.id)}
                            >
                              Xóa
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Thông tin quản lý & tài chính */}
                  {showFinanceSection && (
                    <>
                      <div className="col-12 mt-4">
                        <hr className="my-2" />
                        <h6 className="text-muted mb-3">Thông tin quản lý & tài chính</h6>
                      </div>
                      
                      <div className="col-md-4">
                        <label className="form-label">CAPEX (VND)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control progress-modal-input"
                          value={form.capex_amount ?? ''}
                          onChange={(e) => setForm({ ...form, capex_amount: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Tiết kiệm ước tính/năm (VND)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control progress-modal-input"
                          value={form.estimated_saving_per_year ?? ''}
                          onChange={(e) => setForm({ ...form, estimated_saving_per_year: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Thời gian hoàn vốn (năm)</label>
                        <input
                          type="number" 
                          step="0.1"
                          className="form-control progress-modal-input"
                          value={form.payback_years ?? ''}
                          onChange={(e) => setForm({ ...form, payback_years: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Lợi ích khác</label>
                        <textarea
                          className="form-control progress-modal-input"
                          style={{ minHeight: '85px', resize: 'vertical' }}
                          value={form.manager_comment}
                          onChange={(e) => setForm({ ...form, manager_comment: e.target.value })}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  },
);

ProgressUpdateModal.displayName = 'ProgressUpdateModal';

export default ProgressUpdateModal;