'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Lock } from 'lucide-react';
import { useQuestions, useAskQuestion, useAnswerQuestion, useUpdateQuestionStatus, useDeleteQuestion, QnaQuestion } from '@/hooks/use-qna';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';
import { useAuthStore } from '@/store/auth-store';

const STATUS_BADGE: Record<QnaQuestion['status'], string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  ANSWERED: 'bg-green-500/10 text-green-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  WITHDRAWN: 'bg-app-s2 text-app-t3',
};

const MANAGER_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'RP_LIQUIDATOR'];

function QuestionRow({
  q,
  dataRoomId,
  isManager,
  currentUserId,
}: {
  q: QnaQuestion;
  dataRoomId: string;
  isManager: boolean;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerQuestion = useAnswerQuestion(dataRoomId);
  const updateStatus = useUpdateQuestionStatus(dataRoomId);
  const deleteQuestion = useDeleteQuestion(dataRoomId);

  async function handleAnswer() {
    if (!answerText.trim()) return;
    setError(null);
    try {
      await answerQuestion.mutateAsync({ questionId: q.id, answer: answerText });
      setAnswerText('');
      setAnswering(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleStatusChange(status: QnaQuestion['status']) {
    try {
      await updateStatus.mutateAsync({ questionId: q.id, status });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const isOwn = q.askedBy === currentUserId;

  return (
    <div className="rounded-lg border border-app-border bg-app-s1">
      <div
        className="flex cursor-pointer items-start gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[q.status]}`}>
              {q.status}
            </span>
            {q.isPrivate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-app-s2 px-2 py-0.5 text-xs text-app-t3">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
            <span className="text-xs text-app-t3">
              {q.asker.firstName} {q.asker.lastName} · {new Date(q.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-app-text">{q.question}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-app-t3">{q.answers.length} {q.answers.length === 1 ? 'answer' : 'answers'}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-app-t3" /> : <ChevronDown className="h-4 w-4 text-app-t3" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-app-border px-4 pb-3 pt-3 space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}

          {q.answers.map((ans) => (
            <div key={ans.id} className="rounded-md bg-app-s2 px-3 py-2">
              <p className="text-xs text-app-t3 mb-1">
                {ans.answerer.firstName} {ans.answerer.lastName} · {new Date(ans.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-app-text whitespace-pre-wrap">{ans.answer}</p>
            </div>
          ))}

          {q.answers.length === 0 && q.status === 'PENDING' && (
            <p className="text-sm text-app-t3">No answers yet.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {isManager && q.status === 'PENDING' && !answering && (
              <button
                onClick={() => setAnswering(true)}
                className="text-xs font-medium text-app-primary hover:text-blue-300"
              >
                Answer
              </button>
            )}
            {isManager && q.status === 'PENDING' && (
              <button
                onClick={() => handleStatusChange('REJECTED')}
                className="text-xs font-medium text-red-400 hover:text-red-400"
              >
                Reject
              </button>
            )}
            {isOwn && q.status === 'PENDING' && (
              <button
                onClick={() => handleStatusChange('WITHDRAWN')}
                className="text-xs text-app-t3 hover:text-app-t2"
              >
                Withdraw
              </button>
            )}
            {(isOwn || isManager) && (
              <button
                onClick={() => deleteQuestion.mutate(q.id)}
                className="text-xs text-red-400 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>

          {answering && (
            <div className="space-y-2">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer…"
                rows={4}
                className="w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAnswer} isLoading={answerQuestion.isPending} disabled={!answerText.trim()}>
                  Post answer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAnswering(false); setAnswerText(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QnaPanel({
  dataRoomId,
  isManager,
}: {
  dataRoomId: string;
  isManager: boolean;
}) {
  const [search, setSearch] = useState('');
  const { data: questions, isLoading } = useQuestions(dataRoomId, search || undefined);
  const askQuestion = useAskQuestion(dataRoomId);
  const user = useAuthStore((s) => s.user);

  const [questionText, setQuestionText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function handleAsk() {
    if (!questionText.trim()) return;
    setError(null);
    try {
      await askQuestion.mutateAsync({ question: questionText, isPrivate });
      setQuestionText('');
      setIsPrivate(false);
      setAsking(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-app-t3" />
          <h2 className="text-sm font-semibold text-app-text">Questions &amp; Answers</h2>
          {questions && <span className="rounded-full bg-app-s2 px-2 py-0.5 text-xs text-app-t3">{questions.length}</span>}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="w-52 rounded-md border border-app-border2 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        {!asking && (
          <button
            onClick={() => setAsking(true)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 whitespace-nowrap"
          >
            Ask a question
          </button>
        )}
      </div>

      {asking && (
        <div className="rounded-lg border border-app-border bg-app-s1 p-4 space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask your due-diligence question…"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-app-t2">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-app-border2"
              />
              <Lock className="h-3.5 w-3.5 text-app-t3" />
              Private (only visible to managers)
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAsk} isLoading={askQuestion.isPending} disabled={!questionText.trim()}>
                Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAsking(false); setQuestionText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-app-t3">Loading questions…</p>
      ) : !questions || questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-app-border p-8 text-center text-sm text-app-t3">
          No questions yet. Ask one above.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              dataRoomId={dataRoomId}
              isManager={isManager}
              currentUserId={user?.id ?? ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
