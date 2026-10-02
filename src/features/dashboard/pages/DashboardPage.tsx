import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import * as db from '../../../lib/db';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';

function progressBucket(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 80) return 'good';
  if (percent >= 40) return 'warn';
  return 'bad';
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const worksQuery = useQuery({ queryKey: ['works', 'dashboard'], queryFn: () => db.listWorks({ limit: 200 }) });

  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const formatBillion = (amount: number) =>
    `${(amount / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })} ${t('finance.units.billion')} ${t('finance.units.currency')}`;

  const PRIORITY_LABEL: Record<string, string> = {
    high: t('common.priority.high'),
    medium: t('common.priority.medium'),
    low: t('common.priority.low'),
  };

  const works = useMemo(() => worksQuery.data?.documents ?? [], [worksQuery.data]);

  const stats = useMemo(() => {
    const total = works.length;
    const avgProgress = total === 0 ? 0 : Math.round(works.reduce((s, w) => s + w.progress_percent, 0) / total);
    const totalCapex = works.reduce((s, w) => s + (w.capex_amount ?? 0), 0);
    const totalSaving = works.reduce((s, w) => s + (w.estimated_saving_per_year ?? 0), 0);
    const paybackValues = works.filter((w) => w.payback_years !== null).map((w) => w.payback_years as number);
    const avgPayback = paybackValues.length === 0 ? null
      : paybackValues.reduce((s, v) => s + v, 0) / paybackValues.length;

    const completed = works.filter((w) => w.progress_percent >= 100).length;
    const notStarted = works.filter((w) => w.progress_percent === 0).length;
    const inProgress = total - completed - notStarted;

    const completedPercent = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    const inProgressPercent = total > 0 ? ((inProgress / total) * 100).toFixed(1) : '0';
    const notStartedPercent = total > 0 ? ((notStarted / total) * 100).toFixed(1) : '0';

    return {
      total,
      avgProgress,
      totalCapex,
      totalSaving,
      avgPayback,
      completed,
      inProgress,
      notStarted,
      completedPercent,
      inProgressPercent,
      notStartedPercent
    };
  }, [works]);

  const topProjects = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};

    works.forEach((work) => {
      const key = work.task_name?.trim() || t('finance.noName');
      if (!groups[key]) {
        groups[key] = { total: 0, count: 0 };
      }
      groups[key].total += work.progress_percent ?? 0;
      groups[key].count += 1;
    });

    return Object.entries(groups)
      .map(([taskName, { total, count }]) => ({
        task_name: taskName,
        avgProgress: Math.round(total / count),
        count: count,
      }))
      .sort((a, b) => b.avgProgress - a.avgProgress)
      .slice(0, 8);
  }, [works, t]);

  const highPriorityIncomplete = useMemo(
    () => works.filter((w) => w.priority === 'high' && w.progress_percent < 100),
    [works],
  );

  const statusDistribution = [
    { name: t('common.status.done'), value: stats.completed, color: '#2563eb' },
    { name: t('common.status.in_progress'), value: stats.inProgress, color: '#0ea5e9' },
    { name: t('common.status.pending'), value: stats.notStarted, color: '#cbd5e1' },
  ];

  if (worksQuery.isLoading) return <LoadingOverlay />;
  if (worksQuery.isError) return <ErrorState />;

  return (
    <div
      className="dashboard-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingBottom: '24px',
      }}
    >
      <div className="page-header">
        <div>
          <h1 className="h4">{t('dashboard.title')}</h1>
          <p className="text-muted mb-0">
            {t('dashboard.subtitle', { count: stats.total })}
          </p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md">
          <div className="card-surface h-100">
            <div className="text-muted small">{t('dashboard.totalWorks')}</div>
            <div className="fs-3 fw-bold">{stats.total}</div>
            <div className="text-muted small">
              {t('dashboard.statusSummary', { done: stats.completed, inProgress: stats.inProgress, notStarted: stats.notStarted })}
            </div>
          </div>
        </div>
        <div className="col-md">
          <div className="card-surface h-100">
            <div className="text-muted small">{t('dashboard.avgProgress')}</div>
            <div className="fs-3 fw-bold">{stats.avgProgress}%</div>
            <div className="text-muted small">{t('dashboard.acrossAllWorks')}</div>
          </div>
        </div>
        <div className="col-md">
          <div className="card-surface h-100">
            <div className="text-muted small">{t('dashboard.totalCapex')}</div>
            <div className="fs-3 fw-bold">{formatBillion(stats.totalCapex)}</div>
          </div>
        </div>
        <div className="col-md">
          <div className="card-surface h-100">
            <div className="text-muted small">{t('dashboard.estimatedSaving')}</div>
            <div className="fs-3 fw-bold text-success">{formatBillion(stats.totalSaving)}</div>
          </div>
        </div>
        <div className="col-md">
          <div className="card-surface h-100">
            <div className="text-muted small">{t('dashboard.paybackTime')}</div>
            <div className="fs-3 fw-bold">{stats.avgPayback !== null ? `${stats.avgPayback.toFixed(1)} ${t('finance.units.years')}` : '—'}</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card-surface h-100">
            <h6 className="mb-3">{t('dashboard.progressByMainWorks')}</h6>
            {topProjects.length === 0 && <EmptyState message={t('dashboard.noWorks')} />}
            <div className="d-flex flex-column gap-2">
              {topProjects.map((group) => {
                const bucket = progressBucket(group.avgProgress);
                const barColor = bucket === 'good' ? 'var(--status-good)' : bucket === 'warn' ? 'var(--status-warn)' : 'var(--status-bad)';
                return (
                  <div key={group.task_name} className="d-flex align-items-center gap-2">
                    <div className="text-truncate" style={{ width: 180, fontSize: '0.85rem' }} title={group.task_name}>
                      {group.task_name}
                      {group.count > 1 && (
                        <span className="text-muted ms-1" style={{ fontSize: '0.75rem' }}>
                          ({group.count})
                        </span>
                      )}
                    </div>
                    <div className="flex-grow-1" style={{ height: 8, background: '#e6e9f5', borderRadius: 999 }}>
                      <div style={{ width: `${group.avgProgress}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                    </div>
                    <div style={{ width: 42, fontSize: '0.85rem' }} className="text-end fw-semibold">{group.avgProgress}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card-surface h-100 d-flex flex-column">
            <div>
              <h6 className="mb-1">{t('dashboard.statusDistribution')}</h6>
              <div className="text-muted small mb-2">{t('dashboard.rowsByCompletion')}</div>
            </div>

            <div style={{ flex: 1, minHeight: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="row text-center mt-2 pt-2 border-top g-0">
              <div className="col">
                <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
                  <span className="text-muted small" style={{ fontSize: '0.75rem' }}>{t('common.status.done')}</span>
                </div>
                <div className="fw-bold fs-5 text-primary">{stats.completed}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{stats.completedPercent}%</div>
              </div>
              <div className="col border-start">
                <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0ea5e9', display: 'inline-block' }}></span>
                  <span className="text-muted small" style={{ fontSize: '0.75rem' }}>{t('common.status.in_progress')}</span>
                </div>
                <div className="fw-bold fs-5 text-info">{stats.inProgress}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{stats.inProgressPercent}%</div>
              </div>
              <div className="col border-start">
                <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'inline-block' }}></span>
                  <span className="text-muted small" style={{ fontSize: '0.75rem' }}>{t('common.status.pending')}</span>
                </div>
                <div className="fw-bold fs-5 text-secondary">{stats.notStarted}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{stats.notStartedPercent}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-surface">
        <h6 className="mb-3">{t('dashboard.highPriorityPending')}</h6>
        {highPriorityIncomplete.length === 0 && <EmptyState message={t('dashboard.noHighPriorityPending')} />}
        {highPriorityIncomplete.length > 0 && (
          <div className="table-responsive-wrap">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('dashboard.columns.project')}</th>
                  <th>{t('dashboard.columns.factory')}</th>
                  <th>{t('dashboard.columns.pic')}</th>
                  <th>{t('dashboard.columns.progress')}</th>
                  <th>{t('dashboard.columns.percent')}</th>
                </tr>
              </thead>
              <tbody>
                {highPriorityIncomplete.map((w) => (
                  <tr key={w.id}>
                    <td>
                      {w.task_name}
                      <span className="badge-priority high ms-2">{PRIORITY_LABEL[w.priority]}</span>
                    </td>
                    <td>{w.factory_name || '—'}</td>
                    <td>{w.lead_project || w.assigned_to_name || '—'}</td>
                    <td style={{ width: 160 }}>
                      <div style={{ height: 6, background: '#e6e9f5', borderRadius: 999 }}>
                        <div style={{ width: `${w.progress_percent}%`, height: '100%', background: 'var(--status-bad)', borderRadius: 999 }} />
                      </div>
                    </td>
                    <td>{w.progress_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
