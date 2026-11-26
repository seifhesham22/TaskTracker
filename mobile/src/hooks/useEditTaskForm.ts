import { useEffect, useRef, useState } from 'react';

import {
  SAVE_FAILED,
  changesFrom,
  hasChanges,
  toEditTaskErrors,
  validateEditTask,
  valuesFromTask,
  type EditTaskErrors,
  type EditTaskValues,
} from '../domain/editTask';
import { hasErrorCode } from '../api/graphql';
import type { Task, TaskPriority, UpdateTaskChanges } from '../domain/models';

/**
 * The Edit task form: starts from the saved task, sends only what changed, and keeps every value
 * if saving fails.
 */
export function useEditTaskForm({
  task,
  updateTask,
  onSaved,
  recheckAccess,
}: {
  task: Task;
  updateTask: (taskId: string, changes: UpdateTaskChanges) => Promise<Task>;
  onSaved: (task: Task) => void;
  /**
   * US-5: the backend answered the save with NOT_FOUND, which is also how it refuses someone who
   * is no longer a member. The screen reads the task again, as when the app resumes: `kept` if it
   * is still there, otherwise the screen replaces the form (`lost`, `unverified`).
   */
  recheckAccess?: () => Promise<'kept' | 'lost' | 'unverified'>;
}) {
  const [saved] = useState<EditTaskValues>(() => valuesFromTask(task));
  const [values, setValues] = useState<EditTaskValues>(saved);
  const [errors, setErrors] = useState<EditTaskErrors>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Access is being checked again after a refused save; nothing can be done meanwhile. */
  const [checkingAccess, setCheckingAccess] = useState(false);
  // A ref, not state, so a second tap in the same frame is ignored too.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const changes = changesFrom(saved, values);
  const dirty = hasChanges(changes);

  const update = (next: Partial<EditTaskValues>) => {
    const merged = { ...values, ...next };
    setValues(merged);
    // After the first Save, keep the field messages in step with what is typed or picked.
    if (checked) setErrors((e) => ({ form: e.form, ...validateEditTask(merged) }));
  };

  const save = async () => {
    if (inFlight.current) return;
    setChecked(true);
    const invalid = validateEditTask(values);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      return;
    }
    if (!dirty) return;

    inFlight.current = true;
    setSaving(true);
    setErrors({});
    try {
      const updated = await updateTask(task.id, changes);
      if (mounted.current) onSaved(updated);
    } catch (error) {
      // Validation (BAD_USER_INPUT), a role refusal (AUTH_NOT_AUTHORIZED) or no answer: say so and
      // keep the form. Only NOT_FOUND may mean the membership is gone, so only it is checked again.
      if (recheckAccess && hasErrorCode(error, 'NOT_FOUND')) {
        if (mounted.current) setCheckingAccess(true);
        const outcome = await recheckAccess();
        if (!mounted.current) return;
        setCheckingAccess(false);
        // Still there: the save failed for another reason, which may be tried again.
        if (outcome === 'kept') setErrors({ form: SAVE_FAILED });
        return;
      }
      if (mounted.current) setErrors(toEditTaskErrors(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return {
    values,
    errors,
    saving,
    checkingAccess,
    dirty,
    setTitle: (title: string) => update({ title }),
    setDescription: (description: string) => update({ description }),
    setPriority: (priority: TaskPriority | null) => update({ priority }),
    setStartDate: (startDate: string | null) => update({ startDate }),
    setDueDate: (dueDate: string | null) => update({ dueDate }),
    /** For press handlers, which must not receive a promise. */
    save: () => {
      void save();
    },
  };
}
