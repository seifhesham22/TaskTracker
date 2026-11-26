import { useState } from 'react';
import {
  ColumnCategory,
  type BlockedTaskStartFailure,
  type TaskDependencyRef,
  type TaskItem,
} from '../../domain/models';
import './BlockedTaskStartModal.css';

export interface BlockedTaskStartModalProps {
  readonly failure: BlockedTaskStartFailure | null;
  readonly isOpen: boolean;
  readonly allTasks?: readonly TaskItem[];
  readonly rollbackBanner?: string | null;
  readonly onClose: () => void;
  readonly onRecheck: (taskId: string) => Promise<readonly TaskDependencyRef[]>;
  readonly onStartTask: (taskId: string, targetColumnId?: string) => Promise<boolean>;
}

type ModalViewMode = 'explanation' | 'prerequisite_details';

function formatStatus(status?: ColumnCategory | string): string {
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
      if (status) return status;
      return 'Backlog';
  }
}

function getStatusBadgeModifier(status?: ColumnCategory | string): string {
  switch (status) {
    case ColumnCategory.InProgress:
      return 'inprogress';
    case ColumnCategory.Done:
      return 'done';
    case ColumnCategory.ToDo:
      return 'todo';
    case ColumnCategory.Backlog:
      return 'backlog';
    case ColumnCategory.Cancelled:
      return 'cancelled';
    default:
      return 'backlog';
  }
}

export function BlockedTaskStartModal({
  failure,
  isOpen,
  allTasks = [],
  rollbackBanner,
  onClose,
  onRecheck,
  onStartTask,
}: BlockedTaskStartModalProps) {
  if (!isOpen || !failure) {
    return null;
  }

  return (
    <BlockedTaskStartModalContent
      key={failure.taskId}
      failure={failure}
      allTasks={allTasks}
      rollbackBanner={rollbackBanner}
      onClose={onClose}
      onRecheck={onRecheck}
      onStartTask={onStartTask}
    />
  );
}

interface BlockedTaskStartModalContentProps {
  readonly failure: BlockedTaskStartFailure;
  readonly allTasks: readonly TaskItem[];
  readonly rollbackBanner?: string | null;
  readonly onClose: () => void;
  readonly onRecheck: (taskId: string) => Promise<readonly TaskDependencyRef[]>;
  readonly onStartTask: (taskId: string, targetColumnId?: string) => Promise<boolean>;
}

