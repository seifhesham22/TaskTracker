import { useId, useMemo, useState } from 'react';
import {
  ColumnCategory,
  TaskPriority,
  type ProjectMemberModel,
  type TaskItem,
} from '../../domain/models';
import { taskAssigneeValidator } from '../../domain/validators/TaskAssigneeValidator';
import './TaskAssigneeModal.css';

export interface TaskAssigneeModalProps {
  readonly task: TaskItem | null;
  readonly members?: readonly ProjectMemberModel[];
  readonly projectName?: string | null;
  readonly userRole?: string | null;
  readonly isOpen: boolean;
  readonly initialPickerMode?: boolean;
  readonly onClose: () => void;
  readonly onAssign: (taskId: string, userId: string) => Promise<boolean>;
  readonly onUnassign: (taskId: string, userId: string) => Promise<boolean>;
  readonly isLoadingMembers?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '—';
  const clean = name.trim();
  if (clean.includes('@')) {
    const local = clean.split('@')[0];
    return local.slice(0, 2).toUpperCase();
  }
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatStatusText(status?: ColumnCategory, priority?: TaskPriority | null): string {
  let statusStr = 'To do';
  switch (status) {
    case ColumnCategory.Backlog:
      statusStr = 'Backlog';
      break;
    case ColumnCategory.ToDo:
      statusStr = 'To do';
      break;
    case ColumnCategory.InProgress:
      statusStr = 'In progress';
      break;
    case ColumnCategory.Done:
      statusStr = 'Done';
      break;
    case ColumnCategory.Cancelled:
      statusStr = 'Cancelled';
      break;
  }

  let priorityStr = 'Normal priority';
  switch (priority) {
    case TaskPriority.Critical:
      priorityStr = 'Critical priority';
      break;
    case TaskPriority.High:
      priorityStr = 'High priority';
      break;
    case TaskPriority.Medium:
      priorityStr = 'Medium priority';
      break;
    case TaskPriority.Low:
      priorityStr = 'Low priority';
      break;
  }

  return `${statusStr} · ${priorityStr}`;
}

export function TaskAssigneeModal(props: TaskAssigneeModalProps) {
  if (!props.isOpen || !props.task) {
    return null;
  }

  return (
    <TaskAssigneeModalContent
      key={`${props.task.id}-${props.isOpen}-${props.initialPickerMode ?? false}`}
      {...props}
      task={props.task}
    />
  );
}

interface TaskAssigneeModalContentProps extends Omit<TaskAssigneeModalProps, 'task'> {
  readonly task: TaskItem;
}

function TaskAssigneeModalContent({
  task,
  members = [],
  projectName,
  userRole,
  initialPickerMode = false,
  onClose,
  onAssign,
  onUnassign,
  isLoadingMembers = false,
}: TaskAssigneeModalContentProps) {
  const headingId = useId();

  const currentAssigneeId =
    task.assigneeIds && task.assigneeIds.length > 0
      ? task.assigneeIds[0]
      : task.assignees && task.assignees.length > 0
        ? task.assignees[0].id
        : '';

  const [isPickerMode, setIsPickerMode] = useState(initialPickerMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssigneeId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isReader =
    Boolean(userRole) && userRole!.toUpperCase() === 'READER';

  const currentAssignee = useMemo(() => {
    if (!task) return null;
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees[0];
    }
    if (task.assigneeIds && task.assigneeIds.length > 0) {
      const id = task.assigneeIds[0];
      const found = members.find((m) => m.userId === id);
      return {
        id,
        userName: found ? found.userName : task.assigneeNames?.[0] || 'Assigned member',
      };
    }
    return null;
  }, [task, members]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const lower = searchQuery.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.userName.toLowerCase().includes(lower) ||
        (m.email && m.email.toLowerCase().includes(lower))
    );
  }, [members, searchQuery]);

  const effectiveProjectName = projectName || 'Project';
  const taskKey = task.readableId || `Task-${task.number || task.id}`;
  const isAssigned = Boolean(currentAssignee);

  const handleOpenPicker = () => {
    if (isReader) return;
    setServerError(null);
    setShowSuccessBanner(false);
    setIsPickerMode(true);
  };

  const handleCancelPicker = () => {
    if (isSubmitting) return;
    setServerError(null);
    // Reset draft choice back to current assignment
    const currentId = currentAssignee?.id || '';
    setSelectedUserId(currentId);
    setIsPickerMode(false);
  };

  const handleSave = async () => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      if (!selectedUserId || selectedUserId === '') {
        // Unassign flow
        const existingIds =
          task.assigneeIds && task.assigneeIds.length > 0
            ? task.assigneeIds
            : task.assignees
              ? task.assignees.map((a) => a.id)
              : [];

        for (const uid of existingIds) {
          await onUnassign(task.id, uid);
        }
      } else {
        // Validate assignee is in project
        const validation = taskAssigneeValidator.validate(
          { taskId: task.id, userId: selectedUserId },
          members
        );
        if (!validation.isValid) {
          setServerError(
            validation.errors.userId || validation.errors.general || 'Invalid member assignment.'
          );
          setIsSubmitting(false);
          return;
        }

        // Unassign old members if different
        const existingIds =
          task.assigneeIds && task.assigneeIds.length > 0
            ? task.assigneeIds
            : task.assignees
              ? task.assignees.map((a) => a.id)
              : [];

        for (const uid of existingIds) {
          if (uid !== selectedUserId) {
            await onUnassign(task.id, uid);
          }
        }

        // Assign selected member
        if (!existingIds.includes(selectedUserId)) {
          await onAssign(task.id, selectedUserId);
        }
      }

      setShowSuccessBanner(true);
      setIsPickerMode(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't save assignment. Try again.";
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine button title in picker mode
  const isUnassignChoice = !selectedUserId || selectedUserId === '';
  const submitButtonText = isSubmitting
    ? 'Saving…'
    : isUnassignChoice && isAssigned
      ? 'Remove assignment'
      : 'Save changes';

  const isSaveDisabled =
    isSubmitting ||
    isLoadingMembers ||
    (filteredMembers.length === 0 && searchQuery.trim().length > 0 && selectedUserId !== '');

  return (
    <div
      className="assignee-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="assignee-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="task-assignee-modal"
      >
        <header className="assignee-modal-header">
          <h2 id={headingId} className="assignee-modal-title">
            {isPickerMode ? 'Change assignee' : 'Task assignee'}
          </h2>
          <p className="assignee-modal-subtitle">
            {isPickerMode
              ? `${taskKey} · ${task.title}`
              : `${effectiveProjectName} / ${taskKey}`}
          </p>
        </header>

        {!isPickerMode ? (
          <>
            {/* View Mode: States 01, 06, 08, 10 */}
            <section
              className="assignee-task-summary-card"
              aria-label="Task preview"
              data-testid="assignee-task-summary"
            >
              <div className="assignee-task-summary-content">
                <span className="assignee-task-summary-title">{task.title}</span>
                <span className="assignee-task-summary-meta">
                  {formatStatusText(task.status, task.priority)}
                </span>
              </div>
            </section>

            <div className="assignee-field-group">
              <label className="assignee-field-label">Assignee</label>
              <div
                className="assignee-value-box"
                data-testid="task-assignee-display-box"
              >
                {currentAssignee ? (
                  <span>
                    {getInitials(currentAssignee.userName)} · {currentAssignee.userName}
                  </span>
                ) : (
                  <span>Unassigned</span>
                )}
              </div>
            </div>

            {showSuccessBanner && (
              <div
                className="assignee-banner-success"
                role="status"
                data-testid="assignee-updated-banner"
              >
                ✓ Assignee updated
              </div>
            )}

            {isReader ? (
              <div
                className="assignee-notice-reader"
                role="note"
                data-testid="assignee-reader-notice"
              >
                Only writers and owners of the project can assign tasks.
              </div>
            ) : (
              <button
                type="button"
                className="assignee-btn-primary"
                onClick={handleOpenPicker}
                data-testid="open-change-assignee-btn"
              >
                Change assignee
              </button>
            )}

            <button
              type="button"
              className="assignee-btn-secondary"
              onClick={onClose}
              data-testid="close-assignee-modal-btn"
            >
              Close
            </button>
          </>
        ) : (
          <>
            {/* Picker Mode: States 02, 03, 04, 05, 07, 09, 11 */}
            <div className="assignee-field-group">
              <label htmlFor="member-search-input" className="assignee-field-label">
                Find a project member
              </label>
              <input
                id="member-search-input"
                type="search"
                className="assignee-search-input"
                placeholder="Search members…"
                value={searchQuery}
                disabled={isSubmitting}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="member-search-input"
              />
            </div>

            {isLoadingMembers ? (
              <div
                className="assignee-feedback-box"
                role="status"
                aria-busy="true"
                data-testid="loading-members-box"
              >
                Loading project members…
              </div>
            ) : filteredMembers.length === 0 && searchQuery.trim() !== '' ? (
              <div
                className="assignee-feedback-box"
                role="status"
                data-testid="no-matching-members-box"
              >
                No matching project members. Try a different search.
              </div>
            ) : (
              <div
                className="assignee-options-list"
                role="radiogroup"
                aria-label="Project members"
              >
                {/* Option: Unassigned */}
                <div
                  className={`assignee-option-item ${
                    selectedUserId === '' ? 'assignee-option-item--selected' : ''
                  }`}
                  role="radio"
                  aria-checked={selectedUserId === ''}
                  tabIndex={0}
                  onClick={() => !isSubmitting && setSelectedUserId('')}
                  onKeyDown={(e) => {
                    if ((e.key === ' ' || e.key === 'Enter') && !isSubmitting) {
                      e.preventDefault();
                      setSelectedUserId('');
                    }
                  }}
                  data-testid="assignee-option-unassigned"
                >
                  <span className="assignee-option-avatar" aria-hidden="true">
                    —
                  </span>
                  <div className="assignee-option-info">
                    <span className="assignee-option-name">Unassigned</span>
                    <span className="assignee-option-role">
                      Remove the current assignment
                    </span>
                  </div>
                  <span className="assignee-option-radio" aria-hidden="true">
                    {selectedUserId === '' ? '●' : '○'}
                  </span>
                </div>

                {/* Project members */}
                {filteredMembers.map((member) => {
                  const isSelected = selectedUserId === member.userId;
                  const roleLabel = member.role
                    ? member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase()
                    : 'Writer';

                  return (
                    <div
                      key={member.userId}
                      className={`assignee-option-item ${
                        isSelected ? 'assignee-option-item--selected' : ''
                      }`}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => !isSubmitting && setSelectedUserId(member.userId)}
                      onKeyDown={(e) => {
                        if ((e.key === ' ' || e.key === 'Enter') && !isSubmitting) {
                          e.preventDefault();
                          setSelectedUserId(member.userId);
                        }
                      }}
                      data-testid={`assignee-option-${member.userId}`}
                    >
                      <span className="assignee-option-avatar" aria-hidden="true">
                        {getInitials(member.userName)}
                      </span>
                      <div className="assignee-option-info">
                        <span className="assignee-option-name">{member.userName}</span>
                        <span className="assignee-option-role">
                          Project member · {roleLabel}
                        </span>
                      </div>
                      <span className="assignee-option-radio" aria-hidden="true">
                        {isSelected ? '●' : '○'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {serverError && (
              <div
                className="assignee-banner-error"
                role="alert"
                data-testid="assignee-error-banner"
              >
                {serverError}
              </div>
            )}

            {showSuccessBanner && (
              <div
                className="assignee-banner-success"
                role="status"
                data-testid="assignee-updated-banner"
              >
                ✓ Assignee updated
              </div>
            )}

            <button
              type="button"
              className="assignee-btn-primary"
              disabled={isSaveDisabled}
              onClick={handleSave}
              data-testid="save-assignee-btn"
            >
              {submitButtonText}
            </button>

            <button
              type="button"
              className="assignee-btn-secondary"
              disabled={isSubmitting}
              onClick={handleCancelPicker}
              data-testid="cancel-assignee-picker-btn"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
