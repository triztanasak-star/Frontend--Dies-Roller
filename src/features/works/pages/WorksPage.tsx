import { useMemo, useRef, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiDownload, FiUpload, FiPlus, FiEdit2, FiTrash2, FiUserPlus, FiPaperclip } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import * as db from '../../../lib/db';
import type { DigitalWork } from '../../../lib/db';
import { exportWorksToExcel, parseWorksExcelFile } from '../../../lib/excel';
import { useCreateWork, useDeleteWork, useUpdateWork, useUpdateWorkProgress, useWorks } from '../hooks/useWorks';
import TaskPlansPanel from './TaskPlansPanel';
import WorkFormModal, { type WorkFormModalHandle, type WorkFormValues } from './WorkFormModal';
import ProgressUpdateModal, { type ProgressUpdateModalHandle } from './ProgressUpdateModal';
import { useQueryClient } from '@tanstack/react-query';

const PRIORITY_LABEL: Record<string, string> = { high: 'High (H)', medium: 'Medium (M)', low: 'Low (L)' };

function progressBucket(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 80) return 'good';
  if (percent >= 40) return 'warn';
  return 'bad';
}

function WorkAttachmentsCell({ workId }: { workId: number }) {
  const { data } = useQuery({
    queryKey: ['work_attachments', workId],
    queryFn: () => db.listAttachments(workId),
  });

  const attachments = data?.documents ?? [];

  if (attachments.length === 0) {
    return <span className="text-muted">—</span>;
  }

  const handleDownload = async (e: React.MouseEvent, fileUrl?: string, fileName?: string) => {
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
    } catch (error) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="d-flex flex-column gap-1">
      {attachments.map((file: any) => {
        const fileUrl = file.url || file.file_path;

        return (
          <a
            key={file.id}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => handleDownload(e, fileUrl, file.original_name)}
            className="text-decoration-none small text-truncate d-flex align-items-center gap-1"
            style={{ maxWidth: 140, cursor: 'pointer' }}
            title={file.original_name}
          >
            <FiPaperclip size={12} /> {file.original_name}
          </a>
        );
      })}
    </div>
  );
}

