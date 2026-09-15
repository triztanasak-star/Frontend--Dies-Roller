import { Link } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

export default function NotFoundPage() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <FiAlertCircle size={64} style={{ color: 'var(--color-warning)', marginBottom: 16 }} />
      <h1 style={{ fontSize: 72, fontWeight: 800, color: 'var(--color-muted)', lineHeight: 1 }}>404</h1>
      <h2 className="mt-2 mb-3">Trang không tồn tại</h2>
      <p className="text-muted mb-4">Đường dẫn bạn truy cập không hợp lệ hoặc đã bị xóa.</p>
      <Link to="/dashboard" className="btn btn-primary">Về trang chủ</Link>
    </div>
  );
}
