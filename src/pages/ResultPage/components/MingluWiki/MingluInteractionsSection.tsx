import React from 'react';
import type { MingluInteractionItem } from 'mingyu-core/minglu';

interface Props {
  items: MingluInteractionItem[];
}

export const MingluInteractionsSection: React.FC<Props> = ({ items }) => {
  return (
    <section id="bazi-interactions" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">04</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第四章：全量柱间作用网络与刑冲合会</h2>
          <p className="minglu-section-subtitle">
            天干五合冲克、地支三会三合半合六合、六冲相刑相害相破与暗合伏吟全览（共检测出{' '}
            {items.length} 组关系）
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="minglu-empty-card">本局未检出所列柱间关系。</div>
      ) : (
        <div className="minglu-card-grid minglu-card-grid-2">
          {items.map((item) => (
            <div
              key={item.id}
              id={item.anchorId}
              className={`minglu-card minglu-interaction-card is-${item.nature === '吉' ? 'good' : item.nature === '凶' ? 'bad' : 'neutral'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="minglu-card-badge">{item.category}</span>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {item.name}
                  </h4>
                </div>
                <span
                  className={`minglu-pill is-${item.nature === '吉' ? 'green' : item.nature === '凶' ? 'red' : 'gray'}`}
                >
                  {item.conditionStatus ?? item.nature}
                </span>
              </div>

              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                涉及柱位：{item.involvedPillars.join(' 与 ')} · 干支：
                {item.involvedStemsBranches.join('、')}
                {item.transformElement && ` · 对应五行：${item.transformElement}`}
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                {item.description}
              </p>
              {item.conditionEvidence?.map((evidence) => (
                <p key={evidence} className="text-xs text-slate-500 mb-1">
                  {evidence}
                </p>
              ))}

              <div className="text-xs p-2 rounded">
                作用影响：{item.influence}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
