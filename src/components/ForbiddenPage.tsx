import { Link } from 'react-router-dom';
import { FiShield } from 'react-icons/fi';

export default function ForbiddenPage() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <FiShield size={64} style={{ color: 'var(--color-danger)', marginBottom: 16 }} />
      <h1 style={{ fontSize: 72, fontWeight: 800, color: 'var(--color-muted)', lineHeight: 1 }}>403</h1>
      <h2 className="mt-2 mb-3">Không có quyền truy cập</h2>
      <p className="text-muted mb-4">Bạn không có quyền xem trang này.</p>
      <Link to="/dashboard" className="btn btn-outline-primary">Về trang chủ</Link>
    </div>
  );
}
