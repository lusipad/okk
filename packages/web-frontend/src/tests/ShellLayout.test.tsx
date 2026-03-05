import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';

describe('ShellLayout', () => {
  it('默认不展示协作面板，点击后可打开', async () => {
    localStorage.removeItem('okk.focus-mode');
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('left-panel')).toBeInTheDocument();
    expect(screen.getByText('center-panel')).toBeInTheDocument();
    expect(screen.queryByText('right-panel')).not.toBeInTheDocument();

    const collabButton = screen.getByRole('button', { name: '协作面板' });
    expect(collabButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(collabButton);
    expect(screen.getByText('right-panel')).toBeInTheDocument();
    expect(collabButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('支持 Ctrl/Cmd + K 打开命令面板', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog', { name: '命令面板' })).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument();
  });

  it('支持 Ctrl/Cmd + Shift + L 切换专注模式', async () => {
    localStorage.removeItem('okk.focus-mode');
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    const shellGrid = container.querySelector('.app-shell-grid');
    expect(shellGrid).not.toBeNull();
    expect(shellGrid).not.toHaveClass('focus-mode');
    expect(screen.getByRole('button', { name: '协作面板' })).toBeInTheDocument();

    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(shellGrid).toHaveClass('focus-mode');
    expect(screen.queryByRole('button', { name: '协作面板' })).not.toBeInTheDocument();

    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(shellGrid).not.toHaveClass('focus-mode');
    expect(screen.getByRole('button', { name: '协作面板' })).toBeInTheDocument();
  });
});
