import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getConversation,
  getConversations,
  importConversation,
  updateConversation
} from '../services/api';
import { queryKeys, queryRoots } from './keys';

type ConversationListParams = {
  source?: string;
  is_published?: boolean;
  limit?: number;
  skip?: number;
};

export function useConversations(params?: ConversationListParams) {
  return useQuery({
    queryKey: queryKeys.conversations(params),
    queryFn: () => getConversations(params)
  });
}

export function useConversation(id: string | null, params?: { limit?: number; skip?: number }) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? '', params),
    queryFn: () => getConversation(id as string, params),
    enabled: !!id
  });
}

export function useImportConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryRoots.conversations })
  });
}

type UpdateConversationVars = {
  id: string;
  payload: { title?: string; is_published?: boolean; label?: string };
};

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: UpdateConversationVars) => updateConversation(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryRoots.conversations })
  });
}
