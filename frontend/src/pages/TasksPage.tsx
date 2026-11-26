import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { BoardView } from '../components/board/BoardView';
import { useActiveProject } from '../context/activeProjectContextDef';
import { useBoard } from '../hooks/useBoard';
import { useProjects } from '../hooks/useProjects';
import './pages.css';

const DEFAULT_SEED_BOARD_ID = '01a1aad8-c24a-73f9-a095-069769796312';

export function TasksPage() {
  const navigate = useNavigate();
  const { boardId: paramBoardId } = useParams<{ boardId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeBoardId, activeProjectId, setActiveProject } = useActiveProject();
  const { projects } = useProjects(user?.id);

  // Dynamically resolve the effective board:
  // 1. Explicit path parameter /boards/:boardId
  // 2. Query param ?boardId=...
  // 3. Query param ?projectId=... -> first board of that project
  // 4. Active board cached from the project on screen
  // 5. Active project cached -> first board of that project
  // 6. User's first project's first board
  // 7. Test fallback seed board
  const effectiveBoardId = useMemo(() => {
    if (paramBoardId) return paramBoardId;
    const qBoardId = searchParams.get('boardId');
    if (qBoardId) return qBoardId;

    const qProjectId = searchParams.get('projectId') || activeProjectId;
    if (qProjectId && projects.length > 0) {
      const targetProj = projects.find((p) => p.id === qProjectId);
      if (targetProj && targetProj.boards && targetProj.boards.length > 0) {
        return targetProj.boards[0].id;
      }
    }

    if (activeBoardId) return activeBoardId;

    if (projects.length > 0 && projects[0].boards && projects[0].boards.length > 0) {
      return projects[0].boards[0].id;
    }

    return DEFAULT_SEED_BOARD_ID;
  }, [paramBoardId, searchParams, activeProjectId, activeBoardId, projects]);

  const {
    board,
    tasks,
    isLoading,
    error,
    isNotFound,
    accessState,
    isCreatingTask,
    createTaskError,
    savingTaskIds,
    moveError,
    moveRevertedBanner,
    incompleteSubtasksError,
    blockedStartError,
    clearMoveError,
    clearIncompleteSubtasksError,
    clearBlockedStartError,
    handleRecheckBlockers,
    handleStartBlockedTask,
    reload,
    handleCreateTask,
    handleCreateSubtask,
    handleMoveTask,
    handleUpdateTask,
    handleAddDependency,
    handleSearchTasks,
    handleAssignTask,
    handleUnassignTask,
  } = useBoard(effectiveBoardId);

  // Sync active project and board with context as soon as board data loads
  useEffect(() => {
    if (board?.projectId && board?.id) {
      setActiveProject(board.projectId, board.id, board.projectName || board.name);
    }
  }, [board, setActiveProject]);

  const isCreated = searchParams.get('created') === 'true';
  const queryProjectName = searchParams.get('projectName');
  const targetProjectName = queryProjectName || board?.projectName || 'project';
  const createdBanner = isCreated
    ? `✓ Board created in ${targetProjectName}.`
    : null;
  const backToBoardsUrl =
    searchParams.get('projectId') || (board ? `/projects/${board.projectId}/boards` : null);

  const handleBackToProjects = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  const handleLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className="tasks-page">
      <BoardView
        board={board}
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        isNotFound={isNotFound}
        accessState={accessState}
        onBackToProjects={handleBackToProjects}
        onLogin={handleLogin}
        createdBanner={createdBanner}
        backToBoardsUrl={backToBoardsUrl}
        isCreatingTask={isCreatingTask}
        createTaskError={createTaskError}
        savingTaskIds={savingTaskIds}
        moveError={moveError}
        moveRevertedBanner={moveRevertedBanner}
        incompleteSubtasksError={incompleteSubtasksError}
        blockedStartError={blockedStartError}
        onClearMoveError={clearMoveError}
        onClearIncompleteSubtasksError={clearIncompleteSubtasksError}
        onClearBlockedStartError={clearBlockedStartError}
        onRecheckBlockers={handleRecheckBlockers}
        onStartBlockedTask={handleStartBlockedTask}
        onReload={reload}
        onCreateTask={handleCreateTask}
        onCreateSubtask={handleCreateSubtask}
        onMoveTask={handleMoveTask}
        onUpdateTask={handleUpdateTask}
        onAddDependency={handleAddDependency}
        onSearchTasks={handleSearchTasks}
        onAssignTask={handleAssignTask}
        onUnassignTask={handleUnassignTask}
      />
    </div>
  );
}
