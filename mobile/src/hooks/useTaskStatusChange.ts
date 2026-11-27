import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import { VERIFY_FAILED, isActiveCategory, unfinishedBlockers, type Blocker } from '../domain/blockers';
import type { BoardColumn } from '../domain/models';
import { toMoveTaskError } from '../domain/moveTaskErrors';

export type PrerequisiteCheck =
  | { status: 'checking' }
  /** Nothing blocks the task. `hadBlockers`: it has blockers, all of them done. */
  | { status: 'clear'; hadBlockers: boolean }
  | { status: 'blocked'; blockers: Blocker[] }
  /** The blockers couldn't be read: nothing that starts the task is sent. */
  | { status: 'unverified' };

export type StatusChangeOutcome =
  | { status: 'moved' }
  | { status: 'blocked' }
  | { status: 'unverified' }
  | { status: 'failed'; message: string }
  /** The task (or access to it) is gone; the screen rechecks access. */
  | { status: 'noAccess' };

/**
 * US-17: the task's prerequisites, read from the backend each time the screen comes into view
 * (back from a blocker included) and again right before any move that starts or completes the task.
 * The backend checks once more on the move itself (TaskBlockerGuard) and names the blockers if it
 * refuses. Moves to a status that doesn't start work are sent as they are.
 */
export function useTaskStatusChange({ boardId, taskId }: { boardId: string; taskId: string }) {
  const repository = useBoardRepository();
  const [check, setCheck] = useState<PrerequisiteCheck>({ status: 'checking' });
  const [saving, setSaving] = useState(false);
  // A ref, not state, so a second tap in the same frame can't send a second move.
  const inFlight = useRef(false);
  /** A move ended without a usable answer: the next attempt first reads where the task is. */
  const uncertain = useRef<string | null>(null);
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Reads the task and its blockers now; the answer replaces whatever was shown. */
  const runCheck = useCallback(async (): Promise<PrerequisiteCheck | 'noAccess'> => {
    const request = ++latest.current;
    if (mounted.current) setCheck({ status: 'checking' });
    let next: PrerequisiteCheck | 'noAccess';
    try {
      const { task } = await repository.getTask(boardId, taskId);
      const blockers = unfinishedBlockers(task);
      next = blockers.length > 0 ? { status: 'blocked', blockers } : { status: 'clear', hadBlockers: (task.blockedBy ?? []).length > 0 };
    } catch (error) {
      next = error instanceof BoardLoadError && error.kind === 'notFound' ? 'noAccess' : { status: 'unverified' };
    }
    if (mounted.current && request === latest.current && next !== 'noAccess') setCheck(next);
    return next;
  }, [repository, boardId, taskId]);

  useFocusEffect(
    useCallback(() => {
      void runCheck();
    }, [runCheck]),
  );

  const move = async (column: BoardColumn): Promise<StatusChangeOutcome | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    try {
      if (uncertain.current === column.id) {
        // The earlier attempt may have been saved: look before sending it again.
        const { task } = await repository.getTask(boardId, taskId);
        if (task.columnId === column.id) {
          uncertain.current = null;
          return { status: 'moved' };
        }
      }
      if (isActiveCategory(column.category)) {
        // Starting or completing: the blockers as they are now, not as they were shown.
        const now = await runCheck();
        if (now === 'noAccess') return { status: 'noAccess' };
        if (now.status === 'blocked') return { status: 'blocked' };
        if (now.status !== 'clear') return { status: 'unverified' };
      }
      await repository.moveTask(taskId, column.id);
      uncertain.current = null;
      return { status: 'moved' };
    } catch (error) {
      if (error instanceof BoardLoadError) {
        return error.kind === 'notFound' ? { status: 'noAccess' } : { status: 'unverified' };
      }
      const failure = toMoveTaskError(error);
      if (failure.blockers) {
        // Refused by the backend: show the blockers as they are now (with their status and board).
        const now = await runCheck();
        if (mounted.current && (now === 'noAccess' || now.status !== 'blocked')) {
          setCheck({ status: 'blocked', blockers: failure.blockers });
        }
        return { status: 'blocked' };
      }
      if (/^Task '[^']+' was not found\.$/.test(failure.message)) return { status: 'noAccess' };
      if (failure.uncertain) {
        // No usable answer: said as the design words it, and the next attempt looks first.
        uncertain.current = column.id;
        return { status: 'failed', message: VERIFY_FAILED };
      }
      return { status: 'failed', message: failure.message };
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return { check, recheck: runCheck, move, saving };
}
