import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import HomeScreen from '../src/app/index';
import TaskDetailsScreen from '../src/app/task-details';

describe('Home screen', () => {
  it('renders the app name and welcome message', async () => {
    await renderRouter({ index: HomeScreen });

    expect(screen.getByText('TaskTracker')).toBeOnTheScreen();
    expect(screen.getByText('Welcome! Track and manage your tasks on the go.')).toBeOnTheScreen();
  });

  it('opens the task details screen', async () => {
    await renderRouter({ index: HomeScreen, 'task-details': TaskDetailsScreen });

    await fireEvent.press(screen.getByText('View sample task'));

    expect(screen).toHavePathname('/task-details');
    expect(screen.getByText('Sample task')).toBeOnTheScreen();
  });
});
