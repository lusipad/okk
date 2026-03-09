import type { ChatMessage } from '../../types/domain';

export interface NextStepSuggestion {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

interface DeriveSuggestionsInput {
  messages: ChatMessage[];
  isStreaming: boolean;
  skillCount: number;
  mcpCount: number;
}

interface NextStepSuggestionsProps {
  suggestions: NextStepSuggestion[];
  onSelect: (suggestion: NextStepSuggestion) => void;
}

const ERROR_PATTERN = /(报错|错误|异常|失败|error|failed|stack|trace|bug)/i;
const PLAN_PATTERN = /(计划|清单|步骤|todo|待办|方案)/i;

export function deriveNextStepSuggestions({
  messages,
  isStreaming,
  skillCount,
  mcpCount
}: DeriveSuggestionsInput): NextStepSuggestion[] {
  if (isStreaming || messages.length === 0) {
    return [];
  }

  const lastMessage = messages[messages.length - 1];
  const normalizedContent = lastMessage.content.trim();
  if (normalizedContent.length < 12) {
    return [];
  }

  if (ERROR_PATTERN.test(normalizedContent)) {
    return [
      {
        id: 'root-cause',
        label: '分析根因',
        description: '先定位最可能的根因与影响面',
        prompt: '请先分析这个问题最可能的根因、影响范围，并给出排查顺序。'
      },
      {
        id: 'fix-steps',
        label: '修复步骤',
        description: '把修复动作拆成可执行步骤',
        prompt: '请把修复这类问题的步骤拆成一份可直接执行的清单。'
      },
      {
        id: 'add-tests',
        label: '补测试',
        description: '给出覆盖这类问题的测试建议',
        prompt: '请给出覆盖这个问题的测试用例建议，并说明每条测试验证什么。'
      }
    ];
  }

  if (PLAN_PATTERN.test(normalizedContent) || lastMessage.toolCalls.length > 0) {
    return [
      {
        id: 'todo-list',
        label: '整理待办',
        description: '把当前结果整理成待办清单',
        prompt: '请把当前结果整理成一份按优先级排序的待办清单。'
      },
      {
        id: 'first-step',
        label: '执行第一步',
        description: '只聚焦最先要做的动作',
        prompt: '请只告诉我现在最应该先做的第一步，并说明原因。'
      },
      {
        id: 'risk-check',
        label: '检查风险',
        description: '提前识别可能的风险与回滚点',
        prompt: '请帮我检查接下来执行这件事的主要风险、依赖和回滚点。'
      }
    ];
  }

  if (skillCount > 0 || mcpCount > 0) {
    return [
      {
        id: 'capability-plan',
        label: '结合能力推进',
        description: '结合当前 Skills / MCP 继续推进',
        prompt: '请结合当前已启用的 Skills 和 MCP，给我一个最适合继续推进的方案。'
      },
      {
        id: 'minimal-path',
        label: '最小路径',
        description: '先拿到一个最小可执行结果',
        prompt: '请给我一个最小可执行路径，让我最快拿到下一步结果。'
      },
      {
        id: 'actionable-steps',
        label: '具体操作',
        description: '把当前答案改写成具体操作步骤',
        prompt: '请把上面的内容改写成具体、可执行的操作步骤。'
      }
    ];
  }

  return [
    {
      id: 'summary',
      label: '总结结论',
      description: '提炼当前对话的关键结论',
      prompt: '请先总结这轮对话的关键结论，并按重要性排序。'
    },
    {
      id: 'next-step',
      label: '给出下一步',
      description: '明确现在最值得做的下一步',
      prompt: '请明确告诉我现在最值得做的下一步，以及为什么。'
    },
    {
      id: 'implementation',
      label: '展开实现',
      description: '把当前方向展开成实现细节',
      prompt: '请把当前方向展开成更具体的实现细节和注意事项。'
    }
  ];
}

export function NextStepSuggestions({ suggestions, onSelect }: NextStepSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className='next-step-panel' aria-label='下一步建议'>
      <div className='next-step-panel-head'>
        <h3>下一步建议</h3>
        <span className='small-text'>规则驱动，无额外模型调用</span>
      </div>
      <div className='next-step-list'>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type='button'
            className='next-step-card'
            data-testid={`next-step-${suggestion.id}`}
            onClick={() => onSelect(suggestion)}
          >
            <span className='next-step-label'>{suggestion.label}</span>
            <span className='next-step-description'>{suggestion.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
