import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useActiveProject } from '../context/activeProjectContextDef';
import { useProjects } from '../hooks/useProjects';
import { useBacklog } from '../hooks/useBacklog';
import { BacklogFilterBar } from '../components/backlog/BacklogFilterBar';
import { BacklogItemCard } from '../components/backlog/BacklogItemCard';
import { BacklogPagination } from '../components/backlog/BacklogPagination';
import { BacklogSkeleton } from '../components/backlog/BacklogSkeleton';
import './ProjectBacklogPage.css';

export function ProjectBacklogPage() {
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
    search,
    statusFilter,
    priorityFilter,
    setSearch,
    setStatusFilter,
    setPriorityFilter,
    setPage,
    reload,
  } = useBacklog({
    projectId: activeProjectId,
  });

  const projectName = activeProject?.name || 'Test Project';
  const projectKey = (activeProject?.name || activeProject?.key || 'TEST PROJECT').toUpperCase();
  const hasActiveFilters = Boolean(search.trim() || statusFilter || priorityFilter);

  const backLink = activeProject?.boards[0]?.id
    ? `/boards/${activeProject.boards[0].id}`
    : '/projects';

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
    </div>
  );
}
