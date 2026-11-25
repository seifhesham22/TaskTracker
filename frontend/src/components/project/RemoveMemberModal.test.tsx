import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRole } from '../../domain/models';
import { RemoveMemberModal } from './RemoveMemberModal';

describe('RemoveMemberModal', () => {
  const member = {
    projectId: 'proj-1',
    userId: 'u-2',
    userName: 'Mina',
    role: ProjectRole.Writer,
    joinedAt: '2026-11-20T10:00:00Z',
  };

  it('renders remove confirmation dialog with explanation and buttons (State 10)', () => {
    render(
      <RemoveMemberModal
        isOpen={true}
        projectName="Website redesign"
        targetMember={member}
        isLastOwner={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /remove mina\?/i })).toBeInTheDocument();
    expect(screen.getByText('Website redesign')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Mina will lose access to this project’s boards and tasks. This does not delete their account or existing work./i
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('remove-member-confirm-btn')).toHaveTextContent('Remove');
    expect(screen.getByTestId('remove-member-cancel-btn')).toHaveTextContent('Keep member');
  });

  it('renders last-owner protection view when isLastOwner is true (State 14)', () => {
    const ownerMember = {
      ...member,
      userName: 'Dombele',
      role: ProjectRole.Owner,
    };

    render(
      <RemoveMemberModal
        isOpen={true}
        projectName="Website redesign"
        targetMember={ownerMember}
        isLastOwner={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /owner required/i })).toBeInTheDocument();
    expect(screen.getByTestId('last-owner-error')).toHaveTextContent(
      'You can’t remove the last Owner.'
    );
    expect(
      screen.getByText(/Keep at least one Owner in this project. No membership was changed./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('last-owner-close-btn')).toHaveTextContent('Keep Owner');
  });

  it('calls onConfirm when Remove is confirmed', async () => {
    const mockConfirm = vi.fn().mockResolvedValue(undefined);
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    render(
      <RemoveMemberModal
        isOpen={true}
        projectName="Website redesign"
        targetMember={member}
        isLastOwner={false}
        onClose={mockClose}
        onConfirm={mockConfirm}
        onSuccess={mockSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('remove-member-confirm-btn'));

    expect(mockConfirm).toHaveBeenCalledWith('u-2');
  });

  it('shows error banner when removal fails (State 13)', async () => {
    const mockConfirm = vi
      .fn()
      .mockRejectedValue(new Error('Couldn’t remove Mina. They are still a member. Try again.'));

    render(
      <RemoveMemberModal
        isOpen={true}
        projectName="Website redesign"
        targetMember={member}
        isLastOwner={false}
        onClose={vi.fn()}
        onConfirm={mockConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('remove-member-confirm-btn'));

    expect(await screen.findByTestId('remove-member-server-error')).toHaveTextContent(
      'Couldn’t remove Mina. They are still a member. Try again.'
    );
  });

  it('calls onClose when Keep member is clicked', () => {
    const mockClose = vi.fn();
    render(
      <RemoveMemberModal
        isOpen={true}
        projectName="Website redesign"
        targetMember={member}
        isLastOwner={false}
        onClose={mockClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('remove-member-cancel-btn'));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
