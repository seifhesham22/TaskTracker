import { useId, useMemo, useState } from 'react';
import type { IncompleteSubtaskDto } from '../../api';
import {
  ColumnCategory,
  TaskPriority,
  type BoardColumnModel,
  type ProjectMemberModel,
  type TaskItem,
} from '../../domain/models';
import { StatusIcon } from './StatusIcon';
import './ParentTaskDetailsModal.css';

export interface BlockedIncompleteSubtasksInfo {
  readonly taskId: string;
  readonly message: string;
  readonly incompleteSubtasks: readonly IncompleteSubtaskDto[];
}

export interface ParentTaskDetailsModalProps {
  readonly task: TaskItem | null;
  readonly allTasks: readonly TaskItem[];
  readonly columns?: readonly BoardColumnModel[];
  readonly members?: readonly ProjectMemberModel[];
  readonly projectName?: string | null;
  readonly isOpen: boolean;
  readonly isCompleting?: boolean;
  readonly showSuccessBanner?: boolean;
  readonly justUpdated?: boolean;
  readonly blockedError?: BlockedIncompleteSubtasksInfo | null;
  readonly onClose: () => void;
  readonly onMarkComplete: (taskId: string) => Promise<boolean>;
  readonly onMoveSubtask?: (subtaskId: string, targetColumnId: string) => Promise<boolean>;
  readonly onMoveTask?: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly onAddSubtask?: () => void;
  readonly onEdit?: () => void;
  readonly onManageDependencies?: () => void;
  readonly onClearBlockedError?: () => void;
}

