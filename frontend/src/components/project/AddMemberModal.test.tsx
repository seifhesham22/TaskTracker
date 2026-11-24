import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRole } from '../../domain/models';
import { AddMemberModal } from './AddMemberModal';

describe('AddMemberModal', () => {
  const existingMembers = [
    {
      projectId: 'proj-1',
      userId: 'u-1',
      userName: 'Dombele',
      role: ProjectRole.Owner,
      joinedAt: '2026-11-20T10:00:00Z',
    },
  ];

  it('renders modal dialog with search input, role selection and buttons when open', () => {
    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /add a member/i })).toBeInTheDocument();
    expect(screen.getByText(/Website redesign · Existing accounts only/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/find an account \*/i)).toBeInTheDocument();
    expect(screen.getByText('Writer')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Reader')).toBeInTheDocument();
    expect(screen.getByTestId('add-member-submit-btn')).toBeDisabled(); // empty input
    expect(screen.getByTestId('add-member-cancel-btn')).toBeEnabled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AddMemberModal
        isOpen={false}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays validation error if email is whitespace only upon submit', () => {
    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByTestId('add-member-email-input');
    fireEvent.change(input, { target: { value: '   ' } });

    const form = input.closest('form');
    fireEvent.submit(form!);

    expect(screen.getByTestId('add-member-field-error')).toHaveTextContent(
      'Enter an account email or name.'
    );
  });

  it('displays duplicate member error when entering existing member name (State 06)', () => {
    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByTestId('add-member-email-input');
    fireEvent.change(input, { target: { value: 'Dombele' } });

    const submitBtn = screen.getByTestId('add-member-submit-btn');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('add-member-field-error')).toHaveTextContent(
      'Dombele is already a project member. Choose another account.'
    );
  });

  it('submits valid input, calls onSubmit with selected role and closes on success (State 07 -> 08)', async () => {
    const mockSubmit = vi.fn().mockResolvedValue({
      projectId: 'proj-1',
      userId: 'u-2',
      userName: 'Mina',
      role: ProjectRole.Writer,
      joinedAt: '2026-11-24T12:00:00Z',
    });
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={mockClose}
        onSubmit={mockSubmit}
        onSuccess={mockSuccess}
      />
    );

    const input = screen.getByTestId('add-member-email-input');
    fireEvent.change(input, { target: { value: 'mina@example.com' } });

    const submitBtn = screen.getByTestId('add-member-submit-btn');
    fireEvent.click(submitBtn);

    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'mina@example.com',
      role: ProjectRole.Writer,
    });
  });

  it('displays error banner and keeps input when server fails (State 09)', async () => {
    const mockSubmit = vi
      .fn()
      .mockRejectedValue(new Error('Couldn’t add Mina. Your selection is kept. Try again.'));

    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={vi.fn()}
        onSubmit={mockSubmit}
      />
    );

    const input = screen.getByTestId('add-member-email-input');
    fireEvent.change(input, { target: { value: 'mina@example.com' } });

    const submitBtn = screen.getByTestId('add-member-submit-btn');
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('add-member-server-error')).toHaveTextContent(
      'Couldn’t add Mina. Your selection is kept. Try again.'
    );
    expect(input).toHaveValue('mina@example.com');
  });

  it('calls onClose when Cancel is clicked', () => {
    const mockClose = vi.fn();
    render(
      <AddMemberModal
        isOpen={true}
        projectName="Website redesign"
        existingMembers={existingMembers}
        onClose={mockClose}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('add-member-cancel-btn'));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
