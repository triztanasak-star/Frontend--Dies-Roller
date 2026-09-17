import { forwardRef, useImperativeHandle, useState } from 'react';
import type { DigitalWork, Project, User } from '../../../lib/db';

export interface WorkFormValues {
  task_name: string;
  factory_name: string;
  description: string;
  priority: string;
  lead_project: string;
  assistant: string;
  assigned_to: string;
  support_id: string;
  project_id: string;
  expected_deadline: string;
  capex_amount: string;
  estimated_saving_per_year: string;
  payback_years: string;
  files: File[];
}

export interface WorkFormModalHandle {
  openCreate: () => void;
  openEdit: (work: DigitalWork) => void;
  openAssign: (work: DigitalWork) => void;
  close: () => void;
}

interface Props {
  projects: Project[];
  users: User[];
  onSubmit: (values: WorkFormValues, editingId: number | null) => Promise<void>;
}

const initialValues: WorkFormValues = {
  task_name: '',
  factory_name: '',
  description: '',
  priority: 'medium',
  lead_project: '',
  assistant: '',
  assigned_to: '',
  support_id: '',
  project_id: '',
  expected_deadline: '',
  capex_amount: '',
  estimated_saving_per_year: '',
  payback_years: '',
  files: [],
};

const FACTORY_OPTIONS = [
  'Nhà máy Tiền Giang',
  'Nhà máy Đồng Nai',
  'Nhà máy Bào Xéo',
  'Nhà máy Bình Phước',
  'Nhà máy Bình Dương',
  'Nhà máy Bình Định',
  'Nhà máy Hải Dương',
  'Nhà máy Xuân Mai',
];

