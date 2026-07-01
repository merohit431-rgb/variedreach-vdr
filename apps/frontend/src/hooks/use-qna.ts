'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface QnaAnswer {
  id: string;
  questionId: string;
  answer: string;
  answeredBy: string;
  answerer: { id: string; firstName: string; lastName: string; role: string };
  createdAt: string;
  updatedAt: string;
}

export interface QnaQuestion {
  id: string;
  dataRoomId: string;
  question: string;
  isPrivate: boolean;
  status: 'PENDING' | 'ANSWERED' | 'REJECTED' | 'WITHDRAWN';
  askedBy: string;
  asker: { id: string; firstName: string; lastName: string; role: string };
  answers: QnaAnswer[];
  createdAt: string;
  updatedAt: string;
}

export function useQuestions(dataRoomId: string) {
  return useQuery({
    queryKey: ['data-rooms', dataRoomId, 'questions'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: QnaQuestion[] }>(
        `/data-rooms/${dataRoomId}/questions`,
      );
      return response.data.data;
    },
    enabled: Boolean(dataRoomId),
  });
}

export function useAskQuestion(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; isPrivate?: boolean }) => {
      const response = await apiClient.post<{ data: QnaQuestion }>(
        `/data-rooms/${dataRoomId}/questions`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'questions'] });
    },
  });
}

export function useUpdateQuestionStatus(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      questionId: string;
      status: 'PENDING' | 'ANSWERED' | 'REJECTED' | 'WITHDRAWN';
    }) => {
      await apiClient.patch(
        `/data-rooms/${dataRoomId}/questions/${input.questionId}/status`,
        { status: input.status },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'questions'] });
    },
  });
}

export function useAnswerQuestion(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { questionId: string; answer: string }) => {
      const response = await apiClient.post<{ data: QnaAnswer }>(
        `/data-rooms/${dataRoomId}/questions/${input.questionId}/answers`,
        { answer: input.answer },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'questions'] });
    },
  });
}

export function useDeleteQuestion(dataRoomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      await apiClient.delete(`/data-rooms/${dataRoomId}/questions/${questionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-rooms', dataRoomId, 'questions'] });
    },
  });
}
