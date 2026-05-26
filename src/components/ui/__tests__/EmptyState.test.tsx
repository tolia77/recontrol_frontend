import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { EmptyState } from '../EmptyState';

afterEach(() => cleanup());

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeDefined();
  });

  it('renders icon slot when provided', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">icon</span>} />);
    expect(screen.getByTestId('icon')).toBeDefined();
  });

  it('renders action slot when provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button data-testid="action-btn">Create</button>}
      />,
    );
    expect(screen.getByTestId('action-btn')).toBeDefined();
  });

  it('does not render icon slot when not provided', () => {
    render(<EmptyState title="Empty" />);
    // No icon wrapper present
    expect(screen.queryByTestId('icon')).toBeNull();
  });

  it('applies optional className to the container', () => {
    const { container } = render(<EmptyState title="Empty" className="extra" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('extra');
  });
});
