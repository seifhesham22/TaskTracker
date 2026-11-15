import { useId, useMemo, useState } from 'react';
import type { IncompleteSubtaskDto } from '../../api';
import {
  ColumnCategory,
  type BoardColumnModel,
  type ProjectMemberModel,
  type TaskItem,
} from '../../domain/models';
import { PriorityBadge } from './PriorityBadge';
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
  readonly blockedError?: BlockedIncompleteSubtasksInfo | null;
  readonly onClose: () => void;
  readonly onMarkComplete: (taskId: string) => Promise<boolean>;
  readonly onMoveSubtask?: (subtaskId: string, targetColumnId: string) => Promise<boolean>;
  readonly onMoveTask?: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly onAddSubtask?: () => void;
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
  blockedError,
  onClose,
  onMarkComplete,
  onMoveSubtask,
  onMoveTask,
  onAddSubtask,
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
      className="parent-details-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      data-testid="parent-task-details-modal"
    >
      <div className="parent-details-dialog">
        <button
          type="button"
          className="parent-details-close"
          aria-label="Close details"
          data-testid="close-parent-task-details"
          onClick={() => {
            setFocusedSubtaskId(null);
            setDismissedBlocked(false);
            onClose();
          }}
        >
          <img src="/assets/95559.svg" alt="" width="16" height="16" />
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

            <div className="parent-details-header">
              <span className="parent-details-breadcrumb">
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

            <div className="parent-details-actions">
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
          /* Parent Task Main View */
          <>
            <span className="parent-details-breadcrumb">
              {displayProject} / {task.readableId}
            </span>

            <div className="parent-details-header">
              <div className="parent-details-title-row">
                <h2 id={headingId} className="parent-details-title">
                  {task.title}
                </h2>
                <span
                  className={`parent-details-badge ${
                    isParentDone
                      ? 'parent-details-badge--done'
                      : 'parent-details-badge--inprogress'
                  }`}
                  data-testid="parent-status-badge"
                >
                  <StatusIcon category={isParentDone ? ColumnCategory.Done : task.status} />
                  <span>{isParentDone ? 'Done' : task.columnName || task.status}</span>
                </span>
              </div>

              {task.description && (
                <p className="parent-details-desc">{task.description}</p>
              )}
            </div>

            <div className="parent-details-meta">
              {task.priority && (
                <div className="parent-details-meta-item">
                  <PriorityBadge priority={task.priority} />
                </div>
              )}
              {assigneeNames && (
                <div className="parent-details-meta-item">
                  <span>Assignee: {assigneeNames}</span>
                </div>
              )}
              {task.dueDate && (
                <div className="parent-details-meta-item">
                  <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* US-13 Subtask Created Success Banner */}
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

            {/* State 02 / 03: Completion blocked by incomplete subtasks */}
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
                {blockedError?.message && (
                  <p
                    className="parent-details-banner-detail"
                    data-testid="parent-completion-error-message"
                  >
                    {blockedError.message}
                  </p>
                )}
              </div>
            )}

            {/* State 04: Ready to complete (all subtasks done) */}
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

            {/* State 06: Parent completed */}
            {isParentDone && (
              <div
                className="parent-details-banner parent-details-banner--success"
                role="status"
                data-testid="task-completed-banner"
              >
                <p className="parent-details-banner-desc">
                  ✓ Task completed
                </p>
              </div>
            )}

            {/* Subtasks Section */}
            <section
              className="parent-details-subtasks-section"
              aria-label="Subtasks"
            >
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
                        <StatusIcon category={st.status} />
                        <span className="parent-details-subtask-id">
                          {st.readableId} · {st.status === ColumnCategory.Done ? 'Done' : st.columnName || 'In progress'}
                        </span>
                        <span className="parent-details-subtask-title" title={st.title}>
                          {st.title}
                        </span>
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

              {isBlocked && (
                <p className="parent-details-subtasks-help">
                  Open each subtask above to finish the remaining work.
                </p>
              )}
            </section>

            {/* Footer Actions */}
            <div className="parent-details-actions">
              {onAddSubtask && !isBlocked && !isParentDone && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={onAddSubtask}
                  data-testid="add-subtask-button"
                >
                  Add subtask
                </button>
              )}

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
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
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
