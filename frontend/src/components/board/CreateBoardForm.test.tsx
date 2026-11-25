import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateBoardForm } from './CreateBoardForm';

describe('CreateBoardForm', () => {
  const defaultProps = {
    projectName: 'Website redesign',
    isSubmitting: false,
    fieldErrors: {},
    formError: null,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders form elements matching Figma State 02', () => {
    render(<CreateBoardForm {...defaultProps} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Create a board' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign')).toBeInTheDocument();
    expect(screen.getByLabelText(/board name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a board name')).toBeInTheDocument();
    expect(
      screen.getByText('This board will belong to Website redesign.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create board' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('displays empty name validation error matching Figma State 03', () => {
    render(
      <CreateBoardForm
        {...defaultProps}
        fieldErrors={{ name: 'Enter a board name.' }}
      />
    );

    const input = screen.getByTestId('board-name-input');
    expect(input).toHaveClass('create-board-input--error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('board-name-error')).toHaveTextContent('Enter a board name.');
  });

  it('displays duplicate name validation error matching Figma State 04', () => {
    render(
      <CreateBoardForm
        {...defaultProps}
        fieldErrors={{ name: 'A board with this name already exists in this project.' }}
      />
    );

    const input = screen.getByTestId('board-name-input');
    expect(input).toHaveClass('create-board-input--error');
    expect(screen.getByTestId('board-name-error')).toHaveTextContent(
      'A board with this name already exists in this project.'
    );
  });

  it('renders disabled controls and pending text in State 05', () => {
    render(<CreateBoardForm {...defaultProps} isSubmitting={true} />);

    expect(screen.getByTestId('board-name-input')).toBeDisabled();
    const submitBtn = screen.getByTestId('create-board-submit-btn');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Creating…');
    expect(screen.getByTestId('create-board-cancel-btn')).toBeDisabled();
  });

  it('renders generic error banner in State 07', () => {
    render(
      <CreateBoardForm
        {...defaultProps}
        formError="Couldn’t create the board. Your name is kept. Try again."
      />
    );

    expect(screen.getByTestId('board-create-error')).toHaveTextContent(
      'Couldn’t create the board. Your name is kept. Try again.'
    );
    expect(screen.getByTestId('create-board-submit-btn')).toBeEnabled();
  });

  it('submits entered name and allows cancel', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(null);
    const onCancel = vi.fn();

    render(<CreateBoardForm {...defaultProps} onSubmit={onSubmit} onCancel={onCancel} />);

    await user.type(screen.getByTestId('board-name-input'), 'Sprint 3');
    await user.click(screen.getByTestId('create-board-submit-btn'));

    expect(onSubmit).toHaveBeenCalledWith('Sprint 3');

    await user.click(screen.getByTestId('create-board-cancel-btn'));
    expect(onCancel).toHaveBeenCalled();
  });
});
