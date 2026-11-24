import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DivinationPanel } from '@/components/DivinationPanel';
import { WorkspaceToolSwitcher } from '@/components/workspace/ToolSwitcher';
import { InkHexagramAside } from '@/components/ink/InkHexagram';
import { buildWorkspaceFeaturePath, isDivinationWorkspaceId } from '@/lib/workspace';
import { readWorkspaceLaunchState } from '@/lib/workspace-launch';

const DIVINATION_CAPTIONS: Record<string, string> = {
  liuyao: '六爻动静，以察事机',
  meihua: '观物起象，心易相感',
  qimen: '奇门九宫，审时度势',
  liuren: '大六壬课，明人事之终始',
  xiaoliuren: '掌中六神，简明直断',
  jinkoujue: '金口断诀，直指要害',
  taiyi: '太乙神数，推气运之兴衰',
  huangji: '皇极经世，观元会运世',
  tarot: '以象映心，照见当下',
  lenormand: '雷诺曼牌，叙事明晰',
  almanac: '择日循时，趋吉避凶',
};

function useDivinationMethod() {
  const { method } = useParams();
  return isDivinationWorkspaceId(method) ? method : null;
}

export function DivinationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const launchState = readWorkspaceLaunchState(location.state);
  const method = useDivinationMethod();
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
      <div className="ink-split-stage">
        <div className="ink-split-stage__main">
          <DivinationPanel
            key={location.key}
            initialMethod={method}
            lockedMethod={method}
            displayMode="input"
            initialQuestion={launchState.initialQuestion ?? new URLSearchParams(location.search).get('q') ?? ''}
            initialSupplementaryInfo={launchState.initialSupplementaryInfo}
            initialGender={launchState.initialGender}
            initialBirthYear={launchState.initialBirthYear}
            autoSubmit={launchState.autoSubmit}
            onGenerated={(recordId, requestedMethod) =>
              navigate(`/divination/${requestedMethod}/result?record=${encodeURIComponent(recordId)}`)
            }
          />
        </div>
        <InkHexagramAside
          contextKey={method}
          caption={DIVINATION_CAPTIONS[method] ?? '心诚起卦，静观其变'}
          showFortune={method === 'almanac'}
        />
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
