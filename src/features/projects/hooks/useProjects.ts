import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as db from '../../../lib/db';

export function useProjects(page = 1) {
  return useQuery({ queryKey: ['projects', page], queryFn: () => db.listProjects(page) });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof db.updateProject>[1] }) =>
      db.updateProject(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
