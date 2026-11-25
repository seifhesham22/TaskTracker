import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BoardView } from '../components/board/BoardView';
import { useBoard } from '../hooks/useBoard';
import './pages.css';

const DEFAULT_SEED_BOARD_ID = '01a1aad8-c24a-73f9-a095-069769796312';

export function TasksPage() {
  const navigate = useNavigate();
  const { boardId: paramBoardId } = useParams<{ boardId?: string }>();
  const [searchParams] = useSearchParams();
  const boardId = paramBoardId || searchParams.get('boardId') || DEFAULT_SEED_BOARD_ID;

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
    incompleteSubtasksError,
    clearMoveError,
    clearIncompleteSubtasksError,
    reload,
    handleCreateTask,
    handleCreateSubtask,
    handleMoveTask,
    handleUpdateTask,
    handleAddDependency,
    handleSearchTasks,
  } = useBoard(boardId);

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
        incompleteSubtasksError={incompleteSubtasksError}
        onClearMoveError={clearMoveError}
        onClearIncompleteSubtasksError={clearIncompleteSubtasksError}
        onReload={reload}
        onCreateTask={handleCreateTask}
        onCreateSubtask={handleCreateSubtask}
        onMoveTask={handleMoveTask}
        onUpdateTask={handleUpdateTask}
        onAddDependency={handleAddDependency}
        onSearchTasks={handleSearchTasks}
      />
    </div>
  );
}
