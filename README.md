# Digital_Work Frontend (React + Vite + TypeScript)

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # sua VITE_API_BASE_URL neu backend chay port khac
npm run dev
```

Mo http://localhost:5173 — can dam bao backend (`../backend`) dang chay va da co it nhat 1 tai khoan
(xem `backend/README.md` muc "Tao admin dau tien") de dang nhap.

## Luong chinh da lam

- `/login` — dang nhap, luu access token in-memory (khong localStorage), refresh token qua httpOnly cookie.
- `/dashboard` — tong quan so luong du an/task theo role.
- `/projects` — Admin/Manager tao du an; User chi xem du an co task cua minh.
- `/works` — Admin/Manager giao task (chon du an + nguoi thuc hien); User cap nhat tien do task cua minh;
  moi task co the mo rong xem/CRUD "Ke hoach thuc hien" (`task_plans`).
- `/users` — chi Admin: tao/doi quyen/khoa tai khoan.

## Kiem tra

- `npm run build` — type-check (`tsc -b`) + build production, da chay sach khong loi.
- `npm run lint` — oxlint, chi co 1 warning fast-refresh o `AuthContext.tsx` (khong anh huong runtime).
