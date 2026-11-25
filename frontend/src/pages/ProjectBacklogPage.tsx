import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useActiveProject } from '../context/activeProjectContextDef';
import { useProjects } from '../hooks/useProjects';
import { useBacklog } from '../hooks/useBacklog';
import type { BacklogItem } from '../domain/models';
import { BacklogFilterBar } from '../components/backlog/BacklogFilterBar';
import { BacklogItemCard } from '../components/backlog/BacklogItemCard';
import { BacklogPagination } from '../components/backlog/BacklogPagination';
import { BacklogSkeleton } from '../components/backlog/BacklogSkeleton';
import { BacklogItemActionsModal } from '../components/backlog/BacklogItemActionsModal';
import { BacklogMovePositionModal } from '../components/backlog/BacklogMovePositionModal';
import { BacklogPriorityModal } from '../components/backlog/BacklogPriorityModal';
import { ProjectAccessView } from '../components/access/ProjectAccessView';
import './ProjectBacklogPage.css';

export function ProjectBacklogPage() {
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeProjectId: contextProjectId, activeBoardId, setActiveProject } = useActiveProject();
  const { projects } = useProjects(user?.id);

  const activeProjectId = useMemo(() => {
    return (
      params.projectId ||
      searchParams.get('projectId') ||
      contextProjectId ||
      projects[0]?.id ||
      null
    );
  }, [params.projectId, searchParams, contextProjectId, projects]);

  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (activeProjectId) {
      const boardId = activeProject?.boards && activeProject.boards.length > 0
        ? activeProject.boards[0].id
        : activeBoardId || null;
      setActiveProject(activeProjectId, boardId, activeProject?.name || null);
    }
  }, [activeProjectId, activeProject, activeBoardId, setActiveProject]);

  const {
    data,
    isLoading,
    error,
    accessState,
    search,
    statusFilter,
    priorityFilter,
    isSavingOrder,
    orderSavedBanner,
    prioritySavedBanner,
    reorderError,
    priorityError,
    canReorder,
    setSearch,
    setStatusFilter,
    setPriorityFilter,
    setPage,
    reload,
    handleRankTask,
    handleMoveUp,
    handleMoveDown,
    handleMoveToPosition,
    handleUpdatePriority,
    dismissOrderSavedBanner,
    dismissPrioritySavedBanner,
    dismissReorderError,
    dismissPriorityError,
  } = useBacklog({
    projectId: activeProjectId,
  });

  const [actionsItem, setActionsItem] = useState<BacklogItem | null>(null);
  const [movePositionItem, setMovePositionItem] = useState<BacklogItem | null>(null);
  const [priorityItem, setPriorityItem] = useState<BacklogItem | null>(null);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);

  const userRole = activeProject?.role ? activeProject.role.toUpperCase() : 'WRITER';
  const canManage = userRole !== 'READER';

  if (accessState && accessState !== 'permitted') {
    return (
      <ProjectAccessView
        accessState={accessState}
        onRetry={reload}
        onBackToProjects={() => navigate('/projects')}
        onLogin={() => navigate('/login')}
      />
    );
  }

  const projectName = activeProject?.name || 'Test Project';
  const projectKey = (activeProject?.name || activeProject?.key || 'TEST PROJECT').toUpperCase();
  const hasActiveFilters = Boolean(search.trim() || statusFilter || priorityFilter);

  const backLink = activeProject?.boards[0]?.id
    ? `/boards/${activeProject.boards[0].id}`
    : '/projects';

  const handleDragStart = (e: React.DragEvent<HTMLElement>, item: BacklogItem) => {
    e.dataTransfer.setData('text/plain', item.id);
    setDraggedItemId(item.id);
  };

  const handleDragEnter = (item: BacklogItem) => {
    if (draggedItemId && draggedItemId !== item.id) {
      setDropTargetItemId(item.id);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>, targetItem: BacklogItem) => {
    e.preventDefault();
    const sourceId = draggedItemId || e.dataTransfer.getData('text/plain');
    setDraggedItemId(null);
    setDropTargetItemId(null);

    if (!data || !canReorder || !sourceId || sourceId === targetItem.id) {
      return;
    }

    const currentIndex = data.items.findIndex((i) => i.id === sourceId);
    const targetIndex = data.items.findIndex((i) => i.id === targetItem.id);
    if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    const remaining = data.items.filter((i) => i.id !== sourceId);
    const afterTaskId = targetIndex === 0 ? null : remaining[targetIndex - 1].id;
    await handleRankTask(sourceId, afterTaskId, targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDropTargetItemId(null);
  };

  const actionsItemPos = actionsItem && data
    ? data.items.findIndex((i) => i.id === actionsItem.id) + 1
    : 1;

  const movePositionItemPos = movePositionItem && data
    ? data.items.findIndex((i) => i.id === movePositionItem.id) + 1
    : 1;

  return (
    <div className="backlog-page" data-testid="project-backlog-page">
      <div className="backlog-card-container">
        {/* Header Bar */}
        <header className="backlog-header-bar">
          <p className="backlog-breadcrumb">{projectName} / Project backlog</p>
          <p className="backlog-project-eyebrow">{projectKey}</p>
          <h1 className="backlog-title">Project backlog</h1>
          <p className="backlog-subtitle">Upcoming work, in one ordered list.</p>
        </header>

        {/* State 05: Saving Order Banner */}
        {isSavingOrder && (
          <div className="backlog-saving-banner" role="status" data-testid="backlog-saving-order-banner">
            <span aria-hidden="true">⏳</span>
            <span>Saving order…</span>
          </div>
        )}

        {/* State 06: Shared Order Saved Banner */}
        {orderSavedBanner && (
          <div className="backlog-success-banner" role="status" data-testid="backlog-order-saved-banner">
            <span aria-hidden="true">✓</span>
            <span>Order saved for all project members</span>
            <button
              type="button"
              className="backlog-banner-dismiss"
              onClick={dismissOrderSavedBanner}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* State 07: Priority Saved Banner */}
        {prioritySavedBanner && (
          <div className="backlog-success-banner" role="status" data-testid="backlog-priority-saved-banner">
            <span aria-hidden="true">✓</span>
            <span>Priority updated to {prioritySavedBanner}</span>
            <button
              type="button"
              className="backlog-banner-dismiss"
              onClick={dismissPrioritySavedBanner}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* State 08: Reorder Failure & Rollback Banner */}
        {reorderError && (
          <div className="backlog-alert-banner" role="alert" data-testid="backlog-reorder-error-banner">
            <span aria-hidden="true">⚠️</span>
            <div className="backlog-alert-content">
              <strong>Couldn’t save order.</strong>
              <span>{reorderError}</span>
            </div>
            <button
              type="button"
              className="backlog-banner-dismiss"
              onClick={dismissReorderError}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* State 09: Priority Save Failure Banner */}
        {priorityError && (
          <div className="backlog-alert-banner" role="alert" data-testid="backlog-priority-error-banner">
            <span aria-hidden="true">⚠️</span>
            <div className="backlog-alert-content">
              <strong>Couldn’t update priority.</strong>
              <span>{priorityError}</span>
            </div>
            <button
              type="button"
              className="backlog-banner-dismiss"
              onClick={dismissPriorityError}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* State 04: Error Banner */}
        {error && !isLoading && (
          <>
            <div className="backlog-error-banner" role="alert" data-testid="backlog-error-banner">
              <h2 className="backlog-error-title">Couldn’t load the backlog</h2>
              <p className="backlog-error-desc">Try again to load the project’s upcoming work.</p>
            </div>
            <button
              type="button"
              className="backlog-btn-dark"
              onClick={reload}
              data-testid="backlog-retry-btn"
            >
              Try again
            </button>
          </>
        )}

        {/* State 02: Loading Skeleton */}
        {isLoading && <BacklogSkeleton />}

        {/* Normal Content: Filter Bar & Lists */}
        {!isLoading && !error && (
          <>
            <BacklogFilterBar
              search={search}
              status={statusFilter}
              priority={priorityFilter}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onPriorityChange={setPriorityFilter}
            />

            {/* State 11: Notice if filtering/search is active */}
            {hasActiveFilters && canManage && (
              <div
                className="backlog-filter-reorder-notice"
                data-testid="backlog-filter-reorder-notice"
              >
                Reordering is disabled while filters or search are active. Clear filters to reorder tasks.
              </div>
            )}

            {/* State 03: Empty State */}
            {data && data.items.length === 0 ? (
              <div className="backlog-empty-container" data-testid="backlog-empty-state">
                <h2 className="backlog-empty-title">No backlog items yet</h2>
                <p className="backlog-empty-desc">
                  {hasActiveFilters
                    ? 'No tasks match your search or filter criteria.'
                    : 'Tasks added to this project’s backlog will appear here.'}
                </p>
                <Link to={backLink} className="backlog-btn-dark" data-testid="backlog-back-btn">
                  Back to project
                </Link>
              </div>
            ) : null}

            {/* State 01: Ordered backlog */}
            {data && data.items.length > 0 ? (
              <>
                <p className="backlog-ordering-info" data-testid="backlog-count-info">
                  {data.totalCount} {data.totalCount === 1 ? 'item' : 'items'} · Ordered by backlog position
                </p>

                <div className="backlog-items-list" role="list" data-testid="backlog-items-list">
                  {data.items.map((item, index) => (
                    <BacklogItemCard
                      key={item.id}
                      positionIndex={(data.page - 1) * data.pageSize + index + 1}
                      item={item}
                      canManage={canManage}
                      isDraggable={canManage && canReorder && !isSavingOrder}
                      isSaving={isSavingOrder}
                      isDragging={draggedItemId === item.id}
                      isDropTarget={dropTargetItemId === item.id}
                      onOpenActions={(it) => setActionsItem(it)}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>

                <BacklogPagination
                  page={data.page}
                  totalPages={data.totalPages}
                  totalCount={data.totalCount}
                  hasPreviousPage={data.hasPreviousPage}
                  hasNextPage={data.hasNextPage}
                  onPageChange={setPage}
                />
              </>
            ) : null}
          </>
        )}
      </div>

      {/* State 02: Accessible Item Actions Modal */}
      <BacklogItemActionsModal
        isOpen={Boolean(actionsItem)}
        item={actionsItem}
        currentPosition={actionsItemPos}
        totalCount={data?.totalCount ?? 0}
        canReorder={canReorder}
        onClose={() => setActionsItem(null)}
        onMoveUp={() => {
          if (actionsItem) handleMoveUp(actionsItem);
        }}
        onMoveDown={() => {
          if (actionsItem) handleMoveDown(actionsItem);
        }}
        onOpenMovePosition={() => {
          const item = actionsItem;
          setActionsItem(null);
          setMovePositionItem(item);
        }}
        onOpenPriority={() => {
          const item = actionsItem;
          setActionsItem(null);
          setPriorityItem(item);
        }}
      />

      {/* State 03: Move to Global Position Modal */}
      <BacklogMovePositionModal
        isOpen={Boolean(movePositionItem)}
        item={movePositionItem}
        currentPosition={movePositionItemPos}
        totalCount={data?.totalCount ?? 0}
        items={data?.items ?? []}
        onClose={() => setMovePositionItem(null)}
        onSubmit={(newPos) => {
          if (movePositionItem) {
            handleMoveToPosition(movePositionItem, newPos);
          }
        }}
      />

      {/* State 04: Change Item Priority Modal */}
      <BacklogPriorityModal
        isOpen={Boolean(priorityItem)}
        item={priorityItem}
        onClose={() => setPriorityItem(null)}
        onSubmit={(newPriority) => {
          if (priorityItem) {
            handleUpdatePriority(priorityItem.id, newPriority);
          }
        }}
      />
    </div>
  );
}
