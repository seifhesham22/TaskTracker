import { useEffect, useRef, useState, type RefObject } from 'react';
import type { TextInputInstance } from 'react-native';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import {
  CREATE_BOARD_FAILED,
  sameBoardName,
  toCreateBoardFailure,
  validateBoardName,
} from '../domain/createBoard';

export interface CreateBoardErrors {
  /** Under the field: empty, too long, or already used in this project. */
  name?: string;
  /** Above the actions; the name is kept. */
  form?: string;
}

/**
 * The Create a board form. One request at a time. If an attempt ends without a usable answer, the
 * board may exist all the same, so trying again first reads the project's boards and takes a board
 * of that name that wasn't there before, instead of sending the name a second time.
 */
export function useCreateBoardForm({
  projectId,
  boardIdsBefore,
  inputRef,
  onCreated,
  onNotOwner,
  onNoAccess,
}: {
  projectId: string;
  /** The project's boards when the form opened. */
  boardIdsBefore: readonly string[];
  inputRef: RefObject<TextInputInstance | null>;
  onCreated: (boardId: string) => void;
  onNotOwner: () => void;
  onNoAccess: () => void;
}) {
  const repository = useBoardRepository();
  const [name, setNameValue] = useState('');
  const [errors, setErrors] = useState<CreateBoardErrors>({});
  const [saving, setSaving] = useState(false);
  // A ref, not state, so a second tap in the same frame can't create a second board.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [before] = useState(() => new Set(boardIdsBefore.map((id) => id.toLowerCase())));
  /** Names whose last attempt ended without a usable answer. */
  const uncertainNames = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setName = (value: string) => {
    setNameValue(value);
    setErrors((e) => (e.name ? { ...e, name: undefined } : e));
  };

  type Outcome = { boardId: string } | { errors: CreateBoardErrors } | { notOwner: true } | { noAccess: true };

  const attempt = async (trimmed: string): Promise<Outcome> => {
    const key = trimmed.toLowerCase();
    if (uncertainNames.current.has(key)) {
      // The earlier attempt may have been saved: look before sending the name again.
      try {
        const project = await repository.getProject(projectId);
        const created = project.boards.find((b) => sameBoardName(b.name, trimmed) && !before.has(b.id.toLowerCase()));
        if (created) return { boardId: created.id };
      } catch {
        return { errors: { form: CREATE_BOARD_FAILED } };
      }
    }
    try {
      return { boardId: (await repository.createBoard(projectId, trimmed)).id };
    } catch (error) {
      const failure = toCreateBoardFailure(error);
      switch (failure.kind) {
        case 'name':
          return { errors: { name: failure.message } };
        case 'notOwner':
          return { notOwner: true };
        case 'noAccess':
          return { noAccess: true };
        case 'form':
          return { errors: { form: failure.message } };
        default:
          uncertainNames.current.add(key);
          return { errors: { form: CREATE_BOARD_FAILED } };
      }
    }
  };

  const submit = async () => {
    if (inFlight.current) return;
    const invalid = validateBoardName(name);
    if (invalid) {
      setErrors({ name: invalid });
      inputRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setErrors({});
    const outcome = await attempt(name.trim());
    inFlight.current = false;
    if (!mounted.current) return;
    setSaving(false);
    if ('boardId' in outcome) onCreated(outcome.boardId);
    else if ('notOwner' in outcome) onNotOwner();
    else if ('noAccess' in outcome) onNoAccess();
    else {
      setErrors(outcome.errors);
      if (outcome.errors.name) inputRef.current?.focus();
    }
  };

  return {
    name,
    setName,
    errors,
    saving,
    /** For press and keyboard handlers, which must not receive a promise. */
    submit: () => {
      void submit();
    },
  };
}
