import { NavLink } from 'react-router-dom';
import { FiGrid, FiCheckSquare, FiUsers, FiPieChart, FiLogOut, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoImg from '../assets/logoDigital.JPG.jpg';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'User',
};

export default function Sidebar() {
  const { user, can, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="app-sidebar"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Phần Brand — cố định trên cùng */}
      <div
        className="sidebar-brand d-flex flex-column align-items-center justify-content-center px-3 py-3"
        style={{ flexShrink: 0 }}
      >
        <div
          className="bg-white rounded overflow-hidden shadow-sm d-flex align-items-center justify-content-center p-1 w-100"
          style={{ maxWidth: '190px', height: '90px' }}
        >
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Phần Menu — flex 1, cuộn nếu dài */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <nav className="nav flex-column">
          <NavLink to="/dashboard" className="nav-link d-flex align-items-center gap-2 px-3 py-2">
            <FiGrid /> Tổng quan
          </NavLink>
          <NavLink to="/works" className="nav-link d-flex align-items-center gap-2 px-3 py-2">
            <FiCheckSquare /> Theo dõi dự án
          </NavLink>
          <NavLink to="/finance" className="nav-link d-flex align-items-center gap-2 px-3 py-2">
            <FiPieChart /> Phân tích tài chính
          </NavLink>
        </nav>

        <div className="nav-section-label">Quản trị</div>
        <nav className="nav flex-column">
          {can('admin') && (
            <NavLink to="/users" className="nav-link d-flex align-items-center gap-2 px-3 py-2">
              <FiUsers /> Người dùng
            </NavLink>
          )}
        </nav>
      </div>

      {/* Phần Footer — LUÔN ở cuối, không bị cuộn */}
      <div
        className="sidebar-footer"
        style={{ flexShrink: 0, marginTop: 'auto' }}
      >
        <div className="sidebar-user">
          {user?.name}
          <span className="badge text-bg-primary ms-2">{ROLE_LABEL[user?.role ?? 'user']}</span>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2 mb-2"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        >
          {theme === 'dark' ? <FiSun /> : <FiMoon />} {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2"
          onClick={() => logout()}
        >
          <FiLogOut /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}