function BlockedTaskStartModalContent({
  failure,
  allTasks,
  rollbackBanner,
  onClose,
  onRecheck,
  onStartTask,
}: BlockedTaskStartModalContentProps) {
  const [viewMode, setViewMode] = useState<ModalViewMode>('explanation');
  const [activePrerequisiteId, setActivePrerequisiteId] = useState<string | null>(null);

  const [currentBlockers, setCurrentBlockers] = useState<readonly TaskDependencyRef[]>(
    failure.blockers
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const activePrerequisite = activePrerequisiteId
    ? allTasks.find((t) => t.id === activePrerequisiteId) ||
      currentBlockers.find((b) => b.id === activePrerequisiteId) ||
      null
    : null;

  const handleOpenPrerequisite = (blockerId: string) => {
    setActivePrerequisiteId(blockerId);
    setViewMode('prerequisite_details');
  };

  const handleBackToBlockedTask = () => {
    setViewMode('explanation');
    setActivePrerequisiteId(null);
  };

  const handleRecheck = async () => {
    setIsChecking(true);
    setHasError(false);
    try {
      const updatedBlockers = await onRecheck(failure.taskId);
      // Filter out any completed blockers (status === DONE)
      const unfinished = updatedBlockers.filter((b) => b.status !== ColumnCategory.Done);
      setCurrentBlockers(unfinished);
    } catch {
      setHasError(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setHasError(false);
    try {
      const success = await onStartTask(failure.taskId, failure.targetColumnId);
      if (success) {
        setHasStarted(true);
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsStarting(false);
    }
  };

  const displayProject = failure.projectName || 'Project';
  const allResolved = currentBlockers.length === 0;

  return (
    <div
      className="blocked-start-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-start-title"
      data-testid="blocked-task-start-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="blocked-start-dialog" data-testid="blocked-start-dialog">
        <button
          type="button"
          className="blocked-start-close"
          aria-label="Close"
          data-testid="blocked-start-close-btn"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="blocked-start-content">
          {viewMode === 'prerequisite_details' && activePrerequisite ? (
            /* State 04 / Navigate to a prerequisite */
            <div className="blocked-start-prerequisite-view" data-testid="prerequisite-detail-view">
              <div className="blocked-start-header">
                <span className="blocked-start-eyebrow">
                  {displayProject} / {activePrerequisite.readableId}
                </span>
                <h3 className="blocked-start-title">{activePrerequisite.title}</h3>
              </div>

              <div className="blocked-start-status-row">
                <span className="blocked-start-status-label">Status</span>
                <span
                  className={`blocked-start-status-badge blocked-start-status-badge--${getStatusBadgeModifier(
                    activePrerequisite.status
                  )}`}
                  data-testid="prerequisite-status-badge"
                >
                  {formatStatus(activePrerequisite.status)}
                </span>
              </div>

              <div
                className="blocked-start-banner blocked-start-banner--warning"
                role="alert"
                data-testid="prerequisite-blocks-banner"
              >
                <span>This task blocks {failure.readableId}.</span>
              </div>

              <div className="blocked-start-actions">
                <button
                  type="button"
                  className="blocked-start-btn blocked-start-btn--secondary"
                  onClick={handleBackToBlockedTask}
                  data-testid="back-to-blocked-task-btn"
                >
                  Back to blocked task
                </button>
              </div>
            </div>
          ) : (
            /* States 01, 02, 03, 05, 06, 07, 08 */
            <>
              <div className="blocked-start-header">
                <h3 id="blocked-start-title" className="blocked-start-title">
                  {failure.taskTitle}
                </h3>
                <span className="blocked-start-eyebrow">
                  {displayProject} / {failure.readableId}
                </span>
              </div>

              <div className="blocked-start-status-row">
                <span className="blocked-start-status-label">Status</span>
                <span
                  className={`blocked-start-status-badge ${
                    hasStarted ? 'blocked-start-status-badge--inprogress' : ''
                  }`}
                  data-testid="blocked-task-status-badge"
                >
                  {hasStarted ? 'In progress' : failure.currentColumnName || 'To do'}
                </span>
              </div>

              {/* State 02: Rollback Banner */}
              {rollbackBanner && (
                <div
                  className="blocked-start-banner blocked-start-banner--rollback"
                  role="status"
                  data-testid="rollback-banner"
                >
                  <span>{rollbackBanner}</span>
                </div>
              )}

              {/* State 08: Verification or transition failure */}
              {hasError ? (
                <div
                  className="blocked-start-banner blocked-start-banner--error"
                  role="alert"
                  data-testid="verification-failure-banner"
                >
                  <span>Couldn’t verify prerequisites. The task was not started.</span>
                </div>
              ) : hasStarted ? (
                /* State 07: Start confirmed */
                <div
                  className="blocked-start-banner blocked-start-banner--success"
                  role="status"
                  data-testid="task-started-banner"
                >
                  <span>✓ Task started</span>
                </div>
              ) : isChecking ? (
                /* State 05: Rechecking prerequisites */
                <div
                  className="blocked-start-banner blocked-start-banner--info"
                  role="status"
                  data-testid="checking-prerequisites-banner"
                >
                  <span>Checking prerequisites…</span>
                </div>
              ) : allResolved ? (
                /* State 06: All blockers resolved */
                <div
                  className="blocked-start-banner blocked-start-banner--ready"
                  role="status"
                  data-testid="all-prerequisites-complete-banner"
                >
                  <span>All prerequisites are complete or removed.</span>
                </div>
              ) : (
                /* State 01: Blocked-start explanation */
                <div
                  className="blocked-start-banner blocked-start-banner--warning"
                  role="alert"
                  data-testid="blocked-start-explanation-banner"
                >
                  <span>This task can’t start yet. Complete its prerequisites.</span>
                </div>
              )}

              {/* Open blockers list if not all resolved and not started */}
              {!allResolved && !hasStarted && (
                <div
                  className="blocked-start-blockers-section"
                  data-testid="open-blockers-list"
                >
                  {currentBlockers.map((blocker) => {
                    const taskFromAll = allTasks.find((t) => t.id === blocker.id);
                    const blockerStatus = blocker.status || taskFromAll?.status || ColumnCategory.Backlog;
                    const statusText = formatStatus(blockerStatus);
                    return (
                      <div
                        key={blocker.id}
                        className="blocked-start-blocker-card"
                        data-testid={`blocker-item-${blocker.id}`}
                      >
                        <div className="blocked-start-blocker-info">
                          <span className="blocked-start-blocker-title">
                            {blocker.readableId} · {blocker.title}
                          </span>
                          <span className="blocked-start-blocker-status">
                            {statusText} · Blocks {failure.readableId}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="blocked-start-btn blocked-start-btn--secondary"
                          onClick={() => handleOpenPrerequisite(blocker.id)}
                          data-testid={`open-blocker-${blocker.id}`}
                        >
                          Open blocker
                        </button>
                      </div>
                    );
                  })}

                  {/* State 03: Mobile Status Selection helper view */}
                  <div
                    className="blocked-start-mobile-selection"
                    data-testid="mobile-status-selection-box"
                  >
                    <div className="blocked-start-mobile-status-item blocked-start-mobile-status-item--current">
                      <span>{failure.currentColumnName || 'To do'} · Current status</span>
                      <span>●</span>
                    </div>
                    <div className="blocked-start-mobile-status-item blocked-start-mobile-status-item--unavailable">
                      <span>
                        In progress · Unavailable · {currentBlockers.length} unfinished blocker
                        {currentBlockers.length === 1 ? '' : 's'}
                      </span>
                      <span>○</span>
                    </div>
                    <div className="blocked-start-mobile-status-item blocked-start-mobile-status-item--unavailable">
                      <span>Done · Completion rules checked separately</span>
                      <span>○</span>
                    </div>
                    {currentBlockers[0] && (
                      <div className="blocked-start-mobile-hint">
                        <span>Finish {currentBlockers[0].readableId} before starting this task.</span>
                        <button
                          type="button"
                          className="blocked-start-btn blocked-start-btn--secondary"
                          onClick={() => handleOpenPrerequisite(currentBlockers[0].id)}
                          data-testid="view-blocker-btn"
                        >
                          View blocker
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="blocked-start-actions">
                {hasStarted ? (
                  /* State 07: Back to board */
                  <button
                    type="button"
                    className="blocked-start-btn blocked-start-btn--primary"
                    onClick={onClose}
                    data-testid="back-to-board-btn"
                  >
                    Back to board
                  </button>
                ) : hasError ? (
                  /* State 08: Try again & Back to board */
                  <>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--primary"
                      onClick={allResolved ? handleStart : handleRecheck}
                      data-testid="try-again-btn"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--secondary"
                      onClick={onClose}
                      data-testid="back-to-board-btn"
                    >
                      Back to board
                    </button>
                  </>
                ) : allResolved ? (
                  /* State 06: Start task */
                  <>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--primary"
                      onClick={handleStart}
                      disabled={isStarting}
                      data-testid="start-task-btn"
                    >
                      {isStarting ? 'Starting…' : 'Start task'}
                    </button>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--secondary"
                      onClick={onClose}
                      data-testid="back-to-board-btn"
                    >
                      Back to board
                    </button>
                  </>
                ) : (
                  /* States 01, 02, 05: Check again & Back to board */
                  <>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--primary"
                      onClick={handleRecheck}
                      disabled={isChecking}
                      data-testid={isChecking ? 'checking-btn' : 'check-again-btn'}
                    >
                      {isChecking ? 'Checking…' : 'Check again'}
                    </button>
                    <button
                      type="button"
                      className="blocked-start-btn blocked-start-btn--secondary"
                      onClick={onClose}
                      data-testid="back-to-board-btn"
                    >
                      Back to board
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
