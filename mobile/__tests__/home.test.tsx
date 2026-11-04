import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import HomeScreen from '../src/app/index';

describe('Home screen', () => {
  it('renders the app name and welcome message', async () => {
    await renderRouter({ index: HomeScreen });

    expect(screen.getByText('TaskTracker')).toBeOnTheScreen();
    expect(screen.getByText('Welcome! Track and manage your tasks on the go.')).toBeOnTheScreen();
  });

  it('offers no sample data and opens the boards', async () => {
    await renderRouter({ index: HomeScreen, 'boards/index': () => <Text>Boards list</Text> });

    expect(screen.queryByText(/sample/i)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText('View boards'));

    expect(screen).toHavePathname('/boards');
  });
});
