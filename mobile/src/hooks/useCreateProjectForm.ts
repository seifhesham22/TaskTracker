import { useEffect, useRef, useState, type RefObject } from 'react';
import type { TextInputInstance } from 'react-native';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import {
  CREATE_PROJECT_FAILED,
  findCreatedProject,
  toCreateProjectFailure,
  validateProjectName,
  type CreateProjectErrors,
} from '../domain/createProject';

/**
 * The Create a project form. If an attempt ends without a usable answer, the project may exist all
 * the same, so trying the same name again first looks for it in the project list.
 */
export function useCreateProjectForm({
  inputRef,
  onCreated,
}: {
  inputRef: RefObject<TextInputInstance | null>;
  onCreated: (projectId: string) => void;
}) {
  const repository = useBoardRepository();
  const [name, setNameValue] = useState('');
  const [errors, setErrors] = useState<CreateProjectErrors>({});
  const [saving, setSaving] = useState(false);
  // A ref, not state, so a second tap in the same frame can't create a second project.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // The user's projects before the first attempt, and the names whose outcome is unknown.
  const before = useRef<ReadonlySet<string> | null>(null);
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

  /** The created project's ID, or what went wrong. */
  const attempt = async (trimmed: string): Promise<string | CreateProjectErrors> => {
    try {
      const outcomeUnknown = uncertainNames.current.has(trimmed);
      if (!before.current || outcomeUnknown) {
        const projects = await repository.listProjects();
        if (!before.current) before.current = new Set(projects.map((p) => p.id));
        const existing = outcomeUnknown ? findCreatedProject(projects, trimmed, before.current) : undefined;
        if (existing) return existing.id;
      }
    } catch {
      // Without the list a duplicate couldn't be ruled out, so nothing is sent.
      return { form: CREATE_PROJECT_FAILED };
    }

    try {
      return (await repository.createProject(trimmed)).id;
    } catch (error) {
      const failure = toCreateProjectFailure(error);
      if (failure.uncertain) uncertainNames.current.add(trimmed);
      return failure.errors;
    }
  };

  const submit = async () => {
    if (inFlight.current) return;
    const invalid = validateProjectName(name);
    if (invalid) {
      setErrors({ name: invalid });
      inputRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setErrors({});
    const result = await attempt(name.trim());
    inFlight.current = false;
    if (!mounted.current) return;
    setSaving(false);
    if (typeof result === 'string') {
      onCreated(result);
      return;
    }
    setErrors(result);
    if (result.name) inputRef.current?.focus();
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
