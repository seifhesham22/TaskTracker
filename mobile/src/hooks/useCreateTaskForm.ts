import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, type ScrollViewInstance, type TextInputInstance } from 'react-native';

import {
  CreateTaskError,
  toCreateTaskFailure,
  validateTitle,
  type CreateTaskField,
  type GeneralFormError,
} from '../domain/createTaskErrors';
import { dateKeyToIso } from '../domain/format';
import type { CreateTaskInput, Task, TaskPriority } from '../domain/models';

export type FormField = 'title' | 'description' | 'assigneeId' | 'priority' | 'dueDate';

/** Visual order of the fields, used to find the first field with an error. */
export const FIELD_ORDER: FormField[] = ['title', 'description', 'assigneeId', 'priority', 'dueDate'];

/** Space kept above a field when scrolling to it, so its label stays visible. */
export const SCROLL_MARGIN = 16;

export interface CreateTaskValues {
  title: string;
  description: string;
  assigneeId: string | null;
  priority: TaskPriority | null;
  /** "YYYY-MM-DD" */
  dueDate: string | null;
}

const EMPTY_VALUES: CreateTaskValues = { title: '', description: '', assigneeId: null, priority: null, dueDate: null };

export interface UseCreateTaskFormOptions {
  boardId: string;
  columnId?: string;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  onCreated: (task: Task) => void;
  onBoardNotFound: (message: string) => void;
}

export function useCreateTaskForm({ boardId, columnId, createTask, onCreated, onBoardNotFound }: UseCreateTaskFormOptions) {
  const [values, setValues] = useState<CreateTaskValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<CreateTaskField, string>>>({});
  const [generalError, setGeneralError] = useState<GeneralFormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Title is checked on submit first, then on every change once its error has been shown.
  const [titleChecked, setTitleChecked] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const titleInputRef = useRef<TextInputInstance>(null);
  const fieldY = useRef<Partial<Record<FormField, number>>>({});
  const scrollTarget = useRef<FormField | 'top' | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const scrollToTarget = useCallback(() => {
    const target = scrollTarget.current;
    if (!target) return;
    if (target === 'top') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const y = fieldY.current[target];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true });
  }, []);

  // Runs after the errors are on screen. The target is kept until the user scrolls, so a field
  // that moves when the layout changes (an alert disappearing above it) is scrolled to again.
  useEffect(() => {
    const target = scrollTarget.current;
    if (!target) return;
    if (target === 'title') {
      titleInputRef.current?.focus();
    } else {
      Keyboard.dismiss();
    }
    scrollToTarget();
  }, [scrollRequest, scrollToTarget]);

  const requestScroll = (target: FormField | 'top') => {
    scrollTarget.current = target;
    setScrollRequest((n) => n + 1);
  };

  const onFieldLayout = useCallback(
    (field: FormField) => (event: LayoutChangeEvent) => {
      fieldY.current[field] = event.nativeEvent.layout.y;
      if (scrollTarget.current === field) scrollToTarget();
    },
    [scrollToTarget],
  );

  const onScrollBeginDrag = useCallback(() => {
    scrollTarget.current = null;
  }, []);

  const setTitle = (title: string) => {
    setValues((v) => ({ ...v, title }));
    if (titleChecked) {
      const error = validateTitle(title);
      setErrors((e) => ({ ...e, title: error ?? undefined }));
    }
  };
  const setDescription = (description: string) => setValues((v) => ({ ...v, description }));
  const setAssigneeId = (assigneeId: string | null) => {
    setValues((v) => ({ ...v, assigneeId }));
    // The server's assignee error is about the previous choice.
    setErrors((e) => ({ ...e, assigneeId: undefined }));
  };
  const setPriority = (priority: TaskPriority | null) => setValues((v) => ({ ...v, priority }));
  const setDueDate = (dueDate: string | null) => setValues((v) => ({ ...v, dueDate }));

  const isDirty =
    values.title !== '' ||
    values.description !== '' ||
    values.assigneeId !== null ||
    values.priority !== null ||
    values.dueDate !== null;

  const showFieldErrors = (fieldErrors: Partial<Record<CreateTaskField, string>>) => {
    setErrors(fieldErrors);
    const first = FIELD_ORDER.find((f) => fieldErrors[f as CreateTaskField]);
    if (first) requestScroll(first);
  };

  const submit = async () => {
    if (inFlight.current) return;

    const titleError = validateTitle(values.title);
    setTitleChecked(true);
    if (titleError) {
      setGeneralError(null);
      showFieldErrors({ ...errors, title: titleError });
      return;
    }

    const input: CreateTaskInput = {
      boardId,
      columnId,
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      assigneeId: values.assigneeId ?? undefined,
      priority: values.priority ?? undefined,
      dueDate: values.dueDate ? dateKeyToIso(values.dueDate) : undefined,
    };

    inFlight.current = true;
    setSubmitting(true);
    setGeneralError(null);
    setErrors({});
    try {
      const task = await createTask(input);
      if (mounted.current) onCreated(task);
    } catch (error) {
      if (!mounted.current) return;
      const failure = error instanceof CreateTaskError ? error.failure : toCreateTaskFailure(error, input);
      if (failure.kind === 'boardNotFound') {
        onBoardNotFound(failure.message);
      } else if (failure.kind === 'fields') {
        showFieldErrors(failure.fields);
      } else {
        setGeneralError(failure.error);
        requestScroll('top');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return {
    form: {
      values,
      errors,
      generalError,
      submitting,
      isDirty,
      setTitle,
      setDescription,
      setAssigneeId,
      setPriority,
      setDueDate,
      submit,
      onFieldLayout,
      onScrollBeginDrag,
    },
    // Kept out of `form` so components can read the form's values during render.
    scrollRef,
    titleInputRef,
  };
}

export type CreateTaskFormController = ReturnType<typeof useCreateTaskForm>['form'];
