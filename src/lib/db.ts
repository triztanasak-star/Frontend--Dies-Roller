import client, { setAccessToken } from './adapters/nodeAdapter';

export type Role = 'admin' | 'manager' | 'user';
export type WorkType = 'die' | 'roller';

export interface User {
  $id: string;
  id: number;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
  created_at: string;
}

export interface Project {
  $id: string;
  id: number;
  project_name: string;
  description: string | null;
  manager_id: number | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface MilestoneItem {
  id: string | number;
  name: string;
  progress: number;
  status: string;
  dueDate?: string;
}

export interface DigitalWork {
  $id: string;
  id: number;
  task_name: string;
  description: string | null;
  factory_name: string | null;
  status: number;
  workflow_status: 'requested' | 'approved' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  progress_percent: number;
  expected_deadline: string | null;
  desired_deadline: string | null;
  completed_at: string | null;
  lead_project: string | null;
  assistant: string | null;
  representative_name: string | null;
  representative_email: string | null;
  representative_phone: string | null;
  project_id: number | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  support_id: number | null;
  support_name: string | null;
  created_by: number | null;
  capex_amount: number | null;
  estimated_saving_per_year: number | null;
  payback_years: number | null;
  manager_comment: string | null;
  progress_comment: string | null;
  support_request: string | null;
  has_feedback: boolean;
  feedback_comment: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  milestones?: MilestoneItem[];

  // DIES_ROLLER FIELDS
  dies_model: string | null;
  dies_code: string | null;
  symptom: string | null;
  supplier: string | null;

  // ✅ SỬA: Đổi từ number → string | number | null
  // - Die: dies_hole_mm = 2.5, 2.8, 3.5, 4.0 (number)
  // - Roller: dies_hole_mm = "8x10", "8x12", "No Hole" (string)
  dies_hole_mm: string | number | null;

