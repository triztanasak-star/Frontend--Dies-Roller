import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as db from '../../../lib/db';

// ✅ Thêm `type` vào params
export function useWorks(params: {
  page?: number;
  limit?: number;
  project_id?: number;
  assigned_to?: number;
  type?: 'die' | 'roller';
} = {}) {
  return useQuery({
    // ✅ Thêm type vào queryKey để tránh cache lẫn giữa die và roller
    queryKey: ['works', params.type ?? 'die', params],
    queryFn: () => db.listWorks(params),
  });
}

// ✅ SỬA: tách { payload, type } thành 2 arg riêng cho db.createWork
export function useCreateWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, type }: { payload: any; type?: 'die' | 'roller' }) =>
      db.createWork(payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

// ✅ SỬA: thêm type
export function useUpdateWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, type }: { id: number; payload: any; type?: 'die' | 'roller' }) =>
      db.updateWork(id, payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

// ✅ SỬA: thêm type
export function useUpdateWorkProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, type }: { id: number; payload: any; type?: 'die' | 'roller' }) =>
      db.updateWorkProgress(id, payload, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

// ✅ SỬA: thêm type
export function useDeleteWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: number; type?: 'die' | 'roller' }) =>
      db.deleteWork(id, type ?? 'die'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['works'] }),
  });
}

export function useTaskPlans(workId: number | null) {
  return useQuery({
    queryKey: ['task-plans', workId],
    queryFn: () => db.listTaskPlans(workId as number),
    enabled: workId !== null,
  });
}

export function useCreateTaskPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, payload }: { workId: number; payload: any }) =>
      db.createTaskPlan(workId, payload),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['task-plans', variables.workId] }),
  });
}

export function useUpdateTaskPlan(workId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      db.updateTaskPlan(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-plans', workId] }),
  });
}

export function useDeleteTaskPlan(workId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.deleteTaskPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-plans', workId] }),
  });
}