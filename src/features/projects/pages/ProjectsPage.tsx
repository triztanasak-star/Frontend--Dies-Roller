import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import { useCreateProject, useProjects } from '../hooks/useProjects';

export default function ProjectsPage() {
  const { can } = useAuth();
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectName.trim()) return;
    await createProject.mutateAsync({ project_name: projectName, description });
    setProjectName('');
    setDescription('');
  };

  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 m-0">{t('projects.title')}</h1>
      </div>

      {can('manager-or-admin') && (
        <form className="card-surface mb-4" onSubmit={handleCreate}>
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label">{t('projects.name')}</label>
              <input className="form-control" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
            </div>
            <div className="col-md-6">
              <label className="form-label">{t('projects.description')}</label>
              <input className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={createProject.isPending}>
                {t('projects.create')}
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}
      {!isLoading && !isError && (data?.documents.length ?? 0) === 0 && <EmptyState message={t('projects.noProjects')} />}

      {!isLoading && !isError && (data?.documents.length ?? 0) > 0 && (
        <div className="card-surface p-0">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>{t('projects.columns.name')}</th>
                <th>{t('projects.columns.status')}</th>
                <th>{t('projects.columns.createdAt')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data!.documents.map((project) => (
                <tr key={project.id}>
                  <td>{project.project_name}</td>
                  <td><span className="badge text-bg-secondary">{project.status}</span></td>
                  <td>{new Date(project.created_at).toLocaleDateString(locale)}</td>
                  <td className="text-end">
                    <Link to={`/works?project_id=${project.id}`} className="btn btn-sm btn-outline-primary">
                      {t('projects.viewWorks')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
