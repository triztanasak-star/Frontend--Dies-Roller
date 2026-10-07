import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
// ✅ SỬA: '../../../lib/db' → '../../../../lib/db' (thêm 1 cấp vì file giờ nằm trong thư mục Dies/)
import { listTaskPlans, createTaskPlan, updateTaskPlan, deleteTaskPlan, uploadAttachments, type DigitalWork, type MilestoneItem } from '../../../../lib/db';

export interface ProgressFormValues {
  status: number;
  progress_percent: number;
  progress_comment: string;

  dies_model: string;
  dies_code: string;
  supplier: string;
  dies_hole_mm: number | null;
  press_length_mm: string | null;
  ld_ratio: number | null;
  line_in_use: string;
  standard_ton: number | null;
  dies_life_ton: number | null;
  dies_price_vnd: number | null;
  symptom: string;

  remaining_tons: number | null;
  price_per_ton_vnd: number | null;
  result_cost_per_ton_vnd: number | null;

  expected_deadline: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface ProgressUpdateModalHandle {
  open: (work: DigitalWork & Record<string, any>) => void;
}

interface ProgressUpdateModalProps {
  onSubmit: (workId: number, values: Partial<ProgressFormValues>) => Promise<void>;
}

// ✅ Format số có dấu chấm phân cách hàng nghìn
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return '';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(value)));
};

