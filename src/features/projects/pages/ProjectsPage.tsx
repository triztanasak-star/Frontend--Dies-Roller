import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import { useCreateProject, useProjects } from '../hooks/useProjects';

export default function ProjectsPage() {
  const { can } = useAuth();
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 m-0">Dự án</h1>
      </div>

      {can('manager-or-admin') && (
        <form className="card-surface mb-4" onSubmit={handleCreate}>
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Tên dự án</label>
              <input className="form-control" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
            </div>
            <div className="col-md-6">
              <label className="form-label">Mô tả</label>
              <input className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={createProject.isPending}>
                Tạo mới
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}
      {!isLoading && !isError && (data?.documents.length ?? 0) === 0 && <EmptyState message="Chưa có dự án nào." />}

      {!isLoading && !isError && (data?.documents.length ?? 0) > 0 && (
        <div className="card-surface p-0">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Tên dự án</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data!.documents.map((project) => (
                <tr key={project.id}>
                  <td>{project.project_name}</td>
                  <td><span className="badge text-bg-secondary">{project.status}</span></td>
                  <td>{new Date(project.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="text-end">
                    <Link to={`/works?project_id=${project.id}`} className="btn btn-sm btn-outline-primary">
                      Xem công việc
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
