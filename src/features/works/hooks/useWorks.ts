import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as db from '../../../lib/db';

type WorkType = 'die' | 'roller';

// ✅ Thêm `type` vào params
export function useWorks(params: {
  page?: number;
  limit?: number;
  project_id?: number;
  assigned_to?: number;
  type?: WorkType;
} = {}) {
  return useQuery({
    queryKey: ['works', params.type ?? 'die', params],
    queryFn: () => db.listWorks(params),
  });
}

export function useCreateWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, type }: { payload: any; type?: WorkType }) =>
      db.createWork(payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

export function useUpdateWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, type }: { id: number; payload: any; type?: WorkType }) =>
      db.updateWork(id, payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

export function useUpdateWorkProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, type }: { id: number; payload: any; type?: WorkType }) =>
      db.updateWorkProgress(id, payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

export function useDeleteWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: number; type?: WorkType }) =>
      db.deleteWork(id, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

// ============================================================
// ✅ SỬA: Task Plans hooks - Thêm type để hỗ trợ Roller
// ============================================================

export function useTaskPlans(workId: number | null, type: WorkType = 'die') {
  return useQuery({
    queryKey: ['task-plans', workId, type], // ✅ Thêm type vào queryKey để cache riêng
    queryFn: () => db.listTaskPlans(workId as number, type), // ✅ Truyền type xuống db
    enabled: workId !== null,
  });
}

export function useCreateTaskPlan(type: WorkType = 'die') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, payload }: { workId: number; payload: any }) =>
      db.createTaskPlan(workId, payload, type), // ✅ Truyền type xuống db
    onSuccess: (_data, variables) => 
      queryClient.invalidateQueries({ queryKey: ['task-plans', variables.workId, type] }),
  });
}

export function useUpdateTaskPlan(workId: number, type: WorkType = 'die') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      db.updateTaskPlan(id, payload), // Hàm db.updateTaskPlan không nhận type
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['task-plans', workId, type] }),
  });
}

export function useDeleteTaskPlan(workId: number, type: WorkType = 'die') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.deleteTaskPlan, // Hàm db.deleteTaskPlan không nhận type
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['task-plans', workId, type] }),
  });
}