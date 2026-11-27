import { useEffect, useRef, useState } from 'react';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import { planAssigneeChange, toAssigneeFailure, type AssigneeFailure } from '../domain/assignee';

export type AssigneeChangeOutcome = { status: 'saved'; removed: boolean } | { status: 'failed'; failure: AssigneeFailure };

/**
 * Saves the chosen assignee with the backend's assignTask / unassignTask, one request at a time.
 * Nothing is shown as saved until the backend has confirmed every step. After an attempt without a
 * usable answer, the next one first reads the task again and plans from what the backend has.
 */
export function useAssigneeChange({
  taskId,
  boardId,
  savedAssignees,
}: {
  taskId: string;
  boardId: string;
  /** The assignees as last read from the backend. */
  savedAssignees: readonly string[];
}) {
  const repository = useBoardRepository();
  const [saving, setSaving] = useState(false);
  // A ref, not state, so a second tap in the same frame can't send a second request.
  const inFlight = useRef(false);
  const uncertain = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const save = async (chosen: string | null): Promise<AssigneeChangeOutcome | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    try {
      let saved = savedAssignees;
      if (uncertain.current) {
        // The earlier attempt may have been saved, entirely or in part: plan from the backend.
        saved = (await repository.getTask(boardId, taskId)).task.assigneeIds;
      }
      const plan = planAssigneeChange(saved, chosen);
      if (plan.assign) await repository.assignTask(taskId, plan.assign);
      for (const userId of plan.unassign) await repository.unassignTask(taskId, userId);
      uncertain.current = false;
      return { status: 'saved', removed: chosen === null };
    } catch (error) {
      const failure = toAssigneeFailure(error);
      if (failure.kind === 'unknown') uncertain.current = true;
      return { status: 'failed', failure };
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return { saving, save };
}
