import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DivinationPanel } from '@/components/DivinationPanel';
import { WorkspaceToolSwitcher } from '@/components/workspace/ToolSwitcher';
import { AiChatPanel } from '@/components/AiChatPanel';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';
import { computeRealDailyAlmanac } from '@/lib/daily-almanac-hexagram';
import {
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isDivinationWorkspaceId,
} from '@/lib/workspace';
import { readWorkspaceLaunchState } from '@/lib/workspace-launch';

function useDivinationMethod() {
  const { method } = useParams();
  return isDivinationWorkspaceId(method) ? method : null;
}

export function DivinationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const launchState = readWorkspaceLaunchState(location.state);
  const method = useDivinationMethod();
  const [aiSettings] = useAiSettings();
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  const almanac = useMemo(() => computeRealDailyAlmanac(), []);

  const contextPrompt = useMemo(() => {
    if (!method) return '';
    if (method === 'almanac') {
      return [
        '你是一位精通《钦定协纪辨方书》与传统黄历择日的顾问。',
        `当前日期：${almanac.date}（${almanac.dateLabel}），${almanac.lunarDate}，${almanac.ganzhiLabel}。`,
        `今日黄历：建除「${almanac.dayOfficer}」日，值神「${almanac.twelveStar}」（${almanac.isYellowRoad ? '黄道' : '黑道'}），冲煞「${almanac.clash}」，综合判定「${almanac.verdict}」。`,
        `今日宜：${almanac.recommends.join('、')}。`,
        `今日忌：${almanac.avoids.join('、')}。`,
        '请结合传统择日逻辑，简洁、务实、理性地回答用户的择日、吉时与黄历相关问题。',
      ].join('\n');
    }
    const feature = getWorkspaceFeature(method);
    return [
      `你是一位精通东方术数与「${feature.label}」的问答顾问。`,
      `当前日期：${almanac.date}（${almanac.lunarDate}，${almanac.ganzhiLabel}，${almanac.shichenLabel}）。`,
      `用户当前处于「${feature.label}」占问页面，可以随时向你咨询如何提问、选择起卦方式、术数原理，或直接讨论所关心的事项。`,
      '请保持理性、清晰、有条理地解答，不做夸大或宿命化断言。',
    ].join('\n');
  }, [almanac, method]);

  if (!method) {
    return <Navigate to="/divination/liuyao" replace />;
  }

  return (
    <div
      className={`workspace-focused-page workspace-divination-page${method === 'almanac' ? ' is-almanac' : ''}`}
    >
      {method !== 'almanac' ? (
        <WorkspaceToolSwitcher current={method} group="divination" ariaLabel="占问工具切换" />
      ) : null}
      <div className="ink-split-stage divination-ai-split">
        <div className="ink-split-stage__main">
          <DivinationPanel
            key={location.key}
            initialMethod={method}
            lockedMethod={method}
            displayMode="input"
            initialQuestion={
              launchState.initialQuestion ?? new URLSearchParams(location.search).get('q') ?? ''
            }
            initialSupplementaryInfo={launchState.initialSupplementaryInfo}
            initialGender={launchState.initialGender}
            initialBirthYear={launchState.initialBirthYear}
            autoSubmit={launchState.autoSubmit}
            onGenerated={(recordId, requestedMethod) =>
              navigate(`/divination/${requestedMethod}/result?record=${encodeURIComponent(recordId)}`)
            }
          />
        </div>
        <aside className="divination-ai-sidebar" aria-label="AI 问答窗口">
          <AiChatPanel
            workspaceMode
            contextPrompt={contextPrompt}
            resetKey={`divination-sidebar:${method}`}
            historyKey={`divination-sidebar:${method}`}
            inputResetKey={`divination-sidebar:${method}`}
            aiConfig={aiRequestConfig}
            readingMethod={method}
          />
        </aside>
      </div>
    </div>
  );
}

type DivinationResultPageProps = {
  assistantOnly?: boolean;
};

export function DivinationResultPage({ assistantOnly = false }: DivinationResultPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const method = useDivinationMethod();
  if (!method) {
    return <Navigate to="/divination/liuyao" replace />;
  }
  const recordId = new URLSearchParams(location.search).get('record');

  return (
    <div className="workspace-focused-page workspace-divination-result-page">
      <DivinationPanel
        key={`${method}:${recordId ?? location.key}`}
        initialMethod={method}
        lockedMethod={method}
        displayMode="result"
        assistantOnly={assistantOnly}
        onOpenAssistant={() => navigate(`/divination/${method}/result/assistant${location.search}`)}
        onReturnToBoard={() => navigate(`/divination/${method}/result${location.search}`)}
        onRestart={() => navigate(buildWorkspaceFeaturePath(method))}
      />
    </div>
  );
}
