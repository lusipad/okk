import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellLayout } from '../components/layout/ShellLayout';

interface DesktopShellBridgeMock {
  search?: {
    focusMainWindow: ReturnType<typeof vi.fn>;
    onQuery: ReturnType<typeof vi.fn>;
  };
  files?: {
    pick: ReturnType<typeof vi.fn>;
  };
}

describe('ShellLayout', () => {
  beforeEach(() => {
    localStorage.removeItem('okk.focus-mode');
    localStorage.removeItem('okk.right-panel-open');
    delete (window as Window & { okkDesktop?: DesktopShellBridgeMock }).okkDesktop;
  });

  afterEach(() => {
    delete (window as Window & { okkDesktop?: DesktopShellBridgeMock }).okkDesktop;
  });

  it('默认不展示协作面板，点击后可打开', async () => {
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

  it('支持自定义事件打开命令面板并规范化查询', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('okk:command-palette', {
          detail: {
            query: '  skills  '
          }
        })
      );
    });

    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('skills')).toBeInTheDocument();
  });

  it('支持 Ctrl/Cmd + Shift + L 切换专注模式', async () => {
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

  it('支持桌面搜索 query 打开命令面板并带入查询', () => {
    let listener: ((query: string) => void) | undefined;
    const unsubscribe = vi.fn();
    const onQuery = vi.fn((callback: (query: string) => void) => {
      listener = callback;
      return unsubscribe;
    });

    (window as Window & { okkDesktop?: DesktopShellBridgeMock }).okkDesktop = {
      search: {
        focusMainWindow: vi.fn(),
        onQuery
      }
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    expect(onQuery).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '命令面板' })).not.toBeInTheDocument();

    act(() => {
      listener?.('skills');
    });

    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('skills')).toBeInTheDocument();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('支持通过命令面板触发桌面文件选择', async () => {
    const user = userEvent.setup();
    const pick = vi.fn().mockResolvedValue(['D:/Repos/okclaw']);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    (window as Window & { okkDesktop?: DesktopShellBridgeMock }).okkDesktop = {
      files: {
        pick
      }
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('button', { name: '选择本地文件或目录 通过桌面原生文件选择器把路径注入当前工作台' }));

    await waitFor(() => {
      expect(pick).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'okk:desktop-files-selected'
        })
      );
    });
  });

  it('读取持久化的协作面板状态', () => {
    localStorage.setItem('okk.right-panel-open', '1');
    render(
      <MemoryRouter initialEntries={['/']}>
        <ShellLayout
          left={<div>left-panel</div>}
          center={<div>center-panel</div>}
          right={<div>right-panel</div>}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('right-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '协作面板' })).toHaveAttribute('aria-expanded', 'true');
  });
});

