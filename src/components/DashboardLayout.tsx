import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function DashboardLayout() {
  return (
    <div 
      className="app-shell"
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Sidebar />
      <div 
        className="app-main"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <main 
          className="app-content"
          style={{
            flex: 1,
            overflow: 'hidden',       // ← Đổi 'auto' → 'hidden'
            minHeight: 0,
            padding: '16px',           // ← Thêm padding
            display: 'flex',           // ← Thêm
            flexDirection: 'column',   // ← Thêm
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}