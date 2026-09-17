import * as XLSX from 'xlsx';
import type { DigitalWork } from './db';

const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABEL: Record<number, string> = { 0: 'Chưa bắt đầu', 1: 'Đang thực hiện', 2: 'Hoàn thành' };

export function exportWorksToExcel(works: DigitalWork[], fileName = 'du-an-digital-work.xlsx') {
  const rows = works.map((w, index) => ({
    'NO.': index + 1,
    'Dự án': w.task_name,
    'Ưu tiên': PRIORITY_LABEL[w.priority] ?? w.priority,
    'Nhà máy': w.factory_name ?? '',
    'Tiến độ cập nhật': w.progress_comment ?? '',
    PIC: w.assigned_to_name ?? w.assistant ?? '',
    'Hỗ trợ': w.support_name ?? w.assistant ?? '',
    'Trạng thái (%)': w.progress_percent,
    'Trạng thái': STATUS_LABEL[w.status] ?? w.status,
    'Hoàn thành dự kiến': w.expected_deadline ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dự án');
  XLSX.writeFile(workbook, fileName);
}

// ✅ BỔ SUNG: assigned_to và support_id
export interface ImportedWorkRow {
  task_name: string;
  priority?: 'high' | 'medium' | 'low';
  factory_name?: string;
  progress_comment?: string;
  progress_percent?: number;
  expected_deadline?: string;
  assigned_to?: string;   // Tên PIC (backend sẽ tự convert sang ID)
  support_id?: string;    // Tên Support (backend sẽ tự convert sang ID)
}

const PRIORITY_FROM_LABEL: Record<string, 'high' | 'medium' | 'low'> = {
  high: 'high', h: 'high', cao: 'high',
  medium: 'medium', m: 'medium', 'trung bình': 'medium',
  low: 'low', l: 'low', thấp: 'low',
};

export async function parseWorksExcelFile(file: File): Promise<ImportedWorkRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rawRows
    .map((row) => {
      const taskName = String(row['Dự án'] ?? row['task_name'] ?? '').trim();
      if (!taskName) return null;

      const priorityRaw = String(row['Ưu tiên'] ?? row['priority'] ?? '').trim().toLowerCase();
      const progressRaw = row['Trạng thái (%)'] ?? row['progress_percent'];

      // ✅ Đọc cột PIC và Hỗ trợ
      const picName = String(row['PIC'] ?? row['pic'] ?? row['assigned_to'] ?? '').trim();
      const supportName = String(row['Hỗ trợ'] ?? row['hỗ trợ'] ?? row['support'] ?? row['support_id'] ?? '').trim();

      const item: ImportedWorkRow = {
        task_name: taskName,
        priority: PRIORITY_FROM_LABEL[priorityRaw],
        factory_name: String(row['Nhà máy'] ?? row['factory_name'] ?? '').trim() || undefined,
        progress_comment: String(row['Tiến độ cập nhật'] ?? row['progress_comment'] ?? '').trim() || undefined,
        progress_percent: progressRaw !== undefined && progressRaw !== '' ? Number(progressRaw) : undefined,
        expected_deadline: String(row['Hoàn thành dự kiến'] ?? row['expected_deadline'] ?? '').trim() || undefined,
        assigned_to: picName || undefined,      // ✅ Đọc được PIC
        support_id: supportName || undefined,   // ✅ Đọc được Support
      };
      return item;
    })
    .filter((item): item is ImportedWorkRow => item !== null);
}