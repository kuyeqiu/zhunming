import { Link } from 'react-router-dom';
import { CHART_RECORD_PARAM } from '@/lib/case-navigation';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { WORKSPACE_FEATURES } from '@/lib/workspace';
import { WorkspacePage } from '@/components/workspace/WorkspaceUI';
import { InkHexagramAside } from '@/components/ink/InkHexagram';

/**
 * 排盘总目录：各命盘入口。岁庚里有可用案例就带 rid+auto 直接出盘，
 * 没有则去岁庚页先填资料。
 */
export function ChartMenuPage() {
  const { activeCaseId } = useActivePersonalCase();
  const features = WORKSPACE_FEATURES.filter((item) => item.group === 'chart');

  return (
    <WorkspacePage title="排盘" width="wide" className="chart-menu-page">
      <div className="ink-split-stage">
        <div className="ink-split-stage__main">
          {!activeCaseId ? (
            <div className="chart-menu-hint">
              还没有岁庚，<Link to="/profile">先去登记岁庚</Link>，之后点盘直接出。
            </div>
          ) : null}
          <div className="chart-menu-grid">
            {features.map((feature) => {
              const params = new URLSearchParams();
              if (activeCaseId) {
                params.set(CHART_RECORD_PARAM, activeCaseId);
                params.set('auto', '1');
              }
              const search = params.toString();
              return (
                <Link
                  key={feature.id}
                  className="chart-menu-card"
                  to={`/chart/${feature.id}${search ? `?${search}` : ''}`}
                >
                  <span className="chart-menu-card-mark" aria-hidden="true">
                    {feature.mark}
                  </span>
                  <span className="chart-menu-card-body">
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <InkHexagramAside
          contextKey="chart-menu"
          caption="观象知时，择术入盘"
          showFortune
        />
      </div>
    </WorkspacePage>
  );
}
