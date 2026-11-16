import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ColumnCategory, TaskDependencyRelationship, type TaskItem } from '../../domain/models';
import {
  taskDependencyValidator,
  type CircularDependencyInfo,
} from '../../domain/validators/TaskDependencyValidator';
import './TaskDependenciesModal.css';

export interface TaskDependenciesModalProps {
  readonly task: TaskItem | null;
  readonly allTasks: readonly TaskItem[];
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onAddDependency: (blockingTaskId: string, blockedTaskId: string) => Promise<boolean>;
  readonly onSearchTasks?: (query: string) => Promise<TaskItem[]>;
}

function formatStatus(status?: ColumnCategory): string {
  switch (status) {
    case ColumnCategory.Backlog:
      return 'Backlog';
    case ColumnCategory.ToDo:
      return 'To do';
    case ColumnCategory.InProgress:
      return 'In progress';
    case ColumnCategory.Done:
      return 'Done';
    case ColumnCategory.Cancelled:
      return 'Cancelled';
    default:
      return 'To do';
  }
}

export function TaskDependenciesModal({
  task,
  allTasks,
  projectName,
  isOpen,
  onClose,
  onAddDependency,
  onSearchTasks,
}: TaskDependenciesModalProps) {
  const headingId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [relationship, setRelationship] = useState<TaskDependencyRelationship>(
    TaskDependencyRelationship.BlockedBy
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [candidateTasks, setCandidateTasks] = useState<readonly TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<CircularDependencyInfo | null>(null);
  const [rejectedTask, setRejectedTask] = useState<TaskItem | null>(null);
  const [isCorrectingRetry, setIsCorrectingRetry] = useState(false);
  const [lastAddedDependency, setLastAddedDependency] = useState<{
    predecessor: { readableId: string; title: string };
    dependent: { readableId: string; title: string };
  } | null>(null);

  // Existing dependencies from task
  const blockedByTasks = useMemo(() => {
    return task?.blockedBy ?? [];
  }, [task?.blockedBy]);

  const blocksTasks = useMemo(() => {
    return task?.blocks ?? [];
  }, [task?.blocks]);

  // Candidate pool excluding current task and already linked tasks
  const existingDependencyIds = useMemo(() => {
    const ids = new Set<string>();
    blockedByTasks.forEach((b) => ids.add(b.id));
    blocksTasks.forEach((b) => ids.add(b.id));
    if (rejectedTask) {
      ids.add(rejectedTask.id);
    }
    return ids;
  }, [blockedByTasks, blocksTasks, rejectedTask]);

  // Search logic
  const performSearch = useCallback(
    async (query: string, excludeTaskId?: string) => {
      if (!task) return;
      setIsSearching(true);
      try {
        const excluded = new Set(existingDependencyIds);
        if (excludeTaskId) excluded.add(excludeTaskId);
        if (rejectedTask) excluded.add(rejectedTask.id);

        if (onSearchTasks) {
          const results = await onSearchTasks(query);
          const filtered = results.filter(
            (t) => t.id !== task.id && !excluded.has(t.id)
          );
          setCandidateTasks(filtered);
        } else {
          const trimmed = query.trim().toLowerCase();
          const filtered = allTasks.filter((t) => {
            if (t.id === task.id || excluded.has(t.id)) return false;
            if (!trimmed) return true;
            return (
              t.title.toLowerCase().includes(trimmed) ||
              t.readableId.toLowerCase().includes(trimmed)
            );
          });
          setCandidateTasks(filtered);
        }
      } catch {
        setCandidateTasks([]);
      } finally {
        setIsSearching(false);
      }
    },
    [task, onSearchTasks, existingDependencyIds, rejectedTask, allTasks]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const selectedCandidate = useMemo(() => {
    if (!selectedTaskId) return null;
    return (
      candidateTasks.find((t) => t.id === selectedTaskId) ||
      allTasks.find((t) => t.id === selectedTaskId) ||
      null
    );
  }, [selectedTaskId, candidateTasks, allTasks]);

  const currentDirectionDescription = useMemo(() => {
    if (!task || !selectedCandidate) return null;
    if (relationship === TaskDependencyRelationship.BlockedBy) {
      return taskDependencyValidator.formatDirectionDescription(
        { readableId: selectedCandidate.readableId, title: selectedCandidate.title },
        { readableId: task.readableId, title: task.title }
      );
    } else {
      return taskDependencyValidator.formatDirectionDescription(
        { readableId: task.readableId, title: task.title },
        { readableId: selectedCandidate.readableId, title: selectedCandidate.title }
      );
    }
  }, [task, selectedCandidate, relationship]);

  if (!isOpen || !task) {
    return null;
  }

  const handleStartAdd = () => {
    setIsAdding(true);
    setShowSuccessBanner(false);
    setRequestError(null);
    setCycleError(null);
    setRejectedTask(null);
    setIsCorrectingRetry(false);
    setValidationError(null);
    setSelectedTaskId(null);
    setSearchQuery('');
    performSearch('');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setValidationError(null);
    setRequestError(null);
    setCycleError(null);
    setIsCorrectingRetry(false);
    setSelectedTaskId(null);
  };

  const handleSelectCandidate = (candidateId: string) => {
    setSelectedTaskId(candidateId);
    setValidationError(null);
    setRequestError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setRequestError(null);

    const validation = taskDependencyValidator.validateSelection(
      task.id,
      selectedTaskId,
      relationship === TaskDependencyRelationship.BlockedBy ? blockedByTasks : blocksTasks
    );

    if (!validation.isValid) {
      setValidationError(validation.error || 'Select a task to continue.');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      return;
    }

    if (!selectedCandidate) {
      setValidationError('Select a task to continue.');
      return;
    }

    setIsSubmitting(true);

    const blockingTaskId =
      relationship === TaskDependencyRelationship.BlockedBy
        ? selectedCandidate.id
        : task.id;
    const blockedTaskId =
      relationship === TaskDependencyRelationship.BlockedBy
        ? task.id
        : selectedCandidate.id;

    try {
      const ok = await onAddDependency(blockingTaskId, blockedTaskId);
      if (ok) {
        setLastAddedDependency({
          predecessor:
            relationship === TaskDependencyRelationship.BlockedBy
              ? { readableId: selectedCandidate.readableId, title: selectedCandidate.title }
              : { readableId: task.readableId, title: task.title },
          dependent:
            relationship === TaskDependencyRelationship.BlockedBy
              ? { readableId: task.readableId, title: task.title }
              : { readableId: selectedCandidate.readableId, title: selectedCandidate.title },
        });
        setShowSuccessBanner(true);
        setIsAdding(false);
        setCycleError(null);
        setIsCorrectingRetry(false);
      } else {
        setRequestError('We couldn’t add the dependency. Try again.');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'We couldn’t add the dependency. Try again.';

      const predecessorKey =
        relationship === TaskDependencyRelationship.BlockedBy
          ? selectedCandidate.readableId
          : task.readableId;
      const dependentKey =
        relationship === TaskDependencyRelationship.BlockedBy
          ? task.readableId
          : selectedCandidate.readableId;

      const parsedCycle = taskDependencyValidator.parseCycleError(
        message,
        predecessorKey,
        dependentKey
      );

      if (parsedCycle) {
        setCycleError(parsedCycle);
        setRejectedTask(selectedCandidate);
        setIsCorrectingRetry(false);
        setRequestError(null);
      } else {
        setCycleError(null);
        setRequestError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbText = `${projectName || 'PROJECT'} / ${task.readableId}`;

  return (
    <div
      className="dependencies-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="dependencies-modal-container">
        {/* Header */}
        <div className="dependencies-modal-header">
          <button
            type="button"
            className="dependencies-close-button"
            aria-label="Close"
            data-testid="dependencies-close-btn"
            onClick={onClose}
          >
            ×
          </button>
          <p className="dependencies-breadcrumb">{breadcrumbText}</p>
          <h2 id={headingId} className="dependencies-modal-title">
            Task dependencies
          </h2>
          <p className="dependencies-modal-subtitle">{task.title}</p>
        </div>

        {/* State 06: Success banner */}
        {showSuccessBanner && (
          <div className="dependencies-banner-success" role="status">
            ✓ Dependency added
          </div>
        )}

        {/* State 07: Error banner */}
        {requestError && (
          <div className="dependencies-banner-error" role="alert">
            {requestError}
          </div>
        )}

        {/* Form mode (States 02, 03, 04, 05, 07) or Cycle rejected (State 01) */}
        {isAdding && cycleError && !isCorrectingRetry && rejectedTask ? (
          <div className="dependency-form">
            <div className="dependencies-current-task-bar">
              CURRENT TASK · {task.readableId} {task.title}
            </div>

            <div className="dependency-form-group">
              <label htmlFor="dep-relationship-select" className="dependency-form-label">
                Relationship
              </label>
              <select
                id="dep-relationship-select"
                className="dependency-form-select"
                value={relationship}
                disabled
              >
                <option value={TaskDependencyRelationship.BlockedBy}>Blocked by ⌄</option>
                <option value={TaskDependencyRelationship.Blocks}>Blocks ⌄</option>
              </select>
            </div>

            <div className="dependency-card">
              <span className="dependency-card-header">
                {rejectedTask.readableId} · {formatStatus(rejectedTask.status)}
              </span>
              <span className="dependency-card-title">{rejectedTask.title}</span>
            </div>

            <div className="dependency-cycle-banner" role="alert" data-testid="cycle-error-banner">
              <p className="dependency-cycle-title">{cycleError.title}</p>
              <p className="dependency-cycle-desc">{cycleError.message}</p>
            </div>

            <div className="dependency-cycle-path-box" data-testid="cycle-path-box">
              <p className="dependency-cycle-path-line">Existing: {cycleError.existingPath}</p>
              <p className="dependency-cycle-path-line">Rejected: {cycleError.rejectedLink}</p>
            </div>

            <div className="dependencies-modal-actions">
              <button
                type="button"
                className="dependencies-btn-primary"
                onClick={() => {
                  setIsCorrectingRetry(true);
                  setSelectedTaskId(null);
                  setSearchQuery('');
                  performSearch('', rejectedTask?.id);
                }}
                data-testid="choose-another-task-btn"
              >
                Choose another task
              </button>
              <button
                type="button"
                className="dependencies-btn-secondary"
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isAdding ? (
          <form className="dependency-form" onSubmit={handleSubmit} noValidate>
            <div className="dependencies-current-task-bar">
              CURRENT TASK · {task.readableId} {task.title}
            </div>

            <div className="dependency-form-group">
              <label htmlFor="dep-relationship-select" className="dependency-form-label">
                Relationship
              </label>
              <select
                id="dep-relationship-select"
                className="dependency-form-select"
                value={relationship}
                disabled={isSubmitting}
                onChange={(e) => setRelationship(e.target.value as TaskDependencyRelationship)}
              >
                <option value={TaskDependencyRelationship.BlockedBy}>Blocked by ⌄</option>
                <option value={TaskDependencyRelationship.Blocks}>Blocks ⌄</option>
              </select>
              <p className="dependency-form-hint">
                {relationship === TaskDependencyRelationship.BlockedBy
                  ? `The selected task must finish before ${task.readableId}.`
                  : `${task.readableId} must finish before the selected task.`}
              </p>
            </div>

            <div className="dependency-form-group">
              <label htmlFor="dep-search-input" className="dependency-form-label">
                {isCorrectingRetry ? 'Choose another task' : 'Find a task *'}
              </label>
              <input
                id="dep-search-input"
                ref={searchInputRef}
                type="text"
                className={`dependency-form-input ${validationError ? 'input-error' : ''}`}
                placeholder={isCorrectingRetry ? 'Search tasks…' : 'Search by title or task key'}
                value={searchQuery}
                disabled={isSubmitting}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setValidationError(null);
                  setIsSearching(true);
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                  searchTimeoutRef.current = setTimeout(() => {
                    performSearch(val);
                  }, 150);
                }}
              />

              {/* State 03: Loading indicator */}
              {isSearching && (
                <div className="dependencies-loading-text">Loading matching tasks…</div>
              )}

              {/* State 04: Validation error */}
              {validationError && (
                <p className="dependency-field-error" role="alert">
                  {validationError}
                </p>
              )}

              {/* Candidates list */}
              {!isSearching && candidateTasks.length > 0 && (
                <div className="dependency-candidates-list" role="listbox">
                  {candidateTasks.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      role="option"
                      data-testid={`dependency-candidate-${candidate.id}`}
                      aria-selected={selectedTaskId === candidate.id}
                      className={`dependency-candidate-item ${
                        selectedTaskId === candidate.id ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectCandidate(candidate.id)}
                    >
                      <span className="candidate-item-meta">
                        {candidate.readableId} · {formatStatus(candidate.status)}
                      </span>
                      <span className="candidate-item-title">{candidate.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected preview & direction summary */}
            {selectedCandidate && currentDirectionDescription && (
              <div className="dependency-direction-box">
                {currentDirectionDescription}
              </div>
            )}

            {/* Form actions */}
            <div className="dependencies-modal-actions">
              <button
                type="submit"
                className="dependencies-btn-primary"
                disabled={isSubmitting || isSearching}
              >
                {isSubmitting
                  ? '◌ Adding…'
                  : isSearching
                  ? 'Loading…'
                  : isCorrectingRetry && selectedCandidate
                  ? `Retry with ${selectedCandidate.readableId}`
                  : 'Add dependency'}
              </button>
              <button
                type="button"
                className="dependencies-btn-secondary"
                disabled={isSubmitting}
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* View mode (States 01 & 06) */
          <div className="dependencies-list">
            <div className="dependencies-badge-row">
              <span className="dependencies-badge">
                Blocked by · {blockedByTasks.length} {blockedByTasks.length === 1 ? 'task' : 'tasks'}
              </span>
              {blocksTasks.length > 0 && (
                <span className="dependencies-badge">
                  Blocks · {blocksTasks.length} {blocksTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              )}
            </div>

            {/* Existing BlockedBy cards */}
            {blockedByTasks.map((dep) => (
              <div key={dep.id} className="dependency-card">
                <span className="dependency-card-header">
                  {dep.readableId} · {formatStatus(dep.status)}
                </span>
                <span className="dependency-card-title">{dep.title}</span>
                <div className="dependency-direction-box">
                  {dep.readableId} · {dep.title} ↓ must happen before {task.readableId}
                </div>
              </div>
            ))}

            {/* Existing Blocks cards */}
            {blocksTasks.map((dep) => (
              <div key={dep.id} className="dependency-card">
                <span className="dependency-card-header">
                  {dep.readableId} · {formatStatus(dep.status)}
                </span>
                <span className="dependency-card-title">{dep.title}</span>
                <div className="dependency-direction-box">
                  {task.readableId} · {task.title} ↓ must happen before {dep.readableId}
                </div>
              </div>
            ))}

            {/* Direction summary for newly added dependency if in State 06 */}
            {showSuccessBanner && lastAddedDependency && (
              <div className="dependency-direction-box">
                {lastAddedDependency.predecessor.readableId} ·{' '}
                {lastAddedDependency.predecessor.title} ↓ must happen before{' '}
                {lastAddedDependency.dependent.readableId}
              </div>
            )}

            {showSuccessBanner && rejectedTask && (
              <p className="dependency-cycle-rejected-notice" data-testid="cycle-rejected-notice">
                The rejected {rejectedTask.readableId} link was never added.
              </p>
            )}

            <div className="dependencies-modal-actions">
              <button
                type="button"
                className="dependencies-btn-primary"
                onClick={handleStartAdd}
              >
                {showSuccessBanner ? 'Add another dependency' : 'Add dependency'}
              </button>
              {showSuccessBanner && (
                <button
                  type="button"
                  className="dependencies-btn-secondary"
                  data-testid="dependencies-bottom-close-btn"
                  onClick={onClose}
                >
                  {rejectedTask ? 'Back to task' : 'Close'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
