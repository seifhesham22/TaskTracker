import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useActiveProject } from '../context/activeProjectContextDef';
import { useProjects } from '../hooks/useProjects';
import { useWorkload } from '../hooks/useWorkload';
import { WorkloadComparisonList } from '../components/workload/WorkloadComparisonList';
import { WorkloadDrillDownView } from '../components/workload/WorkloadDrillDownView';
import { WorkloadSkeleton } from '../components/workload/WorkloadSkeleton';
import { WorkloadAccessRestrictedView } from '../components/workload/WorkloadAccessRestrictedView';
import './ProjectWorkloadPage.css';

export function ProjectWorkloadPage() {
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
      const boardId =
        activeProject?.boards && activeProject.boards.length > 0
          ? activeProject.boards[0].id
          : activeBoardId || null;
      setActiveProject(activeProjectId, boardId, activeProject?.name || null);
    }
  }, [activeProjectId, activeProject, activeBoardId, setActiveProject]);

  const {
    data,
    isLoading,
    error,
    accessRestricted,
    viewMode,
    selectedMember,
    reload,
    selectMember,
    selectUnassigned,
    backToOverview,
  } = useWorkload({
    projectId: activeProjectId,
  });

  const projectName = activeProject?.name || 'Project';

  const backLink = activeProject?.boards && activeProject.boards.length > 0
    ? `/boards/${activeProject.boards[0].id}`
    : '/projects';

  const handleBackToProject = () => {
    navigate(backLink);
  };

  // State 07: Role or access restriction (Owner only)
  const isOwner = activeProject ? activeProject.role?.toUpperCase() === 'OWNER' : true;
  if (accessRestricted || (!isLoading && activeProject && !isOwner)) {
    return (
      <div className="workload-page" data-testid="project-workload-page">
        <div className="workload-card-container">
          <header className="workload-header-bar">
            <p className="workload-breadcrumb">
              {projectName} / View open tasks by member
            </p>
          </header>
          <WorkloadAccessRestrictedView onBack={handleBackToProject} />
        </div>
      </div>
    );
  }

  return (
    <div className="workload-page" data-testid="project-workload-page">
      <div className="workload-card-container">
        {/* Header Breadcrumb */}
        <header className="workload-header-bar">
          <p className="workload-breadcrumb">
            {projectName} / View open tasks by member
          </p>
        </header>

        {/* State 04: Loading Current Assignments */}
        {isLoading && <WorkloadSkeleton projectName={projectName} />}

        {/* State 06: Request Failed */}
        {!isLoading && error && (
          <div className="workload-drilldown-container" data-testid="workload-error-container">
            <header className="workload-card-header">
              <h3 className="workload-card-title">Team workload</h3>
              <p className="workload-card-subtitle">{projectName} · Open tasks</p>
            </header>

            <div className="workload-error-box" role="alert" data-testid="workload-error-box">
              {error}
            </div>

            <button
              type="button"
              className="workload-btn-primary"
              data-testid="workload-retry-btn"
              onClick={reload}
            >
              Try again
            </button>
          </div>
        )}

        {/* Main Content when loaded without errors */}
        {!isLoading && !error && data && (
          <>
            {/* State 02: Member Drill-Down */}
            {viewMode === 'member_drilldown' && selectedMember && (
              <WorkloadDrillDownView
                title={`${selectedMember.userName}’s open tasks`}
                projectName={projectName}
                tasks={selectedMember.openTasks}
                onBack={backToOverview}
              />
            )}

            {/* State 03: Unassigned Open Work Drill-Down */}
            {viewMode === 'unassigned_drilldown' && (
              <WorkloadDrillDownView
                title="Unassigned work"
                projectName={projectName}
                tasks={data.unassigned}
                onBack={backToOverview}
              />
            )}

            {/* Overview Mode: State 01 or State 05 */}
            {viewMode === 'overview' && (
              <>
                <header className="workload-card-header">
                  <h3 className="workload-card-title">Team workload</h3>
                  <p className="workload-card-subtitle">{projectName} · Open tasks</p>
                </header>

                {/* State 05: No open work in project */}
                {data.totalOpenTasks === 0 ? (
                  <div className="workload-drilldown-container" data-testid="workload-zero-container">
                    <div className="workload-zero-box" data-testid="workload-zero-box">
                      No open tasks in this project.
                    </div>

                    <div className="workload-zero-members" role="list">
                      {data.members.map((member) => (
                        <div
                          key={member.userId}
                          className="workload-zero-member-row"
                          data-testid={`workload-zero-member-${member.userId}`}
                        >
                          <strong className="workload-zero-member-name">{member.userName}</strong>
                          <p className="workload-zero-member-tasks">0 open tasks</p>
                        </div>
                      ))}
                    </div>

                    <Link
                      to={backLink}
                      className="workload-btn-secondary"
                      data-testid="workload-zero-back-btn"
                    >
                      Back to project
                    </Link>
                  </div>
                ) : (
                  /* State 01: Compare member workload */
                  <>
                    <p className="workload-card-caption">Counts exclude completed tasks.</p>
                    <WorkloadComparisonList
                      members={data.members}
                      unassignedCount={data.unassigned.length}
                      onSelectMember={selectMember}
                      onSelectUnassigned={selectUnassigned}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
