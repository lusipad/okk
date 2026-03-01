import { Link } from 'react-router-dom';

interface ActivationDockProps {
  loading: boolean;
  skillsInstalled: number;
  skillsTotal: number;
  mcpEnabled: number;
  mcpTotal: number;
}

function ratioText(active: number, total: number): string {
  if (total <= 0) {
    return '0 / 0';
  }
  return `${active} / ${total}`;
}

export function ActivationDock({
  loading,
  skillsInstalled,
  skillsTotal,
  mcpEnabled,
  mcpTotal
}: ActivationDockProps) {
  return (
    <section className='activation-dock' aria-label='Skills 与 MCP 快捷入口'>
      <div className='activation-inline'>
        <span className='small-text'>能力</span>
        <Link className='activation-inline-item' to='/skills'>
          Skills {ratioText(skillsInstalled, skillsTotal)}
        </Link>
        <Link className='activation-inline-item' to='/settings/mcp'>
          MCP {ratioText(mcpEnabled, mcpTotal)}
        </Link>
        <span className='small-text'>{loading ? '同步中...' : '已同步'}</span>
      </div>
    </section>
  );
}
