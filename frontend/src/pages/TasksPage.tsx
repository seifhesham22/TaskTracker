import { useSearchParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { BoardView } from '../components/board/BoardView';
import { useBoard } from '../hooks/useBoard';
import './pages.css';

// Seeded board UUID from DbSeeder
const DEFAULT_SEED_BOARD_ID = '01a18766-48b5-7fb8-a04c-13e1bf648def';

export function TasksPage() {
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('boardId') || DEFAULT_SEED_BOARD_ID;

  const {
    board,
    tasks,
    isLoading,
    error,
    isNotFound,
    isCreatingTask,
    createTaskError,
    reload,
    handleCreateTask,
  } = useBoard(boardId);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <PageHeader
        eyebrow={board ? `${board.projectName} • Board` : 'Workspace'}
        title={board ? board.name : 'Task Board'}
      >
        <p>Plan, track and ship your team's tasks across each status column.</p>
      </PageHeader>

      <BoardView
        board={board}
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        isNotFound={isNotFound}
        isCreatingTask={isCreatingTask}
        createTaskError={createTaskError}
        onReload={reload}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}
