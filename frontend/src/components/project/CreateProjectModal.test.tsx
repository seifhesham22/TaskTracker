import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateProjectModal } from './CreateProjectModal';
import type { ProjectSummary } from '../../api/services/AuthService';

describe('CreateProjectModal', () => {
  const mockProject: ProjectSummary = {
    id: 'p-1',
    key: 'WEBS',
    name: 'Website redesign',
    role: 'OWNER',
    boards: [{ id: 'b-1', name: 'Board' }],
  };

  it('renders dialog form with project name input, helper text, and action buttons', () => {
    render(
      <CreateProjectModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create a project/i })).toBeInTheDocument();
    expect(screen.getByText('Give your team a shared workspace.')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name \*/i)).toBeInTheDocument();
    expect(screen.getByText('Required field. You will become this project’s Owner.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create project$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('auto-focuses the project name input upon opening', () => {
    render(
      <CreateProjectModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/project name \*/i);
    expect(input).toHaveFocus();
  });

  it('rejects empty or whitespace-only name and displays "Enter a project name."', async () => {
    const onSubmit = vi.fn();

    render(
      <CreateProjectModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /^create project$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Enter a project name.')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name \*/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();

    // Whitespace only
    const input = screen.getByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Enter a project name.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows creating state, disables controls, and prevents duplicate submissions while pending', async () => {
    let resolveSubmit: (val: ProjectSummary) => void = () => {};
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<ProjectSummary>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const onClose = vi.fn();

    render(
      <CreateProjectModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: 'Website redesign' } });

    const submitBtn = screen.getByRole('button', { name: /^create project$/i });
    fireEvent.click(submitBtn);

    // State 05: Creating project
    expect(screen.getByRole('button', { name: /creating…/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(input).toBeDisabled();

    // Prevent duplicate submit clicks
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Prevent closing while submitting
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    // Resolve submission
    resolveSubmit(mockProject);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onSubmit with trimmed name, triggers onSuccess, and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(mockProject);
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <CreateProjectModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    const input = screen.getByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: '  Website redesign  ' } });

    const submitBtn = screen.getByRole('button', { name: /^create project$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Website redesign' });
      expect(onSuccess).toHaveBeenCalledWith(mockProject);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('retains typed name and displays error banner when submission fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Server error'));
    const onClose = vi.fn();

    render(
      <CreateProjectModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: 'Retained Name' } });

    const submitBtn = screen.getByRole('button', { name: /^create project$/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Couldn’t create the project. Your name is kept. Try again.')
    ).toBeInTheDocument();
    expect(input).toHaveValue('Retained Name');
    expect(submitBtn).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without saving when Cancel is clicked', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <CreateProjectModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