const WorkFormModal = forwardRef<WorkFormModalHandle, Props>(({ users, onSubmit }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [values, setValues] = useState<WorkFormValues>(initialValues);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    openCreate: () => {
      setEditingId(null);
      setIsAssignMode(false);
      setValues(initialValues);
      setIsOpen(true);
    },
    openEdit: (work: DigitalWork) => {
      setEditingId(work.id);
      setIsAssignMode(false);
      setValues({
        task_name: work.task_name ?? '',
        factory_name: work.factory_name ?? '',
        description: work.description ?? '',
        priority: work.priority ?? 'medium',
        lead_project: work.lead_project ?? '',
        assistant: work.assistant ?? '',
        assigned_to: work.assigned_to_name ?? (work.assigned_to ? String(work.assigned_to) : ''),
        support_id: work.support_name ?? (work.support_id ? String(work.support_id) : ''),
        project_id: work.project_id ? String(work.project_id) : '',
        expected_deadline: work.expected_deadline ? work.expected_deadline.split('T')[0] : '',
        capex_amount: work.capex_amount ? String(work.capex_amount) : '',
        estimated_saving_per_year: work.estimated_saving_per_year ? String(work.estimated_saving_per_year) : '',
        payback_years: work.payback_years ? String(work.payback_years) : '',
        files: [],
      });
      setIsOpen(true);
    },
    openAssign: (work: DigitalWork) => {
      setEditingId(work.id);
      setIsAssignMode(true);
      setValues({
        task_name: work.task_name ?? '',
        factory_name: work.factory_name ?? '',
        description: work.description ?? '',
        priority: work.priority ?? 'medium',
        lead_project: work.lead_project ?? '',
        assistant: work.assistant ?? '',
        assigned_to: work.assigned_to_name ?? (work.assigned_to ? String(work.assigned_to) : ''),
        support_id: work.support_name ?? (work.support_id ? String(work.support_id) : ''),
        project_id: work.project_id ? String(work.project_id) : '',
        expected_deadline: work.expected_deadline ? work.expected_deadline.split('T')[0] : '',
        capex_amount: work.capex_amount ? String(work.capex_amount) : '',
        estimated_saving_per_year: work.estimated_saving_per_year ? String(work.estimated_saving_per_year) : '',
        payback_years: work.payback_years ? String(work.payback_years) : '',
        files: [],
      });
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSubmit(values, editingId);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                {isAssignMode ? 'Giao công việc' : editingId ? 'Sửa dự án' : 'Thêm dự án'}
              </h5>
              <button type="button" className="btn-close" onClick={() => setIsOpen(false)} />
            </div>

            <div className="modal-body">
              {isAssignMode ? (
                /* FORM GIAO CÔNG VIỆC */
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Tên công việc *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={values.task_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, task_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Nhà máy</label>
                    <input
                      type="text"
                      className="form-control"
                      list="factory-list-assign"
                      value={values.factory_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, factory_name: e.target.value }))}
                      placeholder="Nhập hoặc chọn"
                    />
                    <datalist id="factory-list-assign">
                      {FACTORY_OPTIONS.map((factory) => (
                        <option key={factory} value={factory} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Mức ưu tiên</label>
                    <select
                      className="form-select"
                      value={values.priority}
                      onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="high">High (H)</option>
                      <option value="medium">Medium (M)</option>
                      <option value="low">Low (L)</option>
                    </select>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label">Mô tả chi tiết</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={values.description}
                      onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Deadline mong muốn</label>
                    <input
                      type="date"
                      className="form-control"
                      value={values.expected_deadline}
                      onChange={(e) => setValues((prev) => ({ ...prev, expected_deadline: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">File PDF / hình ảnh đính kèm</label>
                    <input
                      type="file"
                      className="form-control"
                      multiple
                      onChange={(e) => {
                        const fileList = e.target.files;
                        const newFiles = fileList ? Array.from(fileList) : [];
                        setValues((prev) => ({ ...prev, files: newFiles }));
                      }}
                    />
                  </div>

                  {/* ✅ PIC — vừa chọn từ dropdown vừa nhập tay */}
                  <div className="col-md-6">
                    <label className="form-label">PIC</label>
                    <input
                      type="text"
                      className="form-control"
                      list="pic-list"
                      placeholder="Chọn hoặc nhập tên PIC..."
                      value={values.assigned_to}
                      onChange={(e) => setValues((prev) => ({ ...prev, assigned_to: e.target.value }))}
                    />
                    <datalist id="pic-list">
                      {users.map((u) => (
                        <option key={u.id} value={u.name ?? u.email} />
                      ))}
                    </datalist>
                  </div>

                  {/* ✅ Support — vừa chọn từ dropdown vừa nhập tay */}
                  <div className="col-md-6">
                    <label className="form-label">Support</label>
                    <input
                      type="text"
                      className="form-control"
                      list="support-list"
                      placeholder="Chọn hoặc nhập tên Support..."
                      value={values.support_id}
                      onChange={(e) => setValues((prev) => ({ ...prev, support_id: e.target.value }))}
                    />
                    <datalist id="support-list">
                      {users.map((u) => (
                        <option key={u.id} value={u.name ?? u.email} />
                      ))}
                    </datalist>
                  </div>
                </div>
              ) : (
                /* FORM THÊM / SỬA DỰ ÁN */
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Tên công việc *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={values.task_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, task_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Nhà máy</label>
                    <input
                      type="text"
                      className="form-control"
                      list="factory-list-create"
                      value={values.factory_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, factory_name: e.target.value }))}
                      placeholder="Nhập hoặc chọn"
                    />
                    <datalist id="factory-list-create">
                      {FACTORY_OPTIONS.map((factory) => (
                        <option key={factory} value={factory} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Mức ưu tiên</label>
                    <select
                      className="form-select"
                      value={values.priority}
                      onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="high">High (H)</option>
                      <option value="medium">Medium (M)</option>
                      <option value="low">Low (L)</option>
                    </select>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label">Mô tả chi tiết</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={values.description}
                      onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Deadline mong muốn</label>
                    <input
                      type="date"
                      className="form-control"
                      value={values.expected_deadline}
                      onChange={(e) => setValues((prev) => ({ ...prev, expected_deadline: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">File PDF / hình ảnh đính kèm</label>
                    <input
                      type="file"
                      className="form-control"
                      multiple
                      onChange={(e) => {
                        const fileList = e.target.files;
                        const newFiles = fileList ? Array.from(fileList) : [];
                        setValues((prev) => ({ ...prev, files: newFiles }));
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

export default WorkFormModal;