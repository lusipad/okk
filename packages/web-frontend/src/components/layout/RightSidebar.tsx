import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import type {
  CollaborationAction,
  CollaborationDiagnostics,
  CollaborationRunStatus,
  CollaborationSourceType,
  KnowledgeSuggestion,
  MissionCheckpointRecord,
  MissionHandoffRecord,
  MissionSummaryRecord,
  MissionWorkstreamRecord,
  TeamMemberEvent,
  TeamPanelState
} from '../../types/domain';
import type { RuntimeBackendHealth, TeamRunRecord } from '../../io/types';
import { KnowledgeSuggestionCard } from '../cards/KnowledgeSuggestionCard';
import type { SaveKnowledgeSuggestionDraft } from '../cards/KnowledgeSuggestionCard';

interface GraphPoint {
  x: number;
  y: number;
}

interface GraphPreference {
  scale: number;
  offset: GraphPoint;
  manualNodePositions: Record<string, GraphPoint>;
}

type RightSidebarTab = 'overview' | 'timeline' | 'graph' | 'knowledge';

const RIGHT_SIDEBAR_TAB_STORAGE_KEY = 'okk.right-sidebar.tab';

function isRightSidebarTab(value: string | null): value is RightSidebarTab {
  return value === 'overview' || value === 'timeline' || value === 'graph' || value === 'knowledge';
}

function readStoredRightSidebarTab(): RightSidebarTab | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(RIGHT_SIDEBAR_TAB_STORAGE_KEY);
    return isRightSidebarTab(value) ? value : null;
  } catch {
    return null;
  }
}

function persistRightSidebarTab(tab: RightSidebarTab): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RIGHT_SIDEBAR_TAB_STORAGE_KEY, tab);
  } catch {
    // ignore persistence failure
  }
}

function resolveDefaultTab(input: {
  pendingSuggestions: number;
  hasEvents: boolean;
  teamRunError: string | null;
}): RightSidebarTab {
  if (input.pendingSuggestions > 0) {
    return 'knowledge';
  }
  if (input.teamRunError || input.hasEvents) {
    return 'timeline';
  }
  return 'overview';
}

function formatRuntimeStatusLabel(status: CollaborationRunStatus | undefined): string {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'aborted') {
    return 'aborted';
  }
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'unavailable') {
    return 'unavailable';
  }
  if (status === 'queued') {
    return 'queued';
  }
  return 'running';
}

function getRuntimeStatusPillClass(status: CollaborationRunStatus | undefined): string {
  if (status === 'completed' || status === 'ready') {
    return 'pill-success';
  }
  if (status === 'failed' || status === 'aborted' || status === 'unavailable') {
    return 'pill-error';
  }
  return 'pill-running';
}

function formatSourceTypeLabel(sourceType: CollaborationSourceType | undefined): string {
  if (sourceType === 'agent') {
    return 'Agent';
  }
  if (sourceType === 'backend') {
    return 'Backend';
  }
  if (sourceType === 'skill') {
    return 'Skill';
  }
  if (sourceType === 'mcp') {
    return 'MCP';
  }
  if (sourceType === 'tool') {
    return 'Tool';
  }
  return 'Team';
}

function buildDiagnosticCopyText(input: {
  summary: string;
  runId?: string;
  sourceType?: CollaborationSourceType;
  diagnostics?: CollaborationDiagnostics;
}): string {
  const lines = [input.summary];
  if (input.runId) {
    lines.push(`Run: ${input.runId}`);
  }
  if (input.sourceType) {
    lines.push(`Source: ${input.sourceType}`);
  }
  if (input.diagnostics?.code) {
    lines.push(`Code: ${input.diagnostics.code}`);
  }
  if (input.diagnostics?.message) {
    lines.push(`Message: ${input.diagnostics.message}`);
  }
  if (input.diagnostics?.detail) {
    lines.push(`Detail: ${input.diagnostics.detail}`);
  }
  return lines.join('\n');
}

interface RightSidebarProps {
  suggestions: KnowledgeSuggestion[];
  teamView: TeamPanelState;
  teamRun?: TeamRunRecord | null;
  teamRuns?: TeamRunRecord[];
  missionSummary?: MissionSummaryRecord | null;
  missionWorkstreams?: MissionWorkstreamRecord[];
  missionCheckpoints?: MissionCheckpointRecord[];
  missionHandoffs?: MissionHandoffRecord[];
  runtimeBackends?: RuntimeBackendHealth[];
  teamRunPending?: boolean;
  teamRunError?: string | null;
  onStartTeamRun?: () => void;
  onRefreshTeamRuns?: () => void;
  onRefreshCapabilities?: () => void;
  onRetryLastMessage?: () => void;
  onOpenRoute?: (route: string) => void;
  onSaveSuggestion: (input: SaveKnowledgeSuggestionDraft) => void;
  onIgnoreSuggestion: (suggestionId: string) => void;
}

