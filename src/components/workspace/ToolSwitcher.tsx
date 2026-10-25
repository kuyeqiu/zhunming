import { Link } from 'react-router-dom';
import {
  WORKSPACE_FEATURES,
  buildWorkspaceFeaturePath,
  type WorkspaceFeatureGroup,
  type WorkspaceFeatureId,
} from '@/lib/workspace';

/**
 * 工具切换条：把工具抽屉里的某一组功能以胶囊按钮平铺在页面上，
 * 点击直接切换到对应工具页。排盘相关页面用 group="chart"，
 * 占问页用 group="divination"。
 */
export function WorkspaceToolSwitcher({
  current,
  group,
  ariaLabel,
}: {
  current: WorkspaceFeatureId;
  group: WorkspaceFeatureGroup;
  ariaLabel: string;
}) {
  const features = WORKSPACE_FEATURES.filter((item) => item.group === group);
  if (features.length <= 1) return null;

  return (
    <nav className="workspace-tool-switcher" aria-label={ariaLabel}>
      {features.map((feature) => (
        <Link
          key={feature.id}
          to={buildWorkspaceFeaturePath(feature.id)}
          className={`workspace-tool-chip${feature.id === current ? ' is-active' : ''}`}
          aria-current={feature.id === current ? 'page' : undefined}
        >
          {feature.shortLabel}
        </Link>
      ))}
    </nav>
  );
}
