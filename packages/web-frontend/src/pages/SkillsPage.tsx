import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIO } from '../io/io-context';
import type { SkillDetail, SkillFileInfo, SkillMarketItem, SkillRiskScanResult } from '../io/types';
import { useChatStore } from '../state/chat-store';
import type { SkillInfo, TeamPanelState } from '../types/domain';
import { ShellLayout } from '../components/layout/ShellLayout';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightSidebar } from '../components/layout/RightSidebar';

const EMPTY_TEAM_VIEW: TeamPanelState = {
  teamName: null,
  status: 'idle',
  members: [],
  tasks: [],
  messages: [],
  eventFeed: []
};

export function SkillsPage() {
  const io = useIO();
  const navigate = useNavigate();
  const { state, dispatch } = useChatStore();

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [marketItems, setMarketItems] = useState<SkillMarketItem[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [skillFiles, setSkillFiles] = useState<SkillFileInfo[]>([]);
  const [skillRisk, setSkillRisk] = useState<SkillRiskScanResult | null>(null);

  const [importFolderPath, setImportFolderPath] = useState('');
  const [importTargetName, setImportTargetName] = useState('');
  const [marketQuery, setMarketQuery] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(false);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [busyMarketSkillId, setBusyMarketSkillId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const createSession = async (): Promise<void> => {
    try {
      const session = await io.createSession();
      dispatch({ type: 'upsert_session', session });
      dispatch({ type: 'set_current_session', sessionId: session.id });
      navigate('/');
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '新建会话失败');
    }
  };

  const loadSkills = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [data, sessions] = await Promise.all([io.listSkills(), io.listSessions()]);
      setSkills(data);
      dispatch({ type: 'set_sessions', sessions });

      if (selectedSkill) {
        const exists = data.some((item) => item.id === selectedSkill.id);
        if (!exists) {
          setSelectedSkill(null);
          setSkillFiles([]);
          setSkillRisk(null);
        }
      }
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMarket = async (query = marketQuery): Promise<void> => {
    setMarketLoading(true);
    try {
      const items = await io.listSkillMarket(query.trim());
      setMarketItems(items);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '加载 Skill 市场失败');
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    void loadSkills();
    void loadMarket('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const refreshDetail = async (skillId: string): Promise<void> => {
    setBusySkillId(skillId);
    setError(null);

    try {
      const [detail, files, risk] = await Promise.all([
        io.readSkill(skillId),
        io.listSkillFiles(skillId),
        io.scanSkillRisk(skillId)
      ]);

      setSelectedSkill(detail);
      setSkillFiles(files);
      setSkillRisk(risk);
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '读取 Skill 详情失败');
    } finally {
      setBusySkillId(null);
    }
  };

  const installSkill = async (skillId: string): Promise<void> => {
    setBusySkillId(skillId);
    setError(null);

    try {
      const result = await io.installSkill(skillId);
      setSkills((current) => current.map((item) => (item.id === result.id ? result : item)));
      if (selectedSkill?.id === skillId) {
        await refreshDetail(skillId);
      }
      setMarketItems((current) =>
        current.map((item) => (item.id === skillId ? { ...item, installed: true } : item))
      );
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '安装失败');
    } finally {
      setBusySkillId(null);
    }
  };

  const deleteSkill = async (skillId: string): Promise<void> => {
    setBusySkillId(skillId);
    setError(null);

    try {
      await io.deleteSkill(skillId);
      setSkills((current) => current.filter((item) => item.id !== skillId));
      if (selectedSkill?.id === skillId) {
        setSelectedSkill(null);
        setSkillFiles([]);
        setSkillRisk(null);
      }
      setMarketItems((current) =>
        current.map((item) => (item.id === skillId ? { ...item, installed: false } : item))
      );
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '删除失败');
    } finally {
      setBusySkillId(null);
    }
  };

  const importFolder = async (): Promise<void> => {
    if (!importFolderPath.trim()) {
      setError('请先填写目录路径');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const imported = await io.importSkillFolder({
        folderPath: importFolderPath.trim(),
        targetName: importTargetName.trim() || undefined,
        overwrite: true
      });

      setSkills((current) => {
        const exists = current.some((item) => item.id === imported.id);
        if (exists) {
          return current.map((item) => (item.id === imported.id ? imported : item));
        }
        return [...current, imported].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      });

      setImportFolderPath('');
      setImportTargetName('');
      await refreshDetail(imported.id);
      void loadMarket();
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const installMarketSkill = async (item: SkillMarketItem): Promise<void> => {
    setBusyMarketSkillId(item.id);
    setError(null);
    try {
      const installed = await io.installSkillFromMarket({
        skillId: item.id,
        targetName: item.id,
        overwrite: true
      });

      setSkills((current) => {
        const exists = current.some((entry) => entry.id === installed.id);
        if (exists) {
          return current.map((entry) => (entry.id === installed.id ? installed : entry));
        }
        return [...current, installed].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      });
      setMarketItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, installed: true } : entry))
      );
    } catch (incoming) {
      setError(incoming instanceof Error ? incoming.message : '市场安装失败');
    } finally {
      setBusyMarketSkillId(null);
    }
  };

  const riskClass = (riskLevel: SkillInfo['riskLevel']): string => {
    if (riskLevel === 'high') {
      return 'pill-error';
    }
    if (riskLevel === 'medium') {
      return 'pill-warning';
    }
    return 'pill-success';
  };

  return (
    <ShellLayout
      left={
        <LeftSidebar
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onSelectSession={(sessionId) => {
            dispatch({ type: 'set_current_session', sessionId });
            navigate('/');
          }}
          onCreateSession={() => void createSession()}
        />
      }
      center={
        <section className='chat-panel'>
          <header className='panel-header'>
            <div>
              <p className='eyebrow'>Skill Hub</p>
              <h2>Skill 管理中心</h2>
            </div>
            <button type='button' className='ghost-button' onClick={() => void loadSkills()} disabled={loading}>
              刷新
            </button>
          </header>

          <p className='empty-hint'>统一管理本地 Skill、市场安装与风险扫描，支持与多 Agent 协作组合使用。</p>

          <div className='panel'>
            <div className='panel-header'>
              <h3>Skill 市场</h3>
              <button
                type='button'
                className='ghost-button'
                onClick={() => void loadMarket()}
                disabled={marketLoading}
              >
                刷新市场
              </button>
            </div>
            <div className='settings-item'>
              <div className='settings-form-grid'>
                <input
                  value={marketQuery}
                  onChange={(event) => setMarketQuery(event.target.value)}
                  placeholder='搜索 Skill（名称/描述/标签）'
                />
              </div>
              <button
                type='button'
                className='primary-button'
                onClick={() => void loadMarket()}
                disabled={marketLoading}
              >
                {marketLoading ? '搜索中...' : '搜索'}
              </button>
            </div>
            {marketLoading ? (
              <p className='small-text'>市场数据加载中...</p>
            ) : marketItems.length === 0 ? (
              <p className='small-text'>当前没有可用市场 Skill，请检查市场配置。</p>
            ) : (
              <ul className='market-list'>
                {marketItems.map((item) => {
                  const busy = busyMarketSkillId === item.id;
                  const disabled = item.installed || busy;
                  return (
                    <li key={item.id} className='market-item market-item-modern'>
                      <div>
                        <div className='panel-header'>
                          <strong>{item.name}</strong>
                          <span className='small-text'>v{item.version}</span>
                        </div>
                        <p className='small-text'>{item.description || '无描述'}</p>
                        <div className='chip-row'>
                          <span className='chip'>来源: {item.source || '-'}</span>
                          <span className='chip'>类型: {item.sourceType}</span>
                          {item.tags.map((tag) => (
                            <span key={`${item.id}-${tag}`} className='chip'>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className='row-actions'>
                        <button
                          type='button'
                          className={item.installed ? 'primary-button' : 'ghost-button'}
                          disabled={disabled}
                          onClick={() => void installMarketSkill(item)}
                        >
                          {busy ? '安装中...' : item.installed ? '已安装' : '一键安装'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <article className='settings-card'>
            <div className='settings-form-grid'>
              <input
                data-testid='skill-import-folder'
                value={importFolderPath}
                onChange={(event) => setImportFolderPath(event.target.value)}
                placeholder='导入目录（绝对或相对路径）'
              />
              <input
                data-testid='skill-import-target'
                value={importTargetName}
                onChange={(event) => setImportTargetName(event.target.value)}
                placeholder='目标目录名（可选）'
              />
            </div>
            <button data-testid='skill-import-submit' type='button' className='primary-button' disabled={importing} onClick={() => void importFolder()}>
              {importing ? '导入中...' : '导入目录'}
            </button>
          </article>

          {error && <p className='error-text'>{error}</p>}

          {loading ? (
            <p>加载中...</p>
          ) : skills.length === 0 ? (
            <p className='empty-hint'>暂无可用 Skill。</p>
          ) : (
            <ul className='settings-list' data-testid='skill-list'>
              {skills.map((skill) => (
                <li key={skill.id} className='settings-item settings-item-vertical' data-testid={`skill-item-${skill.id}`}>
                  <div>
                    <strong>{skill.name}</strong>
                    <p>{skill.description || '无描述'}</p>
                    <span className={`pill ${riskClass(skill.riskLevel)}`}>风险: {skill.riskLevel}</span>
                  </div>
                  <div className='row-actions'>
                    <button
                      data-testid={`skill-detail-${skill.id}`}
                      type='button'
                      className='ghost-button'
                      onClick={() => void refreshDetail(skill.id)}
                      disabled={busySkillId === skill.id}
                    >
                      详情
                    </button>
                    <button
                      data-testid={`skill-install-${skill.id}`}
                      type='button'
                      className={skill.installed ? 'primary-button' : 'ghost-button'}
                      disabled={skill.installed || busySkillId === skill.id}
                      onClick={() => void installSkill(skill.id)}
                    >
                      {skill.installed ? '已安装' : '安装'}
                    </button>
                    <button
                      data-testid={`skill-delete-${skill.id}`}
                      type='button'
                      className='danger-button'
                      disabled={busySkillId === skill.id}
                      onClick={() => void deleteSkill(skill.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedSkill && (
            <div className='panel space-top'>
              <div className='panel-header'>
                <h2>{selectedSkill.name} 详情</h2>
                <span className={`pill ${riskClass(selectedSkill.riskLevel)}`}>风险: {selectedSkill.riskLevel}</span>
              </div>
              <p className='small-text'>路径: {selectedSkill.rootPath || '-'}</p>
              <p className='small-text'>版本: {selectedSkill.version || '-'}</p>
              <p className='small-text'>来源: {selectedSkill.source || '-'}</p>
              <p className='small-text'>安装时间: {selectedSkill.installedAt || '-'}</p>

              {skillRisk && (
                <p className='small-text'>
                  风险扫描: total={skillRisk.summary.issueCount}, high={skillRisk.summary.highCount},
                  medium={skillRisk.summary.mediumCount}, low={skillRisk.summary.lowCount}
                </p>
              )}

              <p className='small-text'>文件数: {skillFiles.length}</p>
              {skillFiles.length > 0 && (
                <p className='small-text'>
                  文件样例: {skillFiles.slice(0, 5).map((item) => item.path).join('，')}
                </p>
              )}
            </div>
          )}
        </section>
      }
      right={
        <RightSidebar
          suggestions={[]}
          teamView={EMPTY_TEAM_VIEW}
          onSaveSuggestion={() => undefined}
          onIgnoreSuggestion={() => undefined}
        />
      }
    />
  );
}