export function RightSidebar({
  suggestions,
  teamView,
  teamRun = null,
  teamRuns = [],
  missionSummary = null,
  missionWorkstreams = [],
  missionCheckpoints = [],
  missionHandoffs = [],
  runtimeBackends = [],
  teamRunPending = false,
  teamRunError = null,
  onStartTeamRun = () => undefined,
  onRefreshTeamRuns = () => undefined,
  onRefreshCapabilities = () => undefined,
  onRetryLastMessage = () => undefined,
  onOpenRoute = () => undefined,
  onSaveSuggestion,
  onIgnoreSuggestion
}: RightSidebarProps) {
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'pending').length;
  const hasTimelineEvents = teamView.eventFeed.length > 0;
  const storedActiveTab = useMemo(() => readStoredRightSidebarTab(), []);
  const [activeTab, setActiveTab] = useState<RightSidebarTab>(() =>
    storedActiveTab ??
    resolveDefaultTab({
      pendingSuggestions,
      hasEvents: hasTimelineEvents,
      teamRunError
    })
  );
  const [hasExplicitTabPreference, setHasExplicitTabPreference] = useState<boolean>(() => storedActiveTab !== null);
  const [timelineQuery, setTimelineQuery] = useState('');
  const [focusedEventIds, setFocusedEventIds] = useState<string[]>([]);
  const [selectedGraphTaskIds, setSelectedGraphTaskIds] = useState<string[]>([]);
  const [graphScale, setGraphScale] = useState(1);
  const [graphOffset, setGraphOffset] = useState({ x: 0, y: 0 });
  const [graphDragging, setGraphDragging] = useState(false);
  const [graphNodeDraggingTaskId, setGraphNodeDraggingTaskId] = useState<string | null>(null);
  const [manualNodePositions, setManualNodePositions] = useState<Record<string, GraphPoint>>({});
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const nodeDragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const nodeDragMovedRef = useRef(false);
  const backendReadyCount = runtimeBackends.filter((item) => item.available).length;
  const latestRuns = teamRuns.slice(0, 4);
  const openMissionCheckpoints = missionCheckpoints.filter((item) => item.status === 'open');
  const graphBaseWidth = 460;
  const graphPreferenceKey = useMemo(
    () => `okk.graph.preferences.${teamView.teamName ?? 'default'}`,
    [teamView.teamName]
  );
  const filteredTimelineEvents = useMemo(() => {
    const query = timelineQuery.trim().toLowerCase();
    if (!query) {
      return teamView.eventFeed;
    }
    return teamView.eventFeed.filter((event) => {
      const haystack = [
        event.type,
        event.summary,
        event.sourceType ?? '',
        event.status ?? '',
        event.runId ?? '',
        event.diagnostics?.message ?? '',
        event.diagnostics?.detail ?? '',
        event.diagnostics?.code ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [teamView.eventFeed, timelineQuery]);

  useEffect(() => {
    persistRightSidebarTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (hasExplicitTabPreference) {
      return;
    }

    setActiveTab(
      resolveDefaultTab({
        pendingSuggestions,
        hasEvents: hasTimelineEvents,
        teamRunError
      })
    );
  }, [hasExplicitTabPreference, hasTimelineEvents, pendingSuggestions, teamRunError]);

  const handleTabChange = (tab: RightSidebarTab): void => {
    setHasExplicitTabPreference(true);
    setActiveTab(tab);
  };
  const handleDiagnosticAction = (
    action: CollaborationAction,
    input: {
      summary: string;
      runId?: string;
      sourceType?: CollaborationSourceType;
      diagnostics?: CollaborationDiagnostics;
    }
  ): void => {
    if (action.kind === 'retry') {
      onRetryLastMessage();
      return;
    }

    if (action.kind === 'refresh') {
      if (input.sourceType === 'backend') {
        onRefreshCapabilities();
        return;
      }
      onRefreshTeamRuns();
      return;
    }

    if (action.kind === 'open_route') {
      if (action.route) {
        onOpenRoute(action.route);
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(buildDiagnosticCopyText(input));
  };
  const taskGraphNodes = useMemo(() => {
    const resolveDependencyTaskId = (dependency: string): string | null => {
      const direct = teamView.tasks.find((task) => task.taskId === dependency);
      if (direct) {
        return direct.taskId;
      }
      const suffix = `:${dependency}`;
      const bySuffix = teamView.tasks.find((task) => task.taskId.endsWith(suffix));
      if (bySuffix) {
        return bySuffix.taskId;
      }
      return null;
    };

    const normalizedTasks = teamView.tasks.map((task) => ({
      ...task,
      dependencyTaskIds: task.dependsOn
        .map((dependency) => resolveDependencyTaskId(dependency))
        .filter((value): value is string => Boolean(value)),
      dependencyText: task.dependsOn.length > 0 ? task.dependsOn.join(' -> ') : '无依赖'
    }));
    const normalizedTaskById = new Map(normalizedTasks.map((task) => [task.taskId, task]));
    const depthCache = new Map<string, number>();
    const visiting = new Set<string>();

    const resolveDepth = (taskId: string): number => {
      const cachedDepth = depthCache.get(taskId);
      if (cachedDepth !== undefined) {
        return cachedDepth;
      }
      if (visiting.has(taskId)) {
        return 0;
      }
      visiting.add(taskId);

      const task = normalizedTaskById.get(taskId);
      if (!task) {
        visiting.delete(taskId);
        depthCache.set(taskId, 0);
        return 0;
      }

      const dependencyDepths = task.dependencyTaskIds.map((dependencyTaskId) =>
        resolveDepth(dependencyTaskId)
      );
      const depth = dependencyDepths.length > 0 ? Math.max(...dependencyDepths) + 1 : 0;
      depthCache.set(taskId, depth);
      visiting.delete(taskId);
      return depth;
    };

    normalizedTasks.forEach((task) => {
      resolveDepth(task.taskId);
    });

    const depthGroups = new Map<number, typeof normalizedTasks>();
    normalizedTasks.forEach((task) => {
      const depth = depthCache.get(task.taskId) ?? 0;
      const group = depthGroups.get(depth) ?? [];
      group.push(task);
      depthGroups.set(depth, group);
    });

    const maxDepth = Math.max(0, ...Array.from(depthGroups.keys()));
    const columnSpacing = maxDepth === 0 ? 0 : Math.floor((graphBaseWidth - 190) / maxDepth);

    return normalizedTasks.map((task) => {
      const depth = depthCache.get(task.taskId) ?? 0;
      const depthGroup = depthGroups.get(depth) ?? [task];
      const indexInDepth = depthGroup.findIndex((item) => item.taskId === task.taskId);
      const autoX = 36 + depth * Math.max(150, columnSpacing);
      const autoY = 26 + indexInDepth * 102;
      const manualPosition = manualNodePositions[task.taskId];
      return {
        ...task,
        depth,
        x: manualPosition?.x ?? autoX,
        y: manualPosition?.y ?? autoY
      };
    });
  }, [manualNodePositions, teamView.tasks]);
  const taskGraphById = useMemo(
    () => new Map(taskGraphNodes.map((item) => [item.taskId, item])),
    [taskGraphNodes]
  );
  const taskDepthById = useMemo(
    () => new Map(taskGraphNodes.map((task) => [task.taskId, task.depth])),
    [taskGraphNodes]
  );
  const criticalPathNodeIds = useMemo(() => {
    if (taskGraphNodes.length === 0) {
      return [] as string[];
    }
    let tailTaskId: string | null = null;
    let tailDepth = -1;
    taskGraphNodes.forEach((task) => {
      const depth = taskDepthById.get(task.taskId) ?? 0;
      if (depth > tailDepth) {
        tailDepth = depth;
        tailTaskId = task.taskId;
      }
    });

    if (!tailTaskId) {
      return [];
    }

    const path: string[] = [];
    let currentTaskId: string | null = tailTaskId;
    while (currentTaskId) {
      path.unshift(currentTaskId);
      const currentNode = taskGraphById.get(currentTaskId);
      if (!currentNode || currentNode.dependencyTaskIds.length === 0) {
        break;
      }
      let nextTaskId: string | null = null;
      let nextDepth = -1;
      currentNode.dependencyTaskIds.forEach((dependencyTaskId) => {
        const dependencyDepth = taskDepthById.get(dependencyTaskId) ?? 0;
        if (dependencyDepth >= nextDepth) {
          nextDepth = dependencyDepth;
          nextTaskId = dependencyTaskId;
        }
      });
      currentTaskId = nextTaskId;
    }

    return path;
  }, [taskDepthById, taskGraphById, taskGraphNodes]);
  const criticalPathNodeSet = useMemo(
    () => new Set(criticalPathNodeIds),
    [criticalPathNodeIds]
  );
  const criticalPathEdgeSet = useMemo(() => {
    const edges = new Set<string>();
    for (let index = 1; index < criticalPathNodeIds.length; index += 1) {
      edges.add(`${criticalPathNodeIds[index - 1]}->${criticalPathNodeIds[index]}`);
    }
    return edges;
  }, [criticalPathNodeIds]);
  const taskGraphEdges = useMemo(
    () =>
      taskGraphNodes.flatMap((task) =>
        task.dependencyTaskIds.map((fromTaskId) => ({
          from: fromTaskId,
          to: task.taskId
        }))
      ),
    [taskGraphNodes]
  );
  const graphCanvasHeight = useMemo(() => {
    if (taskGraphNodes.length === 0) {
      return 160;
    }
    const maxNodeY = Math.max(...taskGraphNodes.map((task) => task.y));
    return Math.max(180, maxNodeY + 130);
  }, [taskGraphNodes]);
  const minimapWidth = 168;
  const minimapHeight = useMemo(
    () => Math.max(80, Math.round(graphCanvasHeight * 0.24)),
    [graphCanvasHeight]
  );
  const minimapScaleX = minimapWidth / graphBaseWidth;
  const minimapScaleY = minimapHeight / graphCanvasHeight;
  const graphViewport = useMemo(() => {
    const visibleWidth = graphBaseWidth / graphScale;
    const visibleHeight = graphCanvasHeight / graphScale;
    const rawX = -graphOffset.x / graphScale;
    const rawY = -graphOffset.y / graphScale;
    const x = Math.max(0, Math.min(graphBaseWidth - visibleWidth, rawX));
    const y = Math.max(0, Math.min(graphCanvasHeight - visibleHeight, rawY));
    return {
      x,
      y,
      width: Math.max(40, Math.min(graphBaseWidth, visibleWidth)),
      height: Math.max(28, Math.min(graphCanvasHeight, visibleHeight))
    };
  }, [graphCanvasHeight, graphOffset.x, graphOffset.y, graphScale, graphBaseWidth]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(graphPreferenceKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<GraphPreference>;
      const scale = typeof parsed.scale === 'number' ? parsed.scale : 1;
      const offset = parsed.offset;
      const manualPositions = parsed.manualNodePositions;
      setGraphScale(Math.min(1.8, Math.max(0.7, scale)));
      setGraphOffset({
        x: typeof offset?.x === 'number' ? offset.x : 0,
        y: typeof offset?.y === 'number' ? offset.y : 0
      });
      if (manualPositions && typeof manualPositions === 'object') {
        const cleaned: Record<string, GraphPoint> = {};
        Object.entries(manualPositions).forEach(([taskId, point]) => {
          if (
            point &&
            typeof point === 'object' &&
            typeof (point as GraphPoint).x === 'number' &&
            typeof (point as GraphPoint).y === 'number'
          ) {
            cleaned[taskId] = {
              x: (point as GraphPoint).x,
              y: (point as GraphPoint).y
            };
          }
        });
        setManualNodePositions(cleaned);
      } else {
        setManualNodePositions({});
      }
    } catch {
      // ignore malformed preference payload
    }
  }, [graphPreferenceKey]);
  useEffect(() => {
    try {
      const payload: GraphPreference = {
        scale: graphScale,
        offset: graphOffset,
        manualNodePositions
      };
      localStorage.setItem(graphPreferenceKey, JSON.stringify(payload));
    } catch {
      // ignore persistence failure
    }
  }, [graphOffset, graphPreferenceKey, graphScale, manualNodePositions]);
  useEffect(() => {
    const allowedTaskIds = new Set(teamView.tasks.map((task) => task.taskId));
    setManualNodePositions((current) => {
      const nextEntries = Object.entries(current).filter(([taskId]) => allowedTaskIds.has(taskId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [teamView.tasks]);
  useEffect(() => {
    if (!graphDragging) {
      return;
    }

    const onMouseMove = (event: MouseEvent): void => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }
      setGraphOffset({
        x: dragState.originX + (event.clientX - dragState.startX),
        y: dragState.originY + (event.clientY - dragState.startY)
      });
    };

    const onMouseUp = (): void => {
      setGraphDragging(false);
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [graphDragging]);
  useEffect(() => {
    if (!graphNodeDraggingTaskId) {
      return;
    }

    const onMouseMove = (event: MouseEvent): void => {
      const dragState = nodeDragStateRef.current;
      if (!dragState) {
        return;
      }
      const deltaX = (event.clientX - dragState.startX) / graphScale;
      const deltaY = (event.clientY - dragState.startY) / graphScale;
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        nodeDragMovedRef.current = true;
      }

      setManualNodePositions((current) => ({
        ...current,
        [graphNodeDraggingTaskId]: {
          x: Math.max(10, Math.min(graphBaseWidth - 160, Math.round(dragState.originX + deltaX))),
          y: Math.max(10, Math.min(graphCanvasHeight - 62, Math.round(dragState.originY + deltaY)))
        }
      }));
    };

    const onMouseUp = (): void => {
      setGraphNodeDraggingTaskId(null);
      nodeDragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [graphBaseWidth, graphCanvasHeight, graphNodeDraggingTaskId, graphScale]);
  const handleGraphMouseDown = (event: ReactMouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.task-graph-node')) {
      return;
    }
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: graphOffset.x,
      originY: graphOffset.y
    };
    setGraphDragging(true);
  };
  const handleGraphNodeMouseDown = (event: ReactMouseEvent<HTMLButtonElement>, taskId: string): void => {
    event.preventDefault();
    event.stopPropagation();
    const node = taskGraphById.get(taskId);
    if (!node) {
      return;
    }
    nodeDragMovedRef.current = false;
    nodeDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y
    };
    setGraphNodeDraggingTaskId(taskId);
  };
  const handleGraphWheel = (event: ReactWheelEvent<HTMLElement>): void => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setGraphScale((current) => Math.min(1.8, Math.max(0.7, Number((current + delta).toFixed(2)))));
  };
  const resetGraphViewport = (): void => {
    setGraphScale(1);
    setGraphOffset({ x: 0, y: 0 });
  };
  const resetGraphLayout = (): void => {
    setManualNodePositions({});
    setSelectedGraphTaskIds([]);
  };
  const exportTeamReport = (): void => {
    if (typeof URL.createObjectURL !== 'function') {
      return;
    }
    const now = new Date();
    const safeTimestamp = now.toISOString().replace(/[:.]/g, '-');
    const reportLines = [
      `# Team Report - ${teamView.teamName ?? 'Unnamed Team'}`,
      '',
      `- Generated At: ${now.toISOString()}`,
      `- Team Status: ${teamView.status}`,
      `- Members: ${teamView.members.length}`,
      `- Tasks: ${teamView.tasks.length}`,
      `- Events: ${teamView.eventFeed.length}`,
      '',
      '## Backend Health',
      ...runtimeBackends.map(
        (backend) =>
          `- ${backend.backend}: ${backend.available ? 'available' : 'unavailable'} (${backend.command || '-'})${
            backend.reason ? ` - ${backend.reason}` : ''
          }`
      ),
      '',
      '## Team Runs',
      ...(teamRuns.length === 0
        ? ['- No team runs yet']
        : teamRuns.map(
            (run) =>
              `- ${run.teamName} (${run.status}) members=${run.memberCount} started=${run.startedAt} updated=${run.updatedAt}`
          )),
      '',
      '## Members',
      ...(teamView.members.length === 0
        ? ['- No members']
        : teamView.members.map(
            (member) =>
              `- ${member.memberId} / ${member.agentName} / ${member.backend} / ${member.status} / ${member.currentTask ?? '待命'}`
          )),
      '',
      '## Tasks',
      ...(teamView.tasks.length === 0
        ? ['- No tasks']
        : teamView.tasks.map(
            (task) => `- ${task.taskId} / ${task.title} / ${task.status} / depends_on=${task.dependsOn.join(',') || '-'}`
          )),
      '',
      '## Recent Events',
      ...(teamView.eventFeed.length === 0
        ? ['- No events']
        : teamView.eventFeed.slice(-20).map((event) => `- ${event.createdAt} / ${event.type} / ${event.summary}`))
    ];
    const blob = new Blob([reportLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `okk-team-report-${safeTimestamp}.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }, 1000);
  };
  const focusCriticalPath = (): void => {
    if (criticalPathNodeIds.length === 0) {
      return;
    }
    const criticalNodes = criticalPathNodeIds
      .map((taskId) => taskGraphById.get(taskId))
      .filter((task): task is (typeof taskGraphNodes)[number] => Boolean(task));
    if (criticalNodes.length === 0) {
      return;
    }
    const minX = Math.min(...criticalNodes.map((task) => task.x));
    const maxX = Math.max(...criticalNodes.map((task) => task.x + 150));
    const minY = Math.min(...criticalNodes.map((task) => task.y));
    const maxY = Math.max(...criticalNodes.map((task) => task.y + 52));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setGraphOffset({
      x: Math.round(graphBaseWidth / 2 - centerX * graphScale),
      y: Math.round(graphCanvasHeight / 2 - centerY * graphScale)
    });
    setSelectedGraphTaskIds(criticalPathNodeIds);
  };
  const findEventIdsByTasks = (tasks: Array<{ taskId: string; title: string }>): string[] => {
    const matched = teamView.eventFeed.filter((event) =>
      tasks.some((task) => event.summary.includes(task.taskId) || event.summary.includes(task.title))
    );
    return Array.from(new Set(matched.map((event) => event.id)));
  };
  const focusTaskTimeline = (taskIds: string[]): void => {
    if (taskIds.length === 0) {
      return;
    }
    const targetTasks = taskIds
      .map((taskId) => taskGraphById.get(taskId))
      .filter((task): task is (typeof taskGraphNodes)[number] => Boolean(task))
      .map((task) => ({ taskId: task.taskId, title: task.title }));
    if (targetTasks.length === 0) {
      return;
    }

    setSelectedGraphTaskIds(taskIds);
    setActiveTab('timeline');
    setTimelineQuery('');
    const eventIds = findEventIdsByTasks(targetTasks);
    if (eventIds.length === 0) {
      setFocusedEventIds([]);
      return;
    }

    setFocusedEventIds(eventIds);
    setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-event-id='${eventIds[0]}']`);
      if (!target || typeof target.scrollIntoView !== 'function') {
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 10);
  };
  const toggleGraphTaskSelection = (taskId: string): void => {
    setSelectedGraphTaskIds((current) => {
      if (current.includes(taskId)) {
        return current.filter((item) => item !== taskId);
      }
      return [...current, taskId];
    });
  };
  const handleGraphNodeClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    taskId: string
  ): void => {
    if (nodeDragMovedRef.current) {
      nodeDragMovedRef.current = false;
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      toggleGraphTaskSelection(taskId);
      return;
    }
    void focusTaskTimeline([taskId]);
  };
  const handleBatchFocusTimeline = (): void => {
    if (selectedGraphTaskIds.length === 0) {
      return;
    }
    void focusTaskTimeline(selectedGraphTaskIds);
  };
  const handleMinimapClick = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const targetX = clickX / minimapScaleX;
    const targetY = clickY / minimapScaleY;
    setGraphOffset({
      x: Math.round(graphBaseWidth / 2 - targetX * graphScale),
      y: Math.round(graphCanvasHeight / 2 - targetY * graphScale)
    });
  };
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <section className='panel'>
      <header className='panel-header panel-header-tight'>
        <div>
          <p className='eyebrow'>协作态势</p>
          <h2>{teamView.teamName ?? 'Team 视图'}</h2>
        </div>
        <span className={`pill pill-${teamView.status === 'idle' ? 'warning' : teamView.status}`}>
          {teamView.status}
        </span>
      </header>
      <div className='sidebar-context-card'>
        <p className='small-text'>这里汇总 Team Run、后端健康、成员动态与知识建议。</p>
        <p className='small-text'>用于对齐“谁在执行、执行到哪一步、哪里失败”。</p>
      </div>
      <nav className='sidebar-tab-nav' aria-label='协作面板视图切换'>
        <button
          type='button'
          className={`small-button ${activeTab === 'overview' ? 'primary-button' : 'ghost-button'}`}
          onClick={() => handleTabChange('overview')}
        >
          概览
        </button>
        <button
          type='button'
          className={`small-button ${activeTab === 'timeline' ? 'primary-button' : 'ghost-button'}`}
          onClick={() => handleTabChange('timeline')}
        >
          时间线
        </button>
        <button
          type='button'
          className={`small-button ${activeTab === 'graph' ? 'primary-button' : 'ghost-button'}`}
          onClick={() => handleTabChange('graph')}
        >
          任务图
        </button>
        <button
          type='button'
          className={`small-button ${activeTab === 'knowledge' ? 'primary-button' : 'ghost-button'}`}
          onClick={() => handleTabChange('knowledge')}
        >
          知识
        </button>
      </nav>

      {activeTab === 'overview' && (
        <>
          <section className='team-kpi-grid' aria-label='Team 摘要'>
            <article className='team-kpi-card'>
              <p className='eyebrow'>成员</p>
              <p className='team-kpi-value'>{teamView.members.length}</p>
              <p className='small-text'>协作成员总数</p>
            </article>
            <article className='team-kpi-card'>
              <p className='eyebrow'>任务</p>
              <p className='team-kpi-value'>{teamView.tasks.length}</p>
              <p className='small-text'>当前任务总数</p>
            </article>
            <article className='team-kpi-card'>
              <p className='eyebrow'>事件</p>
              <p className='team-kpi-value'>{teamView.eventFeed.length}</p>
              <p className='small-text'>事件流累计</p>
            </article>
            <article className='team-kpi-card'>
              <p className='eyebrow'>建议</p>
              <p className='team-kpi-value'>{pendingSuggestions}</p>
              <p className='small-text'>待处理知识建议</p>
            </article>
          </section>
          <div className='team-run-toolbar'>
            <button type='button' className='primary-button small-button' disabled={teamRunPending} onClick={onStartTeamRun}>
              {teamRunPending ? '启动中...' : '启动 Team Run'}
            </button>
            <button type='button' className='small-button ghost-button' onClick={onRefreshTeamRuns}>
              刷新运行
            </button>
            <button type='button' className='small-button ghost-button' onClick={exportTeamReport}>
              导出报告
            </button>
          </div>
          {teamRunError && (
            <p className='small-text error-text' role='alert'>
              {teamRunError}
            </p>
          )}
          {teamRun && (
            <article className='team-item'>
              <div className='team-item-header'>
                <span>当前 Run</span>
                <span className={`pill ${getRuntimeStatusPillClass(teamRun.runtimeStatus)}`}>
                  {formatRuntimeStatusLabel(teamRun.runtimeStatus)}
                </span>
              </div>
              <p className='small-text'>{teamRun.teamName}</p>
              <p className='small-text'>成员 {teamRun.memberCount} · 开始于 {formatTime(teamRun.startedAt)}</p>
              {teamRun.summary && <p className='small-text'>{teamRun.summary}</p>}
              {teamRun.diagnostics && <p className='small-text'>{teamRun.diagnostics.message}</p>}
              {teamRun.actions && teamRun.actions.length > 0 && (
                <div className='row-actions team-item-actions'>
                  {teamRun.actions.map((action) => (
                    <button
                      key={`team-run-${action.kind}`}
                      type='button'
                      className='small-button ghost-button'
                      onClick={() =>
                        handleDiagnosticAction(action, {
                          summary: teamRun.summary ?? teamRun.teamName,
                          diagnostics: teamRun.diagnostics,
                          runId: teamRun.id,
                          sourceType: teamRun.sourceType
                        })
                      }
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </article>
          )}

          {missionSummary && (
            <>
              <div className='panel-header panel-header-tight'>
                <h3>Mission Room</h3>
                <span className='small-text'>{missionSummary.phase}</span>
              </div>
              <article className='team-item'>
                <div className='team-item-header'>
                  <span>{missionSummary.title}</span>
                  <span className={`pill ${missionSummary.status === 'completed' ? 'pill-success' : missionSummary.status === 'blocked' || missionSummary.status === 'failed' ? 'pill-error' : 'pill-running'}`}>
                    {missionSummary.status}
                  </span>
                </div>
                <p className='small-text'>
                  {missionSummary.workstreamCompleted}/{missionSummary.workstreamTotal} workstreams · 阻塞 {missionSummary.blockedCount} · 待确认 {missionSummary.openCheckpointCount}
                </p>
                {missionWorkstreams.length > 0 && (
                  <ul className='team-list'>
                    {missionWorkstreams.slice(0, 4).map((item) => (
                      <li key={item.id} className='team-item'>
                        <div className='team-item-header'>
                          <span>{item.title}</span>
                          <span className={`pill ${item.status === 'completed' ? 'pill-success' : item.status === 'blocked' || item.status === 'failed' ? 'pill-error' : 'pill-running'}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className='small-text'>{item.assigneePartnerId}</p>
                        {item.outputSummary && <p className='small-text'>{item.outputSummary}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {openMissionCheckpoints.length > 0 && (
                  <div className='space-top'>
                    <p className='small-text'>待确认</p>
                    <ul className='team-list'>
                      {openMissionCheckpoints.slice(0, 3).map((item) => (
                        <li key={item.id} className='team-item'>
                          <div className='team-item-header'>
                            <span>{item.title}</span>
                            <span className='pill pill-error'>open</span>
                          </div>
                          <p className='small-text'>{item.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {missionHandoffs.length > 0 && (
                  <p className='small-text'>最近交接 {missionHandoffs.length} 条</p>
                )}
              </article>
            </>
          )}

          <div className='panel-header panel-header-tight'>
            <h3>后端健康</h3>
            <span className='small-text'>
              {backendReadyCount}/{runtimeBackends.length}
            </span>
          </div>
          {runtimeBackends.length === 0 ? (
            <p className='empty-hint'>暂无后端诊断结果。</p>
          ) : (
            <ul className='team-list'>
              {runtimeBackends.map((item) => (
                <li key={item.backend} className='team-item'>
                  <div className='team-item-header'>
                    <span>{item.backend}</span>
                    <span className={`pill ${getRuntimeStatusPillClass(item.runtimeStatus)}`}>
                      {formatRuntimeStatusLabel(item.runtimeStatus)}
                    </span>
                  </div>
                  <p className='small-text'>命令: {item.command || '-'}</p>
                  {item.diagnostics && <p className='small-text'>{item.diagnostics.message}</p>}
                  {item.diagnostics?.detail && <p className='small-text'>{item.diagnostics.detail}</p>}
                  {item.actions && item.actions.length > 0 && (
                    <div className='row-actions team-item-actions'>
                      {item.actions.map((action) => (
                        <button
                          key={`${item.backend}-${action.kind}`}
                          type='button'
                          className='small-button ghost-button'
                          onClick={() =>
                            handleDiagnosticAction(action, {
                              summary: `${item.backend} health`,
                              diagnostics: item.diagnostics,
                              sourceType: item.sourceType
                            })
                          }
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className='panel-header panel-header-tight'>
            <h3>运行记录</h3>
            <span className='small-text'>{teamRuns.length}</span>
          </div>
          {latestRuns.length === 0 ? (
            <p className='empty-hint'>尚未发起 Team Run。</p>
          ) : (
            <ul className='team-list'>
              {latestRuns.map((run) => (
                <li key={run.id} className='team-item'>
                  <div className='team-item-header'>
                    <span>{run.teamName}</span>
                    <span className={`pill ${getRuntimeStatusPillClass(run.runtimeStatus)}`}>
                      {formatRuntimeStatusLabel(run.runtimeStatus)}
                    </span>
                  </div>
                  <p className='small-text'>
                    {run.memberCount} 成员 · 更新于 {formatTime(run.updatedAt)}
                  </p>
                  {run.diagnostics && <p className='small-text'>{run.diagnostics.message}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className='panel-header panel-header-tight'>
            <h3>成员</h3>
            <span className='small-text'>{teamView.members.length}</span>
          </div>
          {teamView.members.length === 0 ? (
            <p className='empty-hint'>暂无成员状态事件。</p>
          ) : (
            <ul className='team-list'>
              {teamView.members.map((member) => (
                <li key={member.memberId} className='team-item'>
                  <div className='team-item-header'>
                    <span>{member.agentName}</span>
                    <span className={`pill pill-${member.status}`}>{member.status}</span>
                  </div>
                  <div className='team-member-meta'>
                    <span className='team-backend-tag'>{member.backend}</span>
                    <span className='small-text'>更新于 {formatTime(member.updatedAt)}</span>
                  </div>
                  <p className='small-text'>{member.currentTask ?? '待命'}</p>
                </li>
              ))}
            </ul>
          )}

          <div className='panel-header panel-header-tight'>
            <h3>任务</h3>
            <span className='small-text'>{teamView.tasks.length}</span>
          </div>
          {teamView.tasks.length === 0 ? (
            <p className='empty-hint'>暂无任务数据。</p>
          ) : (
            <ul className='team-list'>
              {teamView.tasks.map((task) => (
                <li key={task.taskId} className='team-item'>
                  <div className='team-item-header'>
                    <span>{task.title}</span>
                    <span className={`pill pill-${task.status}`}>{task.status}</span>
                  </div>
                  {task.dependsOn.length > 0 && <p className='small-text'>依赖: {task.dependsOn.join(', ')}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className='panel-header panel-header-tight'>
            <h3>消息</h3>
            <span className='small-text'>{teamView.messages.length}</span>
          </div>
          {teamView.messages.length === 0 ? (
            <p className='empty-hint'>暂无 Team 消息。</p>
          ) : (
            <ul className='team-list'>
              {teamView.messages.slice(-6).map((message) => (
                <li key={message.id} className='team-item'>
                  <p>{message.content}</p>
                  <p className='small-text'>
                    {message.memberId} · {new Date(message.createdAt).toLocaleTimeString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeTab === 'timeline' && (
        <>
          <div className='panel-header panel-header-tight'>
            <h3>事件流</h3>
            <span className='small-text'>
              {filteredTimelineEvents.length}/{teamView.eventFeed.length}
            </span>
          </div>
          <label className='timeline-filter'>
            <span className='sr-only'>筛选事件</span>
            <input
              value={timelineQuery}
              placeholder='筛选事件类型或摘要'
              onChange={(event) => setTimelineQuery(event.target.value)}
            />
            {timelineQuery.trim() && (
              <button type='button' className='small-button ghost-button' onClick={() => setTimelineQuery('')}>
                清空
              </button>
            )}
          </label>
          {filteredTimelineEvents.length === 0 ? (
            <p className='empty-hint'>
              {teamView.eventFeed.length === 0 ? '暂无 Team 事件流。' : `没有匹配“${timelineQuery.trim()}”的事件。`}
            </p>
          ) : (
            <ul className='team-list team-event-feed'>
              {filteredTimelineEvents.slice().reverse().map((event) => (
                <li
                  key={event.id}
                  data-event-id={event.id}
                  className={`team-item team-event-item ${focusedEventIds.includes(event.id) ? 'team-event-focus' : ''}`}
                >
                  <time className='team-event-time' dateTime={event.createdAt}>
                    {formatTime(event.createdAt)}
                  </time>
                  <div className='team-event-content'>
                    <div className='team-event-head'>
                      <p className='team-event-type'>{event.type}</p>
                      <div className='team-event-badges'>
                        {event.sourceType && <span className='team-backend-tag'>{formatSourceTypeLabel(event.sourceType)}</span>}
                        {event.status && (
                          <span className={`pill ${getRuntimeStatusPillClass(event.status)}`}>
                            {formatRuntimeStatusLabel(event.status)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className='small-text'>{event.summary}</p>
                    {event.runId && <p className='small-text'>Run {event.runId}</p>}
                    {event.diagnostics && (
                      <div className='team-event-diagnostic'>
                        <p className='small-text'>{event.diagnostics.message}</p>
                        {event.diagnostics.detail && <p className='small-text'>{event.diagnostics.detail}</p>}
                      </div>
                    )}
                    {event.actions && event.actions.length > 0 && (
                      <div className='row-actions team-event-actions'>
                        {event.actions.map((action) => (
                          <button
                            key={`${event.id}-${action.kind}`}
                            type='button'
                            className='small-button ghost-button'
                            onClick={() =>
                              handleDiagnosticAction(action, {
                                summary: event.summary,
                                diagnostics: event.diagnostics,
                                runId: event.runId,
                                sourceType: event.sourceType
                              })
                            }
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeTab === 'graph' && (
        <>
          <div className='panel-header panel-header-tight'>
            <h3>任务依赖图</h3>
            <span className='small-text'>{taskGraphNodes.length}</span>
          </div>
          <div className='task-graph-toolbar'>
            <button
              type='button'
              className='small-button ghost-button'
              onClick={() => setGraphScale((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))))}
            >
              放大
            </button>
            <button
              type='button'
              className='small-button ghost-button'
              onClick={() => setGraphScale((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))}
            >
              缩小
            </button>
            <button type='button' className='small-button ghost-button' onClick={focusCriticalPath}>
              关键路径
            </button>
            <button
              type='button'
              className='small-button ghost-button'
              onClick={handleBatchFocusTimeline}
              disabled={selectedGraphTaskIds.length === 0}
            >
              批量定位
            </button>
            <button type='button' className='small-button ghost-button' onClick={resetGraphViewport}>
              复位
            </button>
            <button type='button' className='small-button ghost-button' onClick={resetGraphLayout}>
              重置布局
            </button>
            <span className='small-text'>缩放 {Math.round(graphScale * 100)}%</span>
            <span className='small-text'>关键路径节点 {criticalPathNodeIds.length}</span>
            <span className='small-text'>已选节点 {selectedGraphTaskIds.length}</span>
          </div>
          {taskGraphNodes.length === 0 ? (
            <p className='empty-hint'>暂无任务图数据，启动 Team Run 后将自动生成。</p>
          ) : (
            <>
              <section className='task-graph-minimap' aria-label='DAG 缩略图'>
                <svg
                  width={minimapWidth}
                  height={minimapHeight}
                  viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}
                  onClick={handleMinimapClick}
                >
                  <rect x='0' y='0' width={minimapWidth} height={minimapHeight} className='task-graph-minimap-bg' />
                  {taskGraphEdges.map((edge) => {
                    const fromNode = taskGraphById.get(edge.from);
                    const toNode = taskGraphById.get(edge.to);
                    if (!fromNode || !toNode) {
                      return null;
                    }
                    const edgeKey = `${edge.from}->${edge.to}`;
                    return (
                      <line
                        key={`mini-${edgeKey}`}
                        x1={(fromNode.x + 70) * minimapScaleX}
                        y1={(fromNode.y + 26) * minimapScaleY}
                        x2={toNode.x * minimapScaleX}
                        y2={(toNode.y + 26) * minimapScaleY}
                        className={`task-graph-minimap-edge ${
                          criticalPathEdgeSet.has(edgeKey) ? 'task-graph-minimap-edge-critical' : ''
                        }`}
                      />
                    );
                  })}
                  {taskGraphNodes.map((task) => (
                    <rect
                      key={`mini-node-${task.taskId}`}
                      x={task.x * minimapScaleX}
                      y={task.y * minimapScaleY}
                      width={150 * minimapScaleX}
                      height={52 * minimapScaleY}
                      className={`task-graph-minimap-node ${
                        selectedGraphTaskIds.includes(task.taskId) ? 'task-graph-minimap-node-selected' : ''
                      } ${criticalPathNodeSet.has(task.taskId) ? 'task-graph-minimap-node-critical' : ''}`}
                    />
                  ))}
                  <rect
                    x={graphViewport.x * minimapScaleX}
                    y={graphViewport.y * minimapScaleY}
                    width={graphViewport.width * minimapScaleX}
                    height={graphViewport.height * minimapScaleY}
                    className='task-graph-minimap-viewport'
                  />
                </svg>
              </section>
              <section
                className={`task-graph-canvas ${graphDragging ? 'dragging' : ''}`}
                style={{ height: `${graphCanvasHeight}px` }}
                aria-label='任务依赖 DAG'
                onMouseDown={handleGraphMouseDown}
                onWheel={handleGraphWheel}
              >
                <div
                  className='task-graph-viewport'
                  style={{
                    transform: `translate(${graphOffset.x}px, ${graphOffset.y}px) scale(${graphScale})`,
                    transformOrigin: '0 0'
                  }}
                >
                  <svg
                    width='460'
                    height={graphCanvasHeight}
                    viewBox={`0 0 460 ${graphCanvasHeight}`}
                    preserveAspectRatio='none'
                  >
                    {taskGraphEdges.map((edge) => {
                      const fromNode = taskGraphById.get(edge.from);
                      const toNode = taskGraphById.get(edge.to);
                      if (!fromNode || !toNode) {
                        return null;
                      }
                      const edgeKey = `${edge.from}->${edge.to}`;
                      return (
                        <g key={edgeKey}>
                          <line
                            x1={fromNode.x + 70}
                            y1={fromNode.y + 26}
                            x2={toNode.x}
                            y2={toNode.y + 26}
                            className={`task-graph-edge ${criticalPathEdgeSet.has(edgeKey) ? 'task-graph-edge-critical' : ''}`}
                          />
                          <circle
                            cx={toNode.x}
                            cy={toNode.y + 26}
                            r='3'
                            className={`task-graph-edge-dot ${criticalPathEdgeSet.has(edgeKey) ? 'task-graph-edge-dot-critical' : ''}`}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  {taskGraphNodes.map((task) => (
                    <button
                      key={task.taskId}
                      type='button'
                      className={`task-graph-node ${selectedGraphTaskIds.includes(task.taskId) ? 'active' : ''} ${
                        criticalPathNodeSet.has(task.taskId) ? 'task-graph-node-critical' : ''
                      } ${task.status === 'running' ? 'is-running' : ''} ${
                        graphNodeDraggingTaskId === task.taskId ? 'is-dragging' : ''
                      }`}
                      style={{ left: `${task.x}px`, top: `${task.y}px` }}
                      onMouseDown={(event) => handleGraphNodeMouseDown(event, task.taskId)}
                      onClick={(event) => handleGraphNodeClick(event, task.taskId)}
                      title='点击定位时间线；按 Shift/Ctrl 可多选节点'
                    >
                      <span className='task-graph-node-title'>{task.title}</span>
                      <span className={`pill pill-${task.status}`}>{task.status}</span>
                    </button>
                  ))}
                </div>
              </section>
              <ul className='team-list task-graph-list'>
                {taskGraphNodes.map((task) => (
                  <li key={task.taskId} className='team-item task-graph-item'>
                    <div className='team-item-header'>
                      <span>{task.title}</span>
                      <span className={`pill pill-${task.status}`}>{task.status}</span>
                    </div>
                    <p className='small-text'>节点: {task.taskId}</p>
                    <p className='small-text'>依赖链: {task.dependencyText}</p>
                    {task.ownerMemberId && <p className='small-text'>Owner: {task.ownerMemberId}</p>}
                    <button
                      type='button'
                      className='ghost-button small-button'
                      onClick={() => focusTaskTimeline([task.taskId])}
                    >
                      跳转关联事件
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {activeTab === 'knowledge' && (
        <>
          <div className='panel-header space-top'>
            <h2>知识建议</h2>
            <span className='small-text'>{suggestions.length} 条</span>
          </div>
          {suggestions.length === 0 ? (
            <p className='empty-hint'>对话完成后会自动出现知识建议，可直接保存或忽略。</p>
          ) : (
            <div className='suggestion-list'>
              {suggestions.map((suggestion) => (
                <KnowledgeSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onSave={onSaveSuggestion}
                  onIgnore={onIgnoreSuggestion}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
