import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DivinationPanel } from '@/components/DivinationPanel';
import { WorkspaceToolSwitcher } from '@/components/workspace/ToolSwitcher';
import { AiChatPanel } from '@/components/AiChatPanel';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';
import { computeRealDailyAlmanac } from '@/lib/daily-almanac-hexagram';
import { DIVINATION_METHOD_GUIDES } from '@/lib/divination-method-guides';
import {
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isDivinationWorkspaceId,
} from '@/lib/workspace';
import { readWorkspaceLaunchState } from '@/lib/workspace-launch';

const AI_SIDEBAR_WIDTH_STORAGE_KEY = 'mingyu.divination.aiSidebarWidth';
const AI_SIDEBAR_MIN_WIDTH = 340;
const AI_SIDEBAR_MAX_WIDTH = 960;

function readSavedSidebarWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AI_SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= AI_SIDEBAR_MIN_WIDTH && parsed <= AI_SIDEBAR_MAX_WIDTH) {
      return parsed;
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

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
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [aiSidebarWidth, setAiSidebarWidth] = useState<number | null>(() => readSavedSidebarWidth());
  const [isResizing, setIsResizing] = useState(false);

  const clampSidebarWidth = useCallback((candidate: number) => {
    const containerWidth = splitRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxAllowed = Math.min(AI_SIDEBAR_MAX_WIDTH, Math.max(AI_SIDEBAR_MIN_WIDTH, containerWidth * 0.56));
    return Math.round(Math.min(maxAllowed, Math.max(AI_SIDEBAR_MIN_WIDTH, candidate)));
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const splitEl = splitRef.current;
      if (!splitEl) return;
      const splitRect = splitEl.getBoundingClientRect();
      setIsResizing(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampSidebarWidth(splitRect.right - moveEvent.clientX);
        setAiSidebarWidth(nextWidth);
      };

      const handlePointerUp = () => {
        setIsResizing(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [clampSidebarWidth],
  );

  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('is-resizing-split');
      return () => {
        document.body.classList.remove('is-resizing-split');
      };
    }
    try {
      if (aiSidebarWidth === null) {
        window.localStorage.removeItem(AI_SIDEBAR_WIDTH_STORAGE_KEY);
      } else {
        window.localStorage.setItem(AI_SIDEBAR_WIDTH_STORAGE_KEY, String(aiSidebarWidth));
      }
    } catch {
      // ignore storage write error
    }
  }, [aiSidebarWidth, isResizing]);

  const splitStyle = useMemo<CSSProperties | undefined>(() => {
    if (aiSidebarWidth === null) return undefined;
    return { ['--ai-sidebar-width' as string]: `${aiSidebarWidth}px` };
  }, [aiSidebarWidth]);

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
      <div
        ref={splitRef}
        className={`ink-split-stage divination-ai-split${isResizing ? ' is-resizing' : ''}`}
        style={splitStyle}
      >
        <div className="ink-split-stage__main">
          {method !== 'almanac' ? (
            <div className="divination-main-columns">
              <aside className="divination-method-guide" aria-label={`${DIVINATION_METHOD_GUIDES[method].title}简介`}>
                <div className="divination-method-guide__head">
                  <span className="divination-method-guide__seal" aria-hidden="true">
                    {DIVINATION_METHOD_GUIDES[method].mark}
                  </span>
                  <div>
                    <h2>{DIVINATION_METHOD_GUIDES[method].title}</h2>
                    <p>{DIVINATION_METHOD_GUIDES[method].alias}</p>
                  </div>
                </div>
                <p className="divination-method-guide__tagline">
                  {DIVINATION_METHOD_GUIDES[method].tagline}
                </p>

                <section className="divination-method-guide__section">
                  <h3>这是什么</h3>
                  <p>{DIVINATION_METHOD_GUIDES[method].whatIs}</p>
                </section>

                <section className="divination-method-guide__section">
                  <h3>擅长问事</h3>
                  <div className="divination-method-guide__tags">
                    {DIVINATION_METHOD_GUIDES[method].bestFor.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </section>

                <section className="divination-method-guide__section">
                  <h3>怎么使用</h3>
                  <ol className="divination-method-guide__steps">
                    {DIVINATION_METHOD_GUIDES[method].howToUse.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>

                <section className="divination-method-guide__section">
                  <h3>历史渊源</h3>
                  <p>{DIVINATION_METHOD_GUIDES[method].history}</p>
                </section>

                <blockquote className="divination-method-guide__quote">
                  <p>{DIVINATION_METHOD_GUIDES[method].classicQuote}</p>
                  <cite>—— {DIVINATION_METHOD_GUIDES[method].classicSource}</cite>
                </blockquote>
              </aside>
              <div className="divination-form-column">
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
            </div>
          ) : (
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
          )}
        </div>
        <div
          className="divination-split-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整 AI 问答窗口宽度"
          title="左右拖动调整 AI 问答窗口宽度，双击恢复默认"
          onPointerDown={handleResizeStart}
          onDoubleClick={() => setAiSidebarWidth(null)}
        />
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
