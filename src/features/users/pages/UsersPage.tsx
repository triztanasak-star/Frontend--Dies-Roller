import { useState, type FormEvent } from 'react';
import LoadingOverlay from '../../../components/LoadingOverlay';
import ErrorState from '../../../components/ErrorState';
import EmptyState from '../../../components/EmptyState';
import { useCreateUser, useUpdateUser, useUsers } from '../hooks/useUsers';
import type { Role } from '../../../lib/db';

export default function UsersPage() {
  const { data, isLoading, isError } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  // Lưu trữ role đang chỉnh sửa tạm thời cho từng user theo ID: { [userId]: roleValue }
  const [editingRoles, setEditingRoles] = useState<Record<string, Role>>({});

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    await createUser.mutateAsync({ name, email, password, role });
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
  };

  const handleRoleChange = (userId: string, newRole: Role) => {
    setEditingRoles((prev) => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveRole = (userId: string) => {
    const newRole = editingRoles[userId];
    if (!newRole) return;
    
    updateUser.mutate({ id: Number(userId), payload: { role: newRole } }, {
      onSuccess: () => {
        // Xóa khỏi trạng thái tạm sau khi lưu thành công
        setEditingRoles((prev) => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      }
    });
  };

  return (
    <div>
      <h1 className="h4 mb-4">Người dùng</h1>

      <form className="card-surface mb-4" onSubmit={handleCreate}>
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label">Họ tên</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="col-md-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="col-md-2">
            <label className="form-label">Mật khẩu</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Quyền</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary w-100" disabled={createUser.isPending}>
              Tạo mới
            </button>
          </div>
        </div>
      </form>

      {isLoading && <LoadingOverlay />}
      {isError && <ErrorState />}
      {!isLoading && !isError && (data?.documents.length ?? 0) === 0 && <EmptyState message="Chưa có người dùng." />}

      {!isLoading && !isError && (data?.documents.length ?? 0) > 0 && (
        <div className="card-surface p-0">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data!.documents.map((u) => {
                const isActive = u.status === 'active';
                const currentSelectedRole = editingRoles[u.id] !== undefined ? editingRoles[u.id] : u.role;
                const isChanged = editingRoles[u.id] !== undefined && editingRoles[u.id] !== u.role;

                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <select
                          className="form-select form-select-sm"
                          style={{ width: '130px' }}
                          value={currentSelectedRole}
                          onChange={(e) => handleRoleChange(String(u.id), e.target.value as Role)}
                        >
                          <option value="user">User</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Chỉ hiện nút Lưu khi người dùng thay đổi quyền khác với database */}
                        {isChanged && (
                          <button
                            type="button"
                            className="btn btn-sm btn-success px-2 py-1"
                            onClick={() => handleSaveRole(String(u.id))}
                            disabled={updateUser.isPending}
                          >
                            Lưu
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge text-bg-${isActive ? 'success' : 'secondary'}`}>{u.status}</span>
                    </td>
                    <td className="text-end">
                      {isActive ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => updateUser.mutate({ id: u.id, payload: { status: 'disabled' } })}
                        >
                          Khoá
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={() => updateUser.mutate({ id: u.id, payload: { status: 'active' } })}
                        >
                          Mở khóa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}