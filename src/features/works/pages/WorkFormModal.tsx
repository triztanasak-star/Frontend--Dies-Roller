import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DigitalWork, Project, User } from '../../../lib/db';

// ✅ Ô nhập nhiều tên (PIC/Support), gõ dấu phẩy để tiếp tục gợi ý tên kế tiếp
function MultiNameInput({
  value,
  onChange,
  users,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segments = value.split(',');
  const lastRaw = segments[segments.length - 1];
  const last = lastRaw.trim().toLowerCase();
  const chosen = segments
    .slice(0, -1)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const suggestions = users
    .filter((u) => {
      const name = (u.name ?? u.email ?? '').trim();
      if (!name) return false;
      const lname = name.toLowerCase();
      if (chosen.includes(lname)) return false;
      return !last || lname.includes(last);
    })
    .slice(0, 8);

  const handleSelect = (name: string) => {
    const prefix = segments.slice(0, -1).join(',').trim();
    const newValue = (prefix ? `${prefix}, ` : '') + name + ', ';
    onChange(newValue);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && suggestions.length > 0 && (
        <div
          className="shadow"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: '2px',
            maxHeight: '200px',
            overflowY: 'auto',
            background: 'var(--card-bg, #1a1d2e)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '6px',
          }}
        >
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              className="dropdown-item"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px' }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                handleSelect(u.name ?? u.email);
              }}
            >
              {u.name ?? u.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface WorkFormValues {
  task_name: string;
  factory_name: string;
  description: string;
  priority: string;
  lead_project: string;
  assistant: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string;
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
  onSubmit: (values: WorkFormValues, editingId: number | null, isAssignMode: boolean) => Promise<void>;
}

const initialValues: WorkFormValues = {
  task_name: '',
  factory_name: '',
  description: '',
  priority: 'medium',
  lead_project: '',
  assistant: '',
  representative_name: '',
  representative_email: '',
  representative_phone: '',
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
  const { t } = useTranslation();
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
        representative_name: work.representative_name ?? '',
        representative_email: work.representative_email ?? '',
        representative_phone: work.representative_phone ?? '',
        assigned_to: '',
        support_id: '',
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
        lead_project: work.lead_project ?? work.assigned_to_name ?? '',
        assistant: work.assistant ?? work.support_name ?? '',
        representative_name: work.representative_name ?? '',
        representative_email: work.representative_email ?? '',
        representative_phone: work.representative_phone ?? '',
        assigned_to: '',
        support_id: '',
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
      await onSubmit(values, editingId, isAssignMode);
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
                {isAssignMode ? t('workForm.titleAssign') : editingId ? t('workForm.titleEdit') : t('workForm.titleCreate')}
              </h5>
              <button type="button" className="btn-close" onClick={() => setIsOpen(false)} />
            </div>

            <div className="modal-body">
              {isAssignMode ? (
                /* FORM GIAO CÔNG VIỆC */
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.taskName')}</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={values.task_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, task_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.factory')}</label>
                    <input
                      type="text"
                      className="form-control"
                      list="factory-list-assign"
                      value={values.factory_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, factory_name: e.target.value }))}
                      placeholder={t('workForm.factoryPlaceholder')}
                    />
                    <datalist id="factory-list-assign">
                      {FACTORY_OPTIONS.map((factory) => (
                        <option key={factory} value={factory} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.priority')}</label>
                    <select
                      className="form-select"
                      value={values.priority}
                      onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="high">{t('common.priority.high')}</option>
                      <option value="medium">{t('common.priority.medium')}</option>
                      <option value="low">{t('common.priority.low')}</option>
                    </select>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label">{t('workForm.description')}</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={values.description}
                      onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.representativeName')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={values.representative_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.email')}</label>
                    <input
                      type="email"
                      className="form-control"
                      value={values.representative_email}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_email: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.phone')}</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={values.representative_phone}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_phone: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.expectedDeadline')}</label>
                    <input
                      type="date"
                      className="form-control"
                      value={values.expected_deadline}
                      onChange={(e) => setValues((prev) => ({ ...prev, expected_deadline: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.attachment')}</label>
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

                  {/* ✅ PIC — nhập tự do (nhiều tên, phân tách bằng dấu phẩy), lưu vào lead_project */}
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.pic')}</label>
                    <MultiNameInput
                      users={users}
                      placeholder={t('workForm.picPlaceholder')}
                      value={values.lead_project}
                      onChange={(val) => setValues((prev) => ({ ...prev, lead_project: val, assigned_to: '' }))}
                    />
                  </div>

                  {/* ✅ Support — nhập tự do (nhiều tên, phân tách bằng dấu phẩy), lưu vào assistant */}
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.support')}</label>
                    <MultiNameInput
                      users={users}
                      placeholder={t('workForm.supportPlaceholder')}
                      value={values.assistant}
                      onChange={(val) => setValues((prev) => ({ ...prev, assistant: val, support_id: '' }))}
                    />
                  </div>
                </div>
              ) : (
                /* FORM THÊM / SỬA DỰ ÁN */
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.taskName')}</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={values.task_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, task_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.factory')}</label>
                    <input
                      type="text"
                      className="form-control"
                      list="factory-list-create"
                      value={values.factory_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, factory_name: e.target.value }))}
                      placeholder={t('workForm.factoryPlaceholder')}
                    />
                    <datalist id="factory-list-create">
                      {FACTORY_OPTIONS.map((factory) => (
                        <option key={factory} value={factory} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">{t('workForm.priority')}</label>
                    <select
                      className="form-select"
                      value={values.priority}
                      onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="high">{t('common.priority.high')}</option>
                      <option value="medium">{t('common.priority.medium')}</option>
                      <option value="low">{t('common.priority.low')}</option>
                    </select>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label">{t('workForm.description')}</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={values.description}
                      onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.representativeName')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={values.representative_name}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.email')}</label>
                    <input
                      type="email"
                      className="form-control"
                      value={values.representative_email}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_email: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('workForm.phone')}</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={values.representative_phone}
                      onChange={(e) => setValues((prev) => ({ ...prev, representative_phone: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.expectedDeadline')}</label>
                    <input
                      type="date"
                      className="form-control"
                      value={values.expected_deadline}
                      onChange={(e) => setValues((prev) => ({ ...prev, expected_deadline: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">{t('workForm.attachment')}</label>
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
                {t('workForm.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {isAssignMode
                  ? (loading ? t('workForm.submitApproving') : t('workForm.submitApprove'))
                  : editingId
                  ? (loading ? t('workForm.submitSaving') : t('workForm.submitSave'))
                  : (loading ? t('workForm.submitRequesting') : t('workForm.submitRequest'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

export default WorkFormModal;