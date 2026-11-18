import { useEffect, useRef, useState } from 'react';

import {
  changesFrom,
  hasChanges,
  toEditTaskErrors,
  validateEditTask,
  valuesFromTask,
  type EditTaskErrors,
  type EditTaskValues,
} from '../domain/editTask';
import type { Task, TaskPriority, UpdateTaskChanges } from '../domain/models';

/**
 * The Edit task form: starts from the saved task, sends only what changed, and keeps every value
 * if saving fails.
 */
export function useEditTaskForm({
  task,
  updateTask,
  onSaved,
}: {
  task: Task;
  updateTask: (taskId: string, changes: UpdateTaskChanges) => Promise<Task>;
  onSaved: (task: Task) => void;
}) {
  const [saved] = useState<EditTaskValues>(() => valuesFromTask(task));
  const [values, setValues] = useState<EditTaskValues>(saved);
  const [errors, setErrors] = useState<EditTaskErrors>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
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
