import { useParams, useSearchParams } from 'react-router';
import { BoardView } from '../components/board/BoardView';
import { useBoard } from '../hooks/useBoard';
import './pages.css';

const DEFAULT_SEED_BOARD_ID = '01a1aad8-c24a-73f9-a095-069769796312';

export function TasksPage() {
  const { boardId: paramBoardId } = useParams<{ boardId?: string }>();
  const [searchParams] = useSearchParams();
  const boardId = paramBoardId || searchParams.get('boardId') || DEFAULT_SEED_BOARD_ID;

  const {
    board,
    tasks,
    isLoading,
    error,
    isNotFound,
    isCreatingTask,
    createTaskError,
    savingTaskIds,
    moveError,
    clearMoveError,
    reload,
    handleCreateTask,
    handleMoveTask,
  } = useBoard(boardId);

  return (
    <div className="tasks-page">
      <BoardView
        board={board}
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        isNotFound={isNotFound}
        isCreatingTask={isCreatingTask}
        createTaskError={createTaskError}
        savingTaskIds={savingTaskIds}
        moveError={moveError}
        onClearMoveError={clearMoveError}
        onReload={reload}
        onCreateTask={handleCreateTask}
        onMoveTask={handleMoveTask}
      />
    </div>
  );
}
