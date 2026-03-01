import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShellLayout } from '../components/layout/ShellLayout';

describe('ShellLayout', () => {
  it('默认不展示协作面板，点击后可打开', async () => {
    localStorage.removeItem('okclaw.focus-mode');
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

    await user.click(screen.getByRole('button', { name: '协作面板' }));
    expect(screen.getByText('right-panel')).toBeInTheDocument();
  });
});