// ✅ Parse chuỗi "2.000" → số 2000
const parseFormattedNumber = (str: string): number | null => {
  if (!str) return null;
  const cleaned = String(str).replace(/\./g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

// ✅ Format input khi đang nhập: "2000" → "2.000"
const formatInputValue = (str: string): string => {
  if (!str) return '';
  const cleaned = String(str).replace(/\./g, '').replace(/[^\d]/g, '');
  if (!cleaned) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(cleaned));
};

const ProgressUpdateModal = forwardRef<ProgressUpdateModalHandle, ProgressUpdateModalProps>(
  ({ onSubmit }, ref) => {
    const { t } = useTranslation();
    const modalRef = useRef<HTMLDivElement>(null);
    const [workId, setWorkId] = useState<number | null>(null);
    const [taskName, setTaskName] = useState('');

    const [form, setForm] = useState<ProgressFormValues>({
      status: 0,
      progress_percent: 0,
      progress_comment: '',

      dies_model: '',
      dies_code: '',
      supplier: '',
      dies_hole_mm: null,
      press_length_mm: null,
      ld_ratio: null,
      line_in_use: '',
      standard_ton: null,
      dies_life_ton: null,
      dies_price_vnd: null,
      symptom: '',

      remaining_tons: null,
      price_per_ton_vnd: null,
      result_cost_per_ton_vnd: null,

      expected_deadline: null,
      created_at: null,
      completed_at: null,
    });

    const [standardTonInput, setStandardTonInput] = useState('');
    const [diesLifeTonInput, setDiesLifeTonInput] = useState('');
    const [diesPriceInput, setDiesPriceInput] = useState('');
    const [resultCostInput, setResultCostInput] = useState('');

    const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
    const [newMilestoneName, setNewMilestoneName] = useState('');
    const [newMilestoneTons, setNewMilestoneTons] = useState('');
    const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
    const [beforeImages, setBeforeImages] = useState<File[]>([]);
    const [afterWorkImages, setAfterWorkImages] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ✅ Chỉ tự tính remaining và pricePerTon (KHÔNG tự tính resultCost)
    const computed = useMemo(() => {
      const std = Number(form.standard_ton) || 0;
      const life = Number(form.dies_life_ton) || 0;
      const price = Number(form.dies_price_vnd) || 0;

      const remaining = std && life ? Math.round(std - life) : null;
      const pricePerTon = life > 0 ? Math.round(price / life) : null;

      return { remaining, pricePerTon };
    }, [form.standard_ton, form.dies_life_ton, form.dies_price_vnd]);

    useMemo(() => {
      setForm((prev) => ({
        ...prev,
        remaining_tons: computed.remaining,
        price_per_ton_vnd: computed.pricePerTon,
      }));
    }, [computed.remaining, computed.pricePerTon]);

    useImperativeHandle(ref, () => ({
      open: async (work: DigitalWork & Record<string, any>) => {
        setWorkId(work.id);
        setTaskName(work.task_name || '');
        setBeforeImages([]);
        setAfterWorkImages([]);

        const stdTon = work.standard_ton != null ? Number(work.standard_ton) : null;
        const lifeTon = work.dies_life_ton != null ? Number(work.dies_life_ton) : null;
        const priceVnd = work.dies_price_vnd != null ? Number(work.dies_price_vnd) : null;
        const resultCost = work.result_cost_per_ton_vnd != null ? Number(work.result_cost_per_ton_vnd) : null;

        setForm({
          status: work.status ?? 0,
          progress_percent: work.progress_percent ?? 0,
          progress_comment: work.progress_comment ?? '',

          dies_model: work.dies_model ?? '',
          dies_code: work.dies_code ?? '',
          supplier: work.supplier ?? '',
          dies_hole_mm: work.dies_hole_mm != null ? Number(work.dies_hole_mm) : null,
          press_length_mm: work.press_length_mm ?? null,
          ld_ratio: work.ld_ratio != null ? Number(work.ld_ratio) : null,
          line_in_use: work.line_in_use ?? '',
          standard_ton: stdTon,
          dies_life_ton: lifeTon,
          dies_price_vnd: priceVnd,
          symptom: work.symptom ?? '',

          remaining_tons: work.remaining_tons != null ? Number(work.remaining_tons) : null,
          price_per_ton_vnd: work.price_per_ton_vnd != null ? Number(work.price_per_ton_vnd) : null,
          result_cost_per_ton_vnd: resultCost,
          expected_deadline: work.expected_deadline ? String(work.expected_deadline).split('T')[0] : null,
          created_at: work.created_at ? String(work.created_at).split('T')[0] : null,
          completed_at: work.completed_at ?? null,
        });

        setStandardTonInput(stdTon != null ? formatNumber(stdTon) : '');
        setDiesLifeTonInput(lifeTon != null ? formatNumber(lifeTon) : '');
        setDiesPriceInput(priceVnd != null ? formatNumber(priceVnd) : '');
        // ✅ Nếu DB null → ô trống
        setResultCostInput(resultCost != null ? formatNumber(resultCost) : '');

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
            dueDate: p.due_date ? String(p.due_date).split('T')[0] : '',
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
      const totalTons = updatedMilestones.reduce((sum, item) => sum + Number(item.progress || 0), 0);
      const combinedNotes = updatedMilestones
        .map((item) => `- ${item.name}: ${item.progress} ton`)
        .join('\n');

      const allDone = updatedMilestones.every((item) => Number(item.progress) >= 100);

      setForm(prev => ({
        ...prev,
        progress_percent: totalTons,
        status: allDone ? 2 : (totalTons > 0 ? 1 : 0),
        progress_comment: combinedNotes,
      }));
    };

    const handleAddMilestone = async () => {
      if (!newMilestoneName.trim() || !workId) return;
      try {
        const createdPlan = await createTaskPlan(workId, {
          step_name: newMilestoneName.trim(),
          step_order: milestones.length + 1,
          progress_percent: newMilestoneTons ? (parseFormattedNumber(newMilestoneTons) ?? 0) : 0,
          due_date: newMilestoneDueDate || undefined,
        });

        const newItem: MilestoneItem = {
          id: createdPlan.id,
          name: createdPlan.step_name || newMilestoneName.trim(),
          progress: createdPlan.progress_percent ?? 0,
          status: 'Chưa bắt đầu',
          dueDate: createdPlan.due_date ? String(createdPlan.due_date).split('T')[0] : (newMilestoneDueDate || ''),
        };

        const updated = [...milestones, newItem];
        setMilestones(updated);
        setNewMilestoneName('');
        setNewMilestoneTons('');
        setNewMilestoneDueDate('');
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
            if (numVal >= 100) itemUpdated.status = 'Hoàn thành';
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
              due_date: target.dueDate || null,
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

          dies_model: form.dies_model,
          dies_code: form.dies_code,
          supplier: form.supplier,
          dies_hole_mm: form.dies_hole_mm,
          press_length_mm: form.press_length_mm,
          ld_ratio: form.ld_ratio,
          line_in_use: form.line_in_use,
          standard_ton: form.standard_ton,
          dies_life_ton: form.dies_life_ton,
          dies_price_vnd: form.dies_price_vnd,
          symptom: form.symptom,

          remaining_tons: computed.remaining,
          price_per_ton_vnd: computed.pricePerTon,
          result_cost_per_ton_vnd: form.result_cost_per_ton_vnd,

          expected_deadline: form.expected_deadline,
          completed_at: form.completed_at,
        };

        console.log('📤 Payload gửi đi:', payload);

        await onSubmit(workId, payload);

        if (beforeImages.length > 0) {
          await uploadAttachments(workId, beforeImages, 'before_work');
        }
        if (afterWorkImages.length > 0) {
          await uploadAttachments(workId, afterWorkImages, 'after_work');
        }

        handleClose();
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="modal fade" ref={modalRef} tabIndex={-1} aria-hidden="true">
        <style>{`
          .progress-modal-input {
            background-color: #ffffff !important;
            color: #1f2937 !important;
            border: 1px solid #d1d5db !important;
          }
          .progress-modal-input:focus {
            background-color: #ffffff !important;
            color: #1f2937 !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.15) !important;
          }
          .progress-modal-input::placeholder { color: #9ca3af !important; opacity: 1; }
          .input-group-text {
            background-color: #f3f4f6 !important;
            color: #1f2937 !important;
            border-color: #d1d5db !important;
          }
          .progress-milestone-row {
            background-color: #f8fafc !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px;
          }
          .progress-milestone-empty {
            background-color: #f9fafb !important;
            border: 1px solid #e5e7eb !important;
          }
          .progress-modal-input[type="date"] { color-scheme: light; }

          [data-theme="dark"] .progress-modal-input {
            background-color: rgba(30, 41, 59, 0.6) !important;
            color: #e5e7eb !important;
            border-color: rgba(148, 163, 184, 0.25) !important;
          }
          [data-theme="dark"] .progress-modal-input:focus {
            background-color: rgba(30, 41, 59, 0.6) !important;
            color: #e5e7eb !important;
            border-color: #3b82f6 !important;
          }
          [data-theme="dark"] .progress-modal-input::placeholder { color: #94a3b8 !important; opacity: 0.7; }
          [data-theme="dark"] .input-group-text {
            background-color: rgba(30, 41, 59, 0.6) !important;
            color: #e5e7eb !important;
            border-color: rgba(148, 163, 184, 0.25) !important;
          }
          [data-theme="dark"] .progress-milestone-row {
            background-color: rgba(30, 41, 59, 0.4) !important;
            border-color: rgba(148, 163, 184, 0.15) !important;
          }
          [data-theme="dark"] .progress-milestone-empty {
            background-color: rgba(30, 41, 59, 0.3) !important;
            border-color: rgba(148, 163, 184, 0.15) !important;
          }
          [data-theme="dark"] .progress-modal-input[type="date"] { color-scheme: dark; }
          [data-theme="dark"] .progress-modal-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        `}</style>

        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">Cập nhật Die — {taskName}</h5>
                <button type="button" className="btn-close" onClick={handleClose} aria-label="Đóng" />
              </div>
              <div className="modal-body">
                <div className="row g-3">

                  <div className="col-12">
                    <h6 className="text-muted mb-2">Thông tin Dies</h6>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Dies Model</label>
                    <input type="text" className="form-control progress-modal-input"
                      value={form.dies_model}
                      onChange={(e) => setForm({ ...form, dies_model: e.target.value })}
                      placeholder="Chọn hoặc nhập Model" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Dies Code (Mã khuôn)</label>
                    <input type="text" className="form-control progress-modal-input"
                      value={form.dies_code}
                      onChange={(e) => setForm({ ...form, dies_code: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Supplier</label>
                    <input type="text" className="form-control progress-modal-input"
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      placeholder="Chọn hoặc nhập Nhà cung cấp" />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Dies Hole (mm)</label>
                    <input type="number" step="1" className="form-control progress-modal-input"
                      value={form.dies_hole_mm ?? ''}
                      onChange={(e) => setForm({ ...form, dies_hole_mm: e.target.value ? Number(e.target.value) : null })}
                      placeholder="VD: 2, 3, 4" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Press Length (mm)</label>
                    <input type="text" className="form-control progress-modal-input"
                      value={form.press_length_mm ?? ''}
                      onChange={(e) => setForm({ ...form, press_length_mm: e.target.value || null })}
                      placeholder="VD: 60-0, 60-5" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">L/D Ratio</label>
                    <input type="number" step="1" className="form-control progress-modal-input"
                      value={form.ld_ratio ?? ''}
                      onChange={(e) => setForm({ ...form, ld_ratio: e.target.value ? Number(e.target.value) : null })}
                      placeholder="VD: 4" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Line in use</label>
                    <input type="text" className="form-control progress-modal-input"
                      value={form.line_in_use}
                      onChange={(e) => setForm({ ...form, line_in_use: e.target.value })}
                      placeholder="VD: PL#1, PL#2" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <select className="form-select progress-modal-input"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}>
                      <option value={0}>Trong kho</option>
                      <option value={1}>Đang sử dụng</option>
                      <option value={2}>Chờ mài</option>
                      <option value={3}>Chờ sử dụng</option>
                      <option value={4}>Hết tuổi thọ</option>
                      <option value={5}>Hư bể</option>
                      <option value={6}>Đang đặt</option>
                    </select>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Standard (ton)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control progress-modal-input"
                      value={standardTonInput}
                      onChange={(e) => {
                        const formatted = formatInputValue(e.target.value);
                        setStandardTonInput(formatted);
                        setForm({ ...form, standard_ton: parseFormattedNumber(formatted) });
                      }}
                      placeholder="VD: 30.000"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Dies Life (ton)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control progress-modal-input"
                      value={diesLifeTonInput}
                      onChange={(e) => {
                        const formatted = formatInputValue(e.target.value);
                        setDiesLifeTonInput(formatted);
                        setForm({ ...form, dies_life_ton: parseFormattedNumber(formatted) });
                      }}
                      placeholder="VD: 8.677"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Dies Price (VND)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control progress-modal-input"
                      value={diesPriceInput}
                      onChange={(e) => {
                        const formatted = formatInputValue(e.target.value);
                        setDiesPriceInput(formatted);
                        setForm({ ...form, dies_price_vnd: parseFormattedNumber(formatted) });
                      }}
                      placeholder="VD: 156.000.000"
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">Remaining Tons</label>
                    <input type="text" readOnly className="form-control progress-modal-input"
                      value={formatNumber(computed.remaining)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Price / Ton (VND)</label>
                    <input type="text" readOnly className="form-control progress-modal-input"
                      value={formatNumber(computed.pricePerTon)} />
                  </div>

                  {/* ✅ Price/ton (VND) Standard — editable, để trống nếu DB null */}
                  <div className="col-md-3">
                    <label className="form-label">Price/ton (VND) Standard</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control progress-modal-input"
                      value={resultCostInput}
                      onChange={(e) => {
                        const formatted = formatInputValue(e.target.value);
                        setResultCostInput(formatted);
                        setForm({ ...form, result_cost_per_ton_vnd: parseFormattedNumber(formatted) });
                      }}
                      placeholder="VD: 7.830"
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">L/D Ratio (đã nhập)</label>
                    <input type="text" readOnly className="form-control progress-modal-input"
                      value={form.ld_ratio ?? ''} />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Symptom / Ghi chú</label>
                    <textarea className="form-control progress-modal-input"
                      style={{ minHeight: '80px', resize: 'vertical' }}
                      value={form.symptom}
                      onChange={(e) => setForm({ ...form, symptom: e.target.value })} />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Ngày nhập kho</label>
                    <input type="date" className="form-control progress-modal-input"
                      value={form.created_at ?? ''}
                      readOnly
                      disabled
                      style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control progress-modal-input"
                      value={form.expected_deadline ?? ''}
                      onChange={(e) => setForm({ ...form, expected_deadline: e.target.value || null })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">End Date</label>
                    <input type="datetime-local" className="form-control progress-modal-input"
                      value={form.completed_at ? form.completed_at.slice(0, 16) : ''}
                      onChange={(e) => setForm({ ...form, completed_at: e.target.value || null })} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Image Before</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple
                      className="form-control progress-modal-input"
                      onChange={(e) => setBeforeImages(e.target.files ? Array.from(e.target.files) : [])} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Image After</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple
                      className="form-control progress-modal-input"
                      onChange={(e) => setAfterWorkImages(e.target.files ? Array.from(e.target.files) : [])} />
                  </div>

                  {/* ============ KẾ HOẠCH THỰC HIỆN ============ */}
                  <div className="col-12 mt-4">
                    <hr className="my-2" />
                    <div className="mb-2">
                      <label className="form-label fw-bold m-0">Kế hoạch thực hiện (hạng mục)</label>
                    </div>

                    <div className="d-flex gap-2 mb-3 align-items-start">
                      <textarea
                        className="form-control progress-modal-input"
                        placeholder="Thêm hạng mục mới..."
                        value={newMilestoneName}
                        rows={1}
                        style={{ resize: 'none', overflow: 'hidden', minHeight: '38px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}
                        onChange={(e) => setNewMilestoneName(e.target.value)}
                        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddMilestone();
                            (e.target as HTMLTextAreaElement).style.height = 'auto';
                          }
                        }}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control progress-modal-input"
                        style={{ height: '38px', width: '100px', flexShrink: 0 }}
                        placeholder="Số tấn"
                        value={newMilestoneTons}
                        onChange={(e) => setNewMilestoneTons(formatInputValue(e.target.value))} />
                      <input type="date" className="form-control progress-modal-input"
                        style={{ height: '38px', width: '160px', flexShrink: 0 }}
                        value={newMilestoneDueDate}
                        onChange={(e) => setNewMilestoneDueDate(e.target.value)} />
                      <button type="button" className="btn btn-primary px-4"
                        onClick={handleAddMilestone} style={{ height: '38px', flexShrink: 0 }}>
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
                            <textarea className="form-control form-control-sm progress-modal-input"
                              value={item.name} rows={1}
                              style={{ resize: 'none', overflow: 'hidden', minHeight: '31px', lineHeight: '1.4', flex: 1 }}
                              onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                              onChange={(e) => handleUpdateMilestone(item.id, 'name', e.target.value)} />
                            <div className="input-group input-group-sm" style={{ width: '120px', flexShrink: 0 }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-control text-center progress-modal-input"
                                value={formatNumber(Number(item.progress) || 0)}
                                onChange={(e) => handleUpdateMilestone(item.id, 'progress', parseFormattedNumber(e.target.value) ?? 0)} />
                              <span className="input-group-text">ton</span>
                            </div>
                            <input type="date" className="form-control form-control-sm progress-modal-input"
                              style={{ width: '150px', flexShrink: 0 }}
                              value={item.dueDate || ''}
                              onChange={(e) => handleUpdateMilestone(item.id, 'dueDate', e.target.value)} />
                            <button type="button" className="btn btn-sm btn-outline-danger px-3"
                              onClick={() => handleDeleteMilestone(item.id)} style={{ flexShrink: 0 }}>
                              Xóa
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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