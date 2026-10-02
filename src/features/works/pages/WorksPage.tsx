import { useMemo, useRef, useState, Fragment, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FiDownload, FiPlus, FiEdit2, FiTrash2, FiUserPlus, FiEye } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import * as db from '../../../lib/db';
import type { DigitalWork, WorkAttachment } from '../../../lib/db';
import { exportWorksToExcel } from '../../../lib/excel';
import { useCreateWork, useDeleteWork, useUpdateWork, useUpdateWorkProgress, useWorks } from '../hooks/useWorks';
import TaskPlansPanel from './TaskPlansPanel';
import WorkFormModal, { type WorkFormModalHandle, type WorkFormValues } from './WorkFormModal';
import ProgressUpdateModal, { type ProgressUpdateModalHandle } from './ProgressUpdateModal';
import WorkDetailModal from './WorkDetailModal';
import { useQueryClient } from '@tanstack/react-query';

function progressBucket(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 80) return 'good';
  if (percent >= 40) return 'warn';
  return 'bad';
}

// 👈 Helper format ngày dd/MM/yyyy
function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// 👈 Helper kiểm tra quá hạn
function isOverdue(dateStr?: string | null, isDone?: boolean): boolean {
  if (!dateStr || isDone) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

// 👈 Map status từ API (pending/in_progress/done) -> key i18n
function mapStatusKey(apiStatus?: string): 'done' | 'in_progress' | 'pending' {
  if (apiStatus === 'done' || apiStatus === 'Hoàn thành') return 'done';
  if (apiStatus === 'in_progress' || apiStatus === 'Đang thực hiện') return 'in_progress';
  return 'pending';
}

export default function WorksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id');
  const isManagerOrAdmin = can('manager-or-admin');

  const { data, isLoading, isError } = useWorks({ limit: 200, project_id: projectId ? Number(projectId) : undefined });
  const projectsQuery = useQuery({ queryKey: ['projects', 'select'], queryFn: () => db.listProjects(1) });
  const usersQuery = useQuery({ queryKey: ['users', 'select'], queryFn: () => db.listUsers(1), enabled: isManagerOrAdmin });

  const createWork = useCreateWork();
  const updateWork = useUpdateWork();
  const updateProgress = useUpdateWorkProgress();
  const deleteWork = useDeleteWork();

  const [expandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [selectedDeadlines, setSelectedDeadlines] = useState<string[]>([]);
  const [deadlineMenuOpen, setDeadlineMenuOpen] = useState(false);
  const deadlineMenuRef = useRef<HTMLDivElement>(null);
  const [selectedWork, setSelectedWork] = useState<DigitalWork | null>(null);

  // 👈 State lưu plans theo workId
  const [plansByWork, setPlansByWork] = useState<Record<number, any[]>>({});
  const [loadingPlans, setLoadingPlans] = useState<Record<number, boolean>>({});

  // 👈 State lưu attachments (ảnh sau làm) theo workId
  const [attachmentsByWork, setAttachmentsByWork] = useState<Record<number, WorkAttachment[]>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const formModalRef = useRef<WorkFormModalHandle>(null);
  const progressModalRef = useRef<ProgressUpdateModalHandle>(null);

  const works = useMemo(() => data?.documents ?? [], [data]);

  // 👈 Tự động fetch plans cho tất cả works khi load danh sách
  useEffect(() => {
    if (works.length === 0) return;

    let cancelled = false;
    const loading: Record<number, boolean> = {};
    works.forEach(w => { loading[w.id] = true; });
    setLoadingPlans({ ...loading });

    const fetchAll = async () => {
      const results: Record<number, any[]> = {};

      await Promise.all(
        works.map(async (w) => {
          try {
            const res: any = await db.listTaskPlans(w.id);
            const rawList = Array.isArray(res) ? res : (res?.documents || res?.data || []);
            results[w.id] = rawList;
          } catch (e) {
            console.error(`Lỗi tải plans cho work ${w.id}:`, e);
            results[w.id] = [];
          }
        })
      );

      if (!cancelled) {
        setPlansByWork(results);
        setLoadingPlans({});
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [works]);

  // 👈 Tự động fetch ảnh đính kèm cho tất cả works để hiển thị "Hình ảnh sau làm"
  useEffect(() => {
    if (works.length === 0) return;

    let cancelled = false;

    const fetchAttachments = async () => {
      const results: Record<number, WorkAttachment[]> = {};

      await Promise.all(
        works.map(async (w) => {
          try {
            const res = await db.listAttachments(w.id);
            results[w.id] = res.documents || [];
          } catch (e) {
            console.error(`Lỗi tải ảnh cho work ${w.id}:`, e);
            results[w.id] = [];
          }
        })
      );

      if (!cancelled) {
        setAttachmentsByWork(results);
      }
    };

    fetchAttachments();
    return () => { cancelled = true; };
  }, [works]);

  // 👈 Đóng dropdown "Hoàn thành dự kiến" khi click ra ngoài
  useEffect(() => {
    if (!deadlineMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (deadlineMenuRef.current && !deadlineMenuRef.current.contains(e.target as Node)) {
        setDeadlineMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deadlineMenuOpen]);

  // 👈 Danh sách tên user đã đăng ký để gợi ý PIC/Support (vẫn cho gõ tự do tên ngoài danh sách)
  const picOptions = useMemo(() => {
    const names = new Set<string>();
    (usersQuery.data?.documents ?? []).forEach((u) => {
      const name = (u.name ?? u.email ?? '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [usersQuery.data]);

  // 👈 Danh sách ngày "Hoàn thành dự kiến" (expected_deadline) duy nhất để lọc
  const deadlineOptions = useMemo(() => {
    const map = new Map<string, string>();
    works.forEach((w) => {
      if (w.expected_deadline) {
        map.set(w.expected_deadline, formatDueDate(w.expected_deadline));
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([value, label]) => ({ value, label }));
  }, [works]);

  const toggleDeadline = (value: string) => {
    setSelectedDeadlines((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const picTerm = picFilter.trim().toLowerCase();
    return works.filter((w) => {
      if (workflowFilter && w.workflow_status !== workflowFilter) return false;
      if (priorityFilter && w.priority !== priorityFilter) return false;
      if (statusFilter && progressBucket(w.progress_percent) !== statusFilter) return false;
      if (picTerm) {
        const pic = (w.lead_project || w.assigned_to_name || '').trim().toLowerCase();
        const support = (w.assistant || w.support_name || '').trim().toLowerCase();
        if (!pic.includes(picTerm) && !support.includes(picTerm)) return false;
      }
      if (selectedDeadlines.length > 0) {
        if (!w.expected_deadline || !selectedDeadlines.includes(w.expected_deadline)) return false;
      }
      if (term) {
        const haystack = `${w.task_name} ${w.factory_name ?? ''} ${w.lead_project ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [works, search, priorityFilter, statusFilter, picFilter, selectedDeadlines, workflowFilter]);

  const legendCounts = useMemo(() => {
    const base = { good: 0, warn: 0, bad: 0 };
    for (const w of filtered) base[progressBucket(w.progress_percent)] += 1;
    return base;
  }, [filtered]);

  const handleFormSubmit = async (values: WorkFormValues, editingId: number | null, isAssignMode: boolean) => {
    const payload: Partial<DigitalWork> = {
      task_name: values.task_name,
      factory_name: values.factory_name || null,
      description: values.description || null,
      priority: values.priority as 'high' | 'medium' | 'low',
      lead_project: values.lead_project || null,
      assistant: values.assistant || null,
      representative_name: values.representative_name || null,
      representative_email: values.representative_email || null,
      representative_phone: values.representative_phone || null,
      assigned_to: null,
      support_id: null,
      project_id: values.project_id ? Number(values.project_id) : null,
      expected_deadline: values.expected_deadline || null,
      capex_amount: values.capex_amount ? Number(values.capex_amount) : null,
      estimated_saving_per_year: values.estimated_saving_per_year ? Number(values.estimated_saving_per_year) : null,
      payback_years: values.payback_years ? Number(values.payback_years) : null,
    };

    // 👈 "Giao công việc" → Duyệt: chuyển trạng thái quy trình sang "Đã duyệt"
    if (isAssignMode) {
      payload.workflow_status = 'approved';
    }

    if (editingId) {
      await updateWork.mutateAsync({ id: editingId, payload });
      if (values.files && values.files.length > 0) {
        await db.uploadAttachments(editingId, values.files);
      }
    } else {
      const created = await createWork.mutateAsync(payload as Partial<DigitalWork> & { task_name: string });
      if (values.files && values.files.length > 0) {
        await db.uploadAttachments(created.id, values.files);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['works'] });
    await queryClient.invalidateQueries({ queryKey: ['work_attachments'] });
  };

  const handleProgressSubmit = async (workId: number, values: Parameters<typeof db.updateWorkProgress>[1]) => {
    await updateProgress.mutateAsync({ id: workId, payload: values });

    // 👈 Sau khi lưu modal, reload plans của work này để cập nhật due date
    try {
      const res: any = await db.listTaskPlans(workId);
      const rawList = Array.isArray(res) ? res : (res?.documents || res?.data || []);
      setPlansByWork(prev => ({ ...prev, [workId]: rawList }));
    } catch (e) {
      console.error('Lỗi reload plans sau khi lưu:', e);
    }
  };

  const handleExport = () => {
    exportWorksToExcel(filtered);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="h4">{t('works.title')}</h1>
          <p className="text-muted mb-0">{t('works.subtitle')}</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={handleExport}>
            <FiDownload className="me-1" /> {t('works.exportExcel')}
          </button>
          <LanguageSwitcher />
          <button type="button" className="btn btn-primary" onClick={() => formModalRef.current?.openCreate()}>
            <FiPlus className="me-1" /> {isManagerOrAdmin ? t('works.addWork') : t('works.sendRequest')}
          </button>
        </div>
      </div>

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <div className="data-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="data-table-toolbar" style={{ flexShrink: 0 }}>
            <input
              className="form-control"
              style={{ maxWidth: 280 }}
              placeholder={t('works.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" style={{ maxWidth: 180 }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">{t('works.filters.allPriority')}</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="form-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('works.filters.allStatus')}</option>
              <option value="good">{t('works.filters.statusGood')}</option>
              <option value="warn">{t('works.filters.statusWarn')}</option>
              <option value="bad">{t('works.filters.statusBad')}</option>
            </select>
            <select className="form-select" style={{ maxWidth: 180 }} value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value)}>
              <option value="">{t('works.filters.allWorkflow')}</option>
              <option value="requested">{t('common.workflow.requested')}</option>
              <option value="approved">{t('common.workflow.approved')}</option>
              <option value="in_progress">{t('common.workflow.in_progress')}</option>
              <option value="completed">{t('common.workflow.completed')}</option>
            </select>
            <input
              type="text"
              className="form-control"
              list="pic-support-options"
              style={{ maxWidth: 200 }}
              placeholder={t('works.filters.picSupportPlaceholder')}
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
            />
            <datalist id="pic-support-options">
              {picOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <div ref={deadlineMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="form-select text-center"
                style={{ maxWidth: 220, minWidth: 220 }}
                onClick={() => setDeadlineMenuOpen((prev) => !prev)}
              >
                {selectedDeadlines.length > 0
                  ? t('works.filters.expectedDeadlineCount', { count: selectedDeadlines.length })
                  : t('works.filters.expectedDeadline')}
              </button>

              {deadlineMenuOpen && (
                <div
                  className="shadow"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 20,
                    marginTop: '4px',
                    minWidth: '220px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    background: 'var(--card-bg, #1a1d2e)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '6px',
                    padding: '8px',
                  }}
                >
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="deadline-all"
                      checked={selectedDeadlines.length === 0}
                      onChange={() => setSelectedDeadlines([])}
                    />
                    <label className="form-check-label" htmlFor="deadline-all">{t('works.filters.all')}</label>
                  </div>
                  <hr className="my-2" />
                  {deadlineOptions.length === 0 && (
                    <div className="text-muted small">{t('works.filters.noDeadlineData')}</div>
                  )}
                  {deadlineOptions.map((opt) => (
                    <div className="form-check" key={opt.value}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`deadline-${opt.value}`}
                        checked={selectedDeadlines.includes(opt.value)}
                        onChange={() => toggleDeadline(opt.value)}
                      />
                      <label className="form-check-label" htmlFor={`deadline-${opt.value}`}>{opt.label}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="legend">
              <span><span className="legend-dot" style={{ background: 'var(--status-good)' }} />{t('works.legend.good')} ({legendCounts.good})</span>
              <span><span className="legend-dot" style={{ background: 'var(--status-warn)' }} />{t('works.legend.warn')} ({legendCounts.warn})</span>
              <span><span className="legend-dot" style={{ background: 'var(--status-bad)' }} />{t('works.legend.bad')} ({legendCounts.bad})</span>
              <span>{t('works.legend.rows', { filtered: filtered.length, total: works.length })}</span>
            </div>
          </div>

          {filtered.length === 0 && <EmptyState message={t('works.noMatch')} />}

          {filtered.length > 0 && (
            <div className="table-responsive-wrap" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="table align-middle mb-0">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg, #1a1d2e)', color: 'var(--text-color, #ffffff)', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '45px', minWidth: '45px' }}>{t('works.columns.no')}</th>
                    <th style={{ width: '150px', minWidth: '150px' }}>{t('works.columns.project')}</th>
                    <th style={{ width: '160px', minWidth: '160px', textAlign: 'center' }}>{t('works.columns.image')}</th>
                    <th style={{ width: '120px', minWidth: '120px' }}>{t('works.columns.factory')}</th>
                    <th style={{ minWidth: '450px', width: 'auto' }}>{t('works.columns.progressUpdate')}</th>
                    <th style={{ width: '100px', minWidth: '100px' }}>{t('works.columns.statusPercent')}</th>
                    <th style={{ width: '60px', minWidth: '60px' }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((work, index) => {
                    const bucket = progressBucket(work.progress_percent);
                    const barColor = bucket === 'good' ? 'var(--status-good)' : bucket === 'warn' ? 'var(--status-warn)' : 'var(--status-bad)';

                    const currentUserName = user?.name?.trim().toLowerCase() || '';
                    const leadProject = (work.lead_project || work.assigned_to_name || '').trim().toLowerCase();
                    const assistantName = (work.assistant || work.support_name || '').trim().toLowerCase();

                    const isOwner = Boolean(currentUserName) && (leadProject === currentUserName || assistantName === currentUserName);
                    const canUpdateProgress = isOwner || isManagerOrAdmin;

                    // 👈 Ưu tiên plans từ state (fetch riêng), fallback về work.plans
                    const plans = plansByWork[work.id] || (work as any).plans || (work as any).task_plans || (work as any).milestones;
                    const isLoadingPlan = loadingPlans[work.id];

                    return (
                      <Fragment key={work.id}>
                        <tr>
                          <td>{index + 1}</td>
                          <td
                            className="fw-semibold"
                            style={{ width: '150px', minWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}
                          >
                            {work.task_name}
                          </td>
                          <td style={{ width: '160px', minWidth: '160px', padding: '3px' }}>
                            {(() => {
                              const images = (attachmentsByWork[work.id] || []).filter(
                                (a) => a.category === 'after_work' && a.mime_type?.startsWith('image/')
                              );
                              const latest = images[0];
                              if (!latest) return <div className="text-muted text-center">-</div>;
                              return (
                                <img
                                  src={latest.url}
                                  alt={t('works.afterWorkImageAlt')}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    height: '100%',
                                    minHeight: '110px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                  }}
                                  onClick={() => setZoomImage(latest.url)}
                                />
                              );
                            })()}
                          </td>
                          <td style={{ whiteSpace: 'normal' }}>{work.factory_name || '—'}</td>
                          <td style={{ whiteSpace: 'normal' }}>
                            {(() => {
                              // 👈 Đang load
                              if (isLoadingPlan && (!Array.isArray(plans) || plans.length === 0)) {
                                return <span className="text-muted small">{t('works.loadingMilestones')}</span>;
                              }

                              // 👈 Có plans array → render với due_date
                              if (Array.isArray(plans) && plans.length > 0) {
                                const sortedPlans = [...plans].sort((a: any, b: any) => {
                                  const idA = a.id ?? 0;
                                  const idB = b.id ?? 0;
                                  return idA - idB;
                                });

                                return sortedPlans.map((p: any, idx: number) => {
                                  const dueRaw = p.due_date || p.dueDate || null;
                                  const dueText = formatDueDate(dueRaw);
                                  const statusKey = mapStatusKey(p.status);
                                  const overdue = isOverdue(dueRaw, statusKey === 'done');

                                  return (
                                    <div
                                      key={p.id || idx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '6px',
                                        width: '100%',
                                        marginBottom: '4px',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                                        • <strong>{p.step_name || p.name}</strong>:{' '}
                                        {p.progress_percent ?? p.progress ?? 0}%
                                        <span className="text-muted ms-1">({t(`common.status.${statusKey}`)})</span>
                                      </span>

                                      {dueText && (
                                        <span
                                          title={overdue ? t('works.overdue') : t('works.dueDate')}
                                          style={{
                                            fontSize: '0.75rem',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            background: overdue
                                              ? 'rgba(239, 68, 68, 0.15)'
                                              : 'rgba(148, 163, 184, 0.15)',
                                            color: overdue ? '#ef4444' : 'var(--text-muted, #94a3b8)',
                                            border: `1px solid ${overdue ? 'rgba(239, 68, 68, 0.35)' : 'rgba(148, 163, 184, 0.25)'}`,
                                            fontWeight: overdue ? 600 : 400,
                                          }}
                                        >
                                          {overdue ? '⚠ ' : '📅 '}
                                          {dueText}
                                        </span>
                                      )}
                                    </div>
                                  );
                                });
                              }

                              // 👈 Fallback: hiển thị progress_comment text cũ
                              const textContent = typeof plans === 'string' ? plans : (work.progress_comment || '');
                              if (textContent.trim().length > 0) {
                                const items = textContent.split(/\s*-\s+/).filter(Boolean);
                                return items.map((item, idx) => (
                                  <div key={idx} style={{ display: 'block', width: '100%', marginBottom: '4px' }}>
                                    • {item}
                                  </div>
                                ));
                              }

                              return <span className="text-muted">-</span>;
                            })()}
                          </td>
                          <td>
                            <span className="status-progress-bar">
                              <div style={{ width: `${work.progress_percent}%`, background: barColor }} />
                            </span>
                            <span className={`status-badge ${bucket}`}>{work.progress_percent}</span>
                          </td>
                          <td className="text-center" style={{ width: '60px', minWidth: '60px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                title={t('works.actions.viewDetail')}
                                onClick={() => setSelectedWork(work)}
                              >
                                <FiEye />
                              </button>

                              {isManagerOrAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link"
                                  title={t('works.actions.assign')}
                                  onClick={() => formModalRef.current?.openAssign(work)}
                                >
                                  <FiUserPlus />
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                title={t('works.actions.updateProgress')}
                                disabled={!isManagerOrAdmin && !isOwner}
                                style={(!isManagerOrAdmin && !isOwner) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                onClick={() => {
                                  if (isManagerOrAdmin || isOwner) {
                                    progressModalRef.current?.open(work);
                                  }
                                }}
                              >
                                <FiEdit2 />
                              </button>

                              {isManagerOrAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-danger"
                                  title={t('works.actions.delete')}
                                  onClick={() => deleteWork.mutate(work.id)}
                                >
                                  <FiTrash2 />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === work.id && (
                          <tr>
                            <td colSpan={7} className="bg-light-subtle">
                              <TaskPlansPanel workId={work.id} canEdit={canUpdateProgress} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <WorkFormModal
        ref={formModalRef}
        projects={projectsQuery.data?.documents ?? []}
        users={usersQuery.data?.documents ?? []}
        onSubmit={handleFormSubmit}
      />
      <ProgressUpdateModal ref={progressModalRef} isReviewer={isManagerOrAdmin} onSubmit={handleProgressSubmit} />

      <WorkDetailModal work={selectedWork} onClose={() => setSelectedWork(null)} />

      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={zoomImage}
            alt={t('works.afterWorkImageAlt')}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="btn btn-light"
            onClick={() => setZoomImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