export function ParentTaskDetailsModal({
  task,
  allTasks,
  columns,
  members,
  projectName,
  isOpen,
  isCompleting = false,
  showSuccessBanner = false,
  justUpdated = false,
  blockedError,
  onClose,
  onMarkComplete,
  onMoveSubtask,
  onMoveTask,
  onAddSubtask,
  onEdit,
  onManageDependencies,
  onClearBlockedError,
}: ParentTaskDetailsModalProps) {
  const headingId = useId();
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const [localCompleting, setLocalCompleting] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(false);
  const [dismissedBlocked, setDismissedBlocked] = useState(false);

  const subtasks = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => t.parentTaskId === task.id);
  }, [task, allTasks]);

  const incompleteSubtasks = useMemo(() => {
    return subtasks.filter((t) => t.status !== ColumnCategory.Done);
  }, [subtasks]);

  const completedSubtasks = useMemo(() => {
    return subtasks.filter((t) => t.status === ColumnCategory.Done);
  }, [subtasks]);

  if (!isOpen || !task) {
    return null;
  }

  const isBlocked =
    !dismissedBlocked &&
    Boolean(blockedError && blockedError.taskId === task.id && blockedError.incompleteSubtasks.length > 0);

  const blockedCount = blockedError?.incompleteSubtasks.length ?? incompleteSubtasks.length;

  const isParentDone = task.status === ColumnCategory.Done || localCompleted;
  const allSubtasksDone = subtasks.length > 0 && incompleteSubtasks.length === 0;

  const doneColumn = columns?.find((c) => c.category === ColumnCategory.Done);

  const focusedSubtask = focusedSubtaskId
    ? allTasks.find((t) => t.id === focusedSubtaskId) || null
    : null;

  const handleCompleteParent = async () => {
    setLocalCompleting(true);
    setDismissedBlocked(false);
    try {
      const ok = await onMarkComplete(task.id);
      if (ok) {
        setLocalCompleted(true);
      }
    } finally {
      setLocalCompleting(false);
    }
  };

  const handleCompleteSubtask = async (subtaskId: string) => {
    const moveFn = onMoveSubtask || onMoveTask;
    if (!doneColumn || !moveFn) return;
    await moveFn(subtaskId, doneColumn.id);
  };

  const handleToggleSubtask = async (sub: TaskItem) => {
    const moveFn = onMoveSubtask || onMoveTask;
    if (!moveFn || !columns || columns.length === 0) return;
    const isDone = sub.status === ColumnCategory.Done;
    if (isDone) {
      const targetCol =
        columns.find((c) => c.category === ColumnCategory.ToDo) ||
        columns.find((c) => c.category === ColumnCategory.Backlog) ||
        columns[0];
      if (targetCol && targetCol.id !== sub.columnId) {
        await moveFn(sub.id, targetCol.id);
      }
    } else {
      const targetCol = columns.find((c) => c.category === ColumnCategory.Done);
      if (targetCol && targetCol.id !== sub.columnId) {
        await moveFn(sub.id, targetCol.id);
      }
    }
  };

  const handleBackToTask = () => {
    setDismissedBlocked(true);
    if (onClearBlockedError) {
      onClearBlockedError();
    }
  };

  const assigneeNames = getAssigneeNames(task, members);
  const displayProject = projectName || 'Project';

  return (
    <div
      className="parent-details-backdrop task-details-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-heading"
      data-testid="parent-task-details-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="parent-details-dialog task-details-dialog" data-testid="task-details-dialog">
        <button
          type="button"
          className="parent-details-close task-details-close"
          aria-label="Close"
          data-testid="close-parent-task-details"
          onClick={() => {
            setFocusedSubtaskId(null);
            setDismissedBlocked(false);
            onClose();
          }}
        >
          <span aria-hidden="true">×</span>
        </button>

        {focusedSubtask ? (
          /* Focused Subtask View */
          <div className="parent-details-subtask-view" data-testid={`subtask-detail-view-${focusedSubtask.id}`}>
            <button
              type="button"
              className="parent-details-back-link"
              onClick={() => setFocusedSubtaskId(null)}
              data-testid="back-to-parent-btn"
            >
              ← Back to {task.readableId}
            </button>

            <div className="parent-details-header task-details-header">
              <span className="parent-details-breadcrumb task-details-eyebrow">
                Subtask · {focusedSubtask.readableId}
              </span>
              <div className="parent-details-title-row">
                <h3 className="parent-details-title">{focusedSubtask.title}</h3>
                <span
                  className={`parent-details-badge ${
                    focusedSubtask.status === ColumnCategory.Done
                      ? 'parent-details-badge--done'
                      : 'parent-details-badge--inprogress'
                  }`}
                  data-testid="subtask-status-badge"
                >
                  <StatusIcon category={focusedSubtask.status} />
                  <span>{focusedSubtask.columnName || focusedSubtask.status}</span>
                </span>
              </div>
            </div>

            <div className="parent-details-actions task-details-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setFocusedSubtaskId(null)}
              >
                Back to parent task
              </button>
              {focusedSubtask.status !== ColumnCategory.Done && (
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => handleCompleteSubtask(focusedSubtask.id)}
                  data-testid="complete-subtask-btn"
                >
                  ✓ Complete this subtask
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Unified Task Details & Subtasks View */
          <>
            <div className="parent-details-header task-details-header">
              <div className="task-details-header-info">
                <span className="parent-details-breadcrumb task-details-eyebrow">
                  {displayProject} / {task.readableId}
                </span>
                <h3 id="task-details-heading" className="task-details-title-heading">
                  Task details
                </h3>
              </div>
            </div>

            <div className="parent-details-title-row">
              <h2 id={headingId} className="parent-details-title task-details-task-title">
                {task.title}
              </h2>
              <span
                className={`parent-details-badge ${
                  isParentDone
                    ? 'parent-details-badge--done'
                    : task.status === ColumnCategory.InProgress
                    ? 'parent-details-badge--inprogress'
                    : 'parent-details-badge--default'
                }`}
                data-testid="parent-status-badge"
              >
                <StatusIcon category={task.status} />
                <span>{task.status === ColumnCategory.Done ? 'Done' : task.columnName || 'In progress'}</span>
              </span>
            </div>

            {/* Success Banner when task updated */}
            {justUpdated && (
              <div
                className="task-details-success-banner"
                role="status"
                aria-live="polite"
                data-testid="task-updated-banner"
              >
                ✓ Task updated
              </div>
            )}

            {/* Success Banner when subtask created */}
            {showSuccessBanner && (
              <div
                className="parent-details-banner parent-details-banner--success"
                role="status"
                data-testid="subtask-created-banner"
              >
                <p className="parent-details-banner-desc">
                  ✓ Subtask created
                </p>
              </div>
            )}

            {/* Blocked banner when completion rejected */}
            {isBlocked && (
              <div
                className="parent-details-banner parent-details-banner--blocked"
                role="alert"
                data-testid="parent-completion-blocked-banner"
              >
                <h4 className="parent-details-banner-title">
                  {blockedCount === 1
                    ? 'Complete 1 subtask first'
                    : `Complete ${blockedCount} subtasks first`}
                </h4>
                <p className="parent-details-banner-desc">
                  This parent task can’t be completed while its subtasks are still in progress.
                </p>
                <p className="parent-details-banner-detail" data-testid="parent-completion-error-message">
                  {blockedError?.message || `${task.readableId} can't be completed while subtasks are not done.`}
                </p>
              </div>
            )}

            {/* Ready banner when all subtasks complete */}
            {!isBlocked && allSubtasksDone && !isParentDone && (
              <div
                className="parent-details-banner parent-details-banner--ready"
                role="status"
                data-testid="all-subtasks-complete-banner"
              >
                <p className="parent-details-banner-desc">
                  All subtasks are complete.
                </p>
              </div>
            )}

            {/* Completed banner when parent task is done */}
            {isParentDone && (
              <div
                className="parent-details-banner parent-details-banner--ready"
                role="status"
                data-testid="task-completed-banner"
              >
                <p className="parent-details-banner-desc">
                  ✓ Task completed
                </p>
              </div>
            )}

            <div className="parent-details-body task-details-body">
              <p className="parent-details-desc task-details-task-desc">
                {task.description || 'No description provided.'}
              </p>

              <div className="task-details-fields">
                <div className="task-details-row">
                  <span>Priority: {formatPriority(task.priority)}</span>
                </div>
                {task.startDate && (
                  <div className="task-details-row">
                    <span>Start date: {formatDisplayDate(task.startDate)}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="task-details-row">
                    <span>Due date: {formatDisplayDate(task.dueDate)}</span>
                  </div>
                )}
                {assigneeNames && (
                  <div className="task-details-row">
                    <span>Assignee: {assigneeNames}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dependencies Section */}
            {Boolean(
              (task.blockedBy && task.blockedBy.length > 0) ||
                (task.blocks && task.blocks.length > 0)
            ) && (
              <section
                className="parent-details-dependencies-section"
                aria-label="Dependencies"
                data-testid="task-dependencies-section"
              >
                <div className="parent-details-subtasks-header">
                  <h3 className="parent-details-subtasks-heading">Task dependencies</h3>
                  <span className="parent-details-subtasks-count">
                    {task.blockedBy && task.blockedBy.length > 0
                      ? `Blocked by · ${task.blockedBy.length} ${
                          task.blockedBy.length === 1 ? 'task' : 'tasks'
                        }`
                      : `Blocks · ${task.blocks?.length || 0} ${
                          task.blocks?.length === 1 ? 'task' : 'tasks'
                        }`}
                  </span>
                </div>
                <div className="parent-details-dependencies-list">
                  {task.blockedBy?.map((dep) => (
                    <div
                      key={dep.id}
                      className="dependency-preview-card"
                      data-testid={`blocked-by-${dep.id}`}
                    >
                      <div className="dependency-preview-meta">
                        <span className="dependency-preview-key">{dep.readableId}</span>
                        <span className="dependency-preview-title">{dep.title}</span>
                      </div>
                      <div className="dependency-preview-direction">
                        {dep.readableId} · {dep.title} ↓ must happen before {task.readableId}
                      </div>
                    </div>
                  ))}
                  {task.blocks?.map((dep) => (
                    <div
                      key={dep.id}
                      className="dependency-preview-card"
                      data-testid={`blocks-${dep.id}`}
                    >
                      <div className="dependency-preview-meta">
                        <span className="dependency-preview-key">{dep.readableId}</span>
                        <span className="dependency-preview-title">{dep.title}</span>
                      </div>
                      <div className="dependency-preview-direction">
                        {task.readableId} · {task.title} ↓ must happen before {dep.readableId}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subtasks Section */}
            <section className="parent-details-subtasks-section" aria-label="Subtasks">
              <div className="parent-details-subtasks-header">
                <h3 className="parent-details-subtasks-heading">
                  {isBlocked ? 'Incomplete subtasks' : 'Subtasks'}
                </h3>
                <span
                  className={`parent-details-subtasks-count ${
                    isBlocked ? 'parent-details-subtasks-count--highlight' : ''
                  }`}
                  data-testid={isBlocked ? 'subtasks-count' : 'subtasks-completion-count'}
                >
                  {isBlocked
                    ? `${blockedCount} remaining`
                    : `${completedSubtasks.length} / ${subtasks.length} done`}
                </span>
                {!isBlocked && (
                  <span className="visually-hidden" data-testid="subtasks-count">
                    {completedSubtasks.length} / {subtasks.length} done
                  </span>
                )}
              </div>

              <div className="parent-details-subtasks-container">
                {subtasks.length === 0 ? (
                  <p className="subtasks-empty-text" data-testid="no-subtasks-text">
                    No subtasks yet. Break this task into clear steps.
                  </p>
                ) : (
                  <ul
                    className={`parent-details-subtasks-list ${
                      isBlocked ? 'parent-details-subtasks-list--blocked' : ''
                    }`}
                    data-testid={isBlocked ? 'incomplete-subtasks-list' : 'subtasks-list'}
                    role="list"
                  >
                    {(isBlocked ? incompleteSubtasks : subtasks).map((st) => (
                      <li
                        key={st.id}
                        className={`parent-details-subtask-item ${
                          st.status !== ColumnCategory.Done
                            ? 'parent-details-subtask-item--incomplete'
                            : ''
                        }`}
                        data-testid={isBlocked ? `incomplete-subtask-${st.id}` : `subtask-item-${st.id}`}
                        onClick={() => handleToggleSubtask(st)}
                      >
                        <div className="parent-details-subtask-left">
                          <span className="parent-details-subtask-meta">
                            {st.readableId} · {st.status === ColumnCategory.Done ? 'Done' : st.columnName || 'To do'}
                          </span>
                          <div className="parent-details-subtask-title-line">
                            <span className="parent-details-subtask-indicator" aria-hidden="true">
                              {st.status === ColumnCategory.Done ? '✓' : '○'}
                            </span>
                            <span className="parent-details-subtask-title" title={st.title}>
                              {st.title}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="parent-details-subtask-open-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusedSubtaskId(st.id);
                          }}
                          data-testid={`open-subtask-${st.id}`}
                        >
                          Open subtask →
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isBlocked && (
                <p className="parent-details-subtasks-help">
                  Open each subtask above to finish the remaining work.
                </p>
              )}
            </section>

            {/* Footer Actions */}
            <div className="parent-details-actions task-details-actions">
              {isBlocked ? (
                <>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={handleBackToTask}
                    data-testid="back-to-task-button"
                  >
                    Back to task
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={onClose}
                    data-testid="close-task-details-button"
                  >
                    Close
                  </button>
                </>
              ) : isParentDone ? (
                <>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled
                    data-testid="parent-completed-button"
                  >
                    Completed
                  </button>
                  {onEdit && (
                    <button
                      type="button"
                      className="button button-outline task-details-btn-edit"
                      onClick={onEdit}
                      data-testid="open-edit-task-btn"
                    >
                      Edit task
                    </button>
                  )}
                  {onManageDependencies && (
                    <button
                      type="button"
                      className="button button-outline task-details-btn-dependencies"
                      onClick={onManageDependencies}
                      data-testid="manage-dependencies-button"
                    >
                      Manage dependencies
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={onClose}
                    data-testid="close-task-details-button"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  {onAddSubtask && (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={onAddSubtask}
                      data-testid="add-subtask-button"
                    >
                      Add subtask
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      className="button button-outline task-details-btn-edit"
                      onClick={onEdit}
                      data-testid="open-edit-task-btn"
                    >
                      Edit task
                    </button>
                  )}
                  {onManageDependencies && (
                    <button
                      type="button"
                      className="button button-outline task-details-btn-dependencies"
                      onClick={onManageDependencies}
                      data-testid="manage-dependencies-button"
                    >
                      Manage dependencies
                    </button>
                  )}
                  <button
                    type="button"
                    className={`button button-dark ${
                      localCompleting || isCompleting ? 'parent-details-btn-completing' : ''
                    }`}
                    disabled={localCompleting || isCompleting}
                    onClick={handleCompleteParent}
                    data-testid="mark-complete-button"
                  >
                    {localCompleting || isCompleting ? '◌ Completing…' : 'Mark complete'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatPriority(priority?: TaskPriority | null): string {
  if (!priority) return 'None';
  switch (priority) {
    case TaskPriority.Low:
      return 'Low';
    case TaskPriority.Medium:
      return 'Medium';
    case TaskPriority.High:
      return 'High';
    case TaskPriority.Critical:
      return 'Critical';
    default:
      return 'None';
  }
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getAssigneeNames(
  task: TaskItem,
  members?: readonly ProjectMemberModel[]
): string | null {
  if (task.assigneeNames && task.assigneeNames.length > 0 && task.assigneeNames[0]) {
    return task.assigneeNames.join(', ');
  }
  if (task.assignees && task.assignees.length > 0) {
    const valid = task.assignees.map((a) => a.userName).filter(Boolean);
    if (valid.length > 0) return valid.join(', ');
  }
  if (!task.assigneeIds || task.assigneeIds.length === 0) return null;
  if (!members || members.length === 0) return 'Assigned';
  const names = task.assigneeIds
    .map((id) => members.find((m) => m.userId === id)?.userName || members.find((m) => m.userId === id)?.email)
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(', ') : null;
}