  press_length_mm: string | null;
  ld_ratio: number | null;
  dies_life_ton: number | null;
  standard_ton: number | null;
  remaining_tons: number | null;
  dies_price_vnd: number | null;
  price_per_ton_vnd: number | null;
  result_cost_per_ton_vnd: number | null;
  line_in_use: string | null;
  note: string | null;
}

export interface TaskPlan {
  $id: string;
  id: number;
  work_id: number;
  created_by: number | null;
  step_name: string;
  step_order: number;
  status: 'pending' | 'in_progress' | 'done';
  progress_percent: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkAttachment {
  $id: string;
  id: number;
  work_id: number;
  url: string;
  original_name: string;
  mime_type: string | null;
  category: string | null;
  uploaded_by: number | null;
  created_at: string;
}

// ✅ App Settings (đã thêm dies_model, press_length_mm, standard_ton)
export interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  press_length_mm: string | null;
  standard_ton: number | null;
  dies_model: string | null;
  updated_at: string;
  updated_by: number | null;
}

interface ListResponse<T> {
  documents: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Auth ---
export const register = async (name: string, email: string, password: string) => {
  const res = await client.post('/api/auth/register', { name, email, password });
  return res.data as User;
};

export const login = async (email: string, password: string) => {
  const res = await client.post('/api/auth/login', { email, password });
  setAccessToken(res.data.token);
  return res.data.user as User;
};

export const logout = async () => {
  await client.post('/api/auth/logout');
  setAccessToken(null);
};

export const fetchMe = async () => {
  const res = await client.get('/api/auth/me');
  return res.data as User;
};

export const refreshSession = async () => {
  const res = await client.post('/api/auth/refresh');
  setAccessToken(res.data.token);
};

// --- Users ---
export const listUsers = async (page = 1) => {
  const res = await client.get('/api/users', { params: { page } });
  return res.data as ListResponse<User>;
};

export const createUser = async (payload: { name: string; email: string; password: string; role: Role }) => {
  const res = await client.post('/api/users', payload);
  return res.data as User;
};

export const updateUser = async (id: number, payload: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>) => {
  const res = await client.put(`/api/users/${id}`, payload);
  return res.data as User;
};

export const disableUser = async (id: number) => {
  await client.delete(`/api/users/${id}`);
};

// --- Projects ---
export const listProjects = async (page = 1) => {
  const res = await client.get('/api/projects', { params: { page } });
  return res.data as ListResponse<Project>;
};

export const createProject = async (payload: { project_name: string; description?: string; manager_id?: number }) => {
  const res = await client.post('/api/projects', payload);
  return res.data as Project;
};

export const updateProject = async (id: number, payload: Partial<Pick<Project, 'project_name' | 'description' | 'manager_id' | 'status'>>) => {
  const res = await client.put(`/api/projects/${id}`, payload);
  return res.data as Project;
};

export const deleteProject = async (id: number) => {
  await client.delete(`/api/projects/${id}`);
};

// ============================================================
// --- Digital Works (HỖ TRỢ CẢ DIE VÀ ROLLER) ---
// ============================================================

/**
 * ✅ List works - hỗ trợ type 'die' | 'roller'
 * - type='die' (mặc định) → query bảng digital_works
 * - type='roller' → query bảng digital_roller_works
 */
export const listWorks = async (params: {
  page?: number;
  limit?: number;
  project_id?: number;
  assigned_to?: number;
  type?: WorkType;
} = {}) => {
  const res = await client.get('/api/works', { params });
  return res.data as ListResponse<DigitalWork>;
};

/**
 * ✅ Create work - truyền type qua query param
 */
export const createWork = async (
  payload: Partial<DigitalWork> & { task_name: string },
  type: WorkType = 'die'
) => {
  const res = await client.post('/api/works', payload, { params: { type } });
  return res.data as DigitalWork;
};

/**
 * ✅ Update work - truyền type qua query param
 */
export const updateWork = async (
  id: number,
  payload: Partial<DigitalWork>,
  type: WorkType = 'die'
) => {
  const res = await client.put(`/api/works/${id}`, payload, { params: { type } });
  return res.data as DigitalWork;
};

/**
 * ✅ Update progress - truyền type qua query param
 */
export const updateWorkProgress = async (
  id: number,
  payload: Partial<DigitalWork>,
  type: WorkType = 'die'
) => {
  const res = await client.patch(`/api/works/${id}/progress`, payload, { params: { type } });
  return res.data as DigitalWork;
};

/**
 * ✅ Delete work - truyền type qua query param
 */
export const deleteWork = async (id: number, type: WorkType = 'die') => {
  await client.delete(`/api/works/${id}`, { params: { type } });
};

/**
 * ✅ Get work by ID cho trang public (QR scan) — KHÔNG cần auth
 */
export const getWorkPublic = async (id: number, type: WorkType = 'die') => {
  const res = await client.get(`/api/works/${id}/public`, { params: { type } });
  return res.data as DigitalWork;
};

// ============================================================
// --- Task Plans ---
// ============================================================

/**
 * ✅ SỬA: Thêm param `type` để query plans cho Roller
 */
export const listTaskPlans = async (workId: number, type: WorkType = 'die') => {
  const res = await client.get(`/api/works/${workId}/plans`, { params: { type } });
  if (Array.isArray(res.data)) {
    return { documents: res.data };
  }
  return res.data as { documents: TaskPlan[] };
};

/**
 * ✅ SỬA: Thêm param `type` để tạo plan cho Roller
 */
export const createTaskPlan = async (
  workId: number,
  payload: { step_name: string; step_order?: number; due_date?: string; progress_percent?: number },
  type: WorkType = 'die'
) => {
  const res = await client.post(`/api/works/${workId}/plans`, payload, { params: { type } });
  return res.data as TaskPlan;
};

export const updateTaskPlan = async (id: number, payload: Partial<Pick<TaskPlan, 'step_name' | 'step_order' | 'status' | 'due_date' | 'progress_percent'>>) => {
  const res = await client.put(`/api/plans/${id}`, payload);
  return res.data as TaskPlan;
};

export const deleteTaskPlan = async (id: number) => {
  await client.delete(`/api/plans/${id}`);
};

// ============================================================
// --- Work Attachments ---
// ============================================================

/**
 * ✅ SỬA: Thêm param `type` để query attachments cho Roller
 */
export const listAttachments = async (workId: number, type: WorkType = 'die') => {
  const res = await client.get(`/api/works/${workId}/attachments`, { params: { type } });
  return res.data as { documents: WorkAttachment[] };
};

/**
 * ✅ SỬA: Thêm param `type` để upload attachments cho Roller
 */
export const uploadAttachments = async (
  workId: number,
  files: File[],
  category?: string,
  type: WorkType = 'die'
) => {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  if (category) formData.append('category', category);

  const res = await client.post(`/api/works/${workId}/attachments`, formData, { params: { type } });
  return res.data as { documents: WorkAttachment[] };
};

export const deleteAttachment = async (id: number) => {
  await client.delete(`/api/attachments/${id}`);
};

export const downloadAttachment = async (id: number, fileName: string) => {
  const res = await client.get(`/api/attachments/${id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// --- App Settings ---
export const listSettings = async () => {
  const res = await client.get('/api/settings');
  return res.data as { documents: AppSetting[] };
};

export const getSetting = async (key: string) => {
  const res = await client.get(`/api/settings/${key}`);
  return res.data as AppSetting;
};

// ✅ Update setting — hỗ trợ press_length_mm, standard_ton, dies_model
export const updateSetting = async (
  key: string,
  payload: {
    value: string;
    description?: string;
    press_length_mm?: string | null;
    standard_ton?: number | null;
    dies_model?: string | null;
  }
) => {
  const res = await client.put(`/api/settings/${key}`, payload);
  return res.data as AppSetting;
};

// ✅ Delete setting
export const deleteSetting = async (key: string) => {
  await client.delete(`/api/settings/${key}`);
};