import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectAccessView } from './ProjectAccessView';

describe('ProjectAccessView', () => {
  it('renders State 01: Verify access first (checking) with accessible attributes', () => {
    render(<ProjectAccessView accessState="checking" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Checking access' })).toBeInTheDocument();
    expect(screen.getByText('Please wait…')).toBeInTheDocument();
    expect(screen.getByText('Loading your permitted workspace…')).toBeInTheDocument();
    expect(
      screen.getByText('Private boards and tasks remain hidden until access is confirmed.')
    ).toBeInTheDocument();
  });

  it('renders State 03: No access or unavailable and triggers back callback', async () => {
    const handleBack = vi.fn();
    const user = userEvent.setup();

    render(<ProjectAccessView accessState="unavailable" onBackToProjects={handleBack} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Project unavailable' })).toBeInTheDocument();
    expect(
      screen.getByText('You don’t have access, or this project is unavailable.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Return to your projects. If you need access, contact a project Owner.')
    ).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: 'Back to projects' });
    await user.click(backButton);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('renders State 04: Access revoked during use', async () => {
    const handleBack = vi.fn();
    const user = userEvent.setup();

    render(<ProjectAccessView accessState="revoked" onBackToProjects={handleBack} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your project access has changed' })
    ).toBeInTheDocument();
    expect(screen.getByText('You no longer have access to this project.')).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: 'Back to projects' });
    await user.click(backButton);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('renders State 05: Session expired and triggers login callback', async () => {
    const handleLogin = vi.fn();
    const user = userEvent.setup();

    render(<ProjectAccessView accessState="session_expired" onLogin={handleLogin} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Your session has expired' })).toBeInTheDocument();
    expect(screen.getByText('Log in again to continue.')).toBeInTheDocument();
    expect(
      screen.getByText('Private project content is hidden until your session and membership are verified.')
    ).toBeInTheDocument();

    const loginButton = screen.getByRole('button', { name: 'Log in' });
    await user.click(loginButton);
    expect(handleLogin).toHaveBeenCalledTimes(1);
  });

  it('renders State 06: Recoverable connection error with Try again and Back to projects', async () => {
    const handleRetry = vi.fn();
    const handleBack = vi.fn();
    const user = userEvent.setup();

    render(
      <ProjectAccessView
        accessState="connection_error"
        onRetry={handleRetry}
        onBackToProjects={handleBack}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Couldn’t connect' })).toBeInTheDocument();
    expect(screen.getByText('We couldn’t check project access.')).toBeInTheDocument();
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Try again' });
    await user.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);

    const backButton = screen.getByRole('button', { name: 'Back to projects' });
    await user.click(backButton);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