export default function WorksPage() {
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

  const formModalRef = useRef<WorkFormModalHandle>(null);
  const progressModalRef = useRef<ProgressUpdateModalHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const works = useMemo(() => data?.documents ?? [], [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return works.filter((w) => {
      if (priorityFilter && w.priority !== priorityFilter) return false;
      if (statusFilter && progressBucket(w.progress_percent) !== statusFilter) return false;
      if (term) {
        const haystack = `${w.task_name} ${w.factory_name ?? ''} ${w.lead_project ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [works, search, priorityFilter, statusFilter]);

  const legendCounts = useMemo(() => {
    const base = { good: 0, warn: 0, bad: 0 };
    for (const w of filtered) base[progressBucket(w.progress_percent)] += 1;
    return base;
  }, [filtered]);

  const handleFormSubmit = async (values: WorkFormValues, editingId: number | null) => {
    const payload: Partial<DigitalWork> = {
      task_name: values.task_name,
      factory_name: values.factory_name || null,
      description: values.description || null,
      priority: values.priority as 'high' | 'medium' | 'low',
      lead_project: values.lead_project || null,
      assistant: values.assistant || null,
      assigned_to: null,
      support_id: null,
      project_id: values.project_id ? Number(values.project_id) : null,
      expected_deadline: values.expected_deadline || null,
      capex_amount: values.capex_amount ? Number(values.capex_amount) : null,
      estimated_saving_per_year: values.estimated_saving_per_year ? Number(values.estimated_saving_per_year) : null,
      payback_years: values.payback_years ? Number(values.payback_years) : null,
    };
    
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
  };

  const handleExport = () => {
    exportWorksToExcel(filtered);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const rows = await parseWorksExcelFile(file);
    for (const row of rows) {
      await createWork.mutateAsync(row as Partial<DigitalWork> & { task_name: string });
    }
  };

  return (
    <div>
      {/* ✅ CSS cho sticky header - header luôn nền trắng + chữ đen */}
      <style>{`
        .sticky-table-wrap {
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          overflow-x: auto;
          position: relative;
          border-radius: 8px;
        }
        .sticky-table-wrap table thead {
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .sticky-table-wrap table thead tr {
          background: #ffffff;
        }
        .sticky-table-wrap table thead th {
          background: #ffffff !important;
          color: #1a1a1a !important;
          border-bottom: 2px solid #e5e7eb !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="h4">Theo dõi dự án</h1>
          <p className="text-muted mb-0">Danh sách dự án Digital theo nhà máy </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={handleExport}>
            <FiDownload className="me-1" /> Xuất Excel
          </button>
          {isManagerOrAdmin && (
            <>
              <button type="button" className="btn btn-outline-primary" onClick={() => importInputRef.current?.click()}>
                <FiUpload className="me-1" /> Nhập Excel
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="d-none"
                onChange={handleImportFile}
              />
            </>
          )}
          <button type="button" className="btn btn-primary" onClick={() => formModalRef.current?.openCreate()}>
            <FiPlus className="me-1" /> {isManagerOrAdmin ? 'Thêm dự án' : 'Gửi yêu cầu'}
          </button>
        </div>
      </div>

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <div className="data-table-card">
          <div className="data-table-toolbar">
            <input
              className="form-control"
              style={{ maxWidth: 280 }}
              placeholder="Tìm theo tên dự án, nhà máy, PIC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" style={{ maxWidth: 180 }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">Tất cả mức ưu tiên</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="form-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="good">≥ 80%</option>
              <option value="warn">40 – 80%</option>
              <option value="bad">&lt; 40%</option>
            </select>
            <div className="legend">
              <span><span className="legend-dot" style={{ background: 'var(--status-good)' }} />≥80% ({legendCounts.good})</span>
              <span><span className="legend-dot" style={{ background: 'var(--status-warn)' }} />40–80% ({legendCounts.warn})</span>
              <span><span className="legend-dot" style={{ background: 'var(--status-bad)' }} />&lt;40% ({legendCounts.bad})</span>
              <span>{filtered.length} / {works.length} dòng</span>
            </div>
          </div>

          {filtered.length === 0 && <EmptyState message="Không có dự án phù hợp." />}

          {filtered.length > 0 && (
            <div className="sticky-table-wrap">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>NO.</th>
                    <th>DỰ ÁN</th>
                    <th>ƯU TIÊN</th>
                    <th>NHÀ MÁY</th>
                    <th>TIẾN ĐỘ CẬP NHẬT</th>
                    <th>PIC</th>
                    <th>HỖ TRỢ</th>
                    <th>TRẠNG THÁI (%)</th>
                    <th>HOÀN THÀNH DỰ KIẾN</th>
                    <th>TÀI LIỆU</th>
                    <th />
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

                    return (
                      <Fragment key={work.id}>
                        <tr>
                          <td>{index + 1}</td>
                          <td className="fw-semibold">{work.task_name}</td>
                          <td><span className={`badge-priority ${work.priority}`}>{PRIORITY_LABEL[work.priority]}</span></td>
                          <td>{work.factory_name || '—'}</td>
                          <td style={{ minWidth: '320px', maxWidth: '420px', whiteSpace: 'normal' }}>
                            {(() => {
                              const rawData = (work as any).plans || (work as any).task_plans || (work as any).milestones;
                              
                              if (Array.isArray(rawData) && rawData.length > 0) {
                                return rawData.map((p: any, idx: number) => (
                                  <div key={idx} style={{ display: 'block', width: '100%', marginBottom: '4px' }}>
                                    • <strong>{p.step_name || p.name}</strong>: {p.progress_percent ?? p.progress ?? 0}% 
                                    <span className="text-muted ms-1">({p.status})</span>
                                  </div>
                                ));
                              }
                              
                              const textContent = typeof rawData === 'string' ? rawData : (work.progress_comment || '');
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
                          <td>{work.lead_project || work.assigned_to_name || '—'}</td>
                          <td>{work.assistant || work.support_name || '—'}</td>
                          <td>
                            <span className="status-progress-bar">
                              <div style={{ width: `${work.progress_percent}%`, background: barColor }} />
                            </span>
                            <span className={`status-badge ${bucket}`}>{work.progress_percent}</span>
                          </td>
                          <td>{work.expected_deadline ? new Date(work.expected_deadline).toLocaleDateString('vi-VN') : '—'}</td>
                          <td>
                            <WorkAttachmentsCell workId={work.id} />
                          </td>
                          <td className="text-end text-nowrap">
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link"
                                title="Giao công việc"
                                onClick={() => formModalRef.current?.openAssign(work)}
                              >
                                <FiUserPlus />
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-sm btn-link"
                              title="Cập nhật tiến độ"
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
                                title="Xoá"
                                onClick={() => deleteWork.mutate(work.id)}
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedId === work.id && (
                          <tr>
                            <td colSpan={11} className="bg-light-subtle">
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
    </div>
  );
}