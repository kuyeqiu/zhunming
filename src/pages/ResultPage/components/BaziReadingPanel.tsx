import { memo, useMemo } from 'react';
import { formatUsefulGodFunctions, type BaziChartResult } from 'mingyu-core/bazi';
import { Button } from '@/components/ui/button';
import {
  getBaziDitiansuiAdvice,
  getBaziQiongtongAdvice,
  getBaziZipingPatternAdvice,
} from 'mingyu-core/classics';
import { formatBaziDecisionDetails } from '@/lib/bazi-decision-details';
import { useMetaphysicsTermModal } from '@/components/TermExplanationModal';
import {
  formatAvoidGodPrioritySummary,
  formatBaziDate,
  formatGender,
  formatUsefulGodPrioritySummary,
} from '../ResultPage.helpers';

/**
 * 结果页中栏「解读」：总断 + 取用依据 + 取用作用 + 典籍参考。
 * 视觉对应 drafts/result-page 中栏；卡片骨架复用 traditional-classic-*。
 */
export const BaziReadingPanel = memo(function BaziReadingPanel(props: {
  result: BaziChartResult;
  name: string;
}) {
  const { result, name } = props;
  const { openTerm } = useMetaphysicsTermModal();

  const dayMasterGan = result.dayMaster?.gan || result.pillars.day?.gan;
  const monthBranchZhi = result.pillars.month?.zhi;

  const qiongtongAdvice = useMemo(() => {
    if (!dayMasterGan || !monthBranchZhi) return undefined;
    return getBaziQiongtongAdvice(dayMasterGan, monthBranchZhi);
  }, [dayMasterGan, monthBranchZhi]);

  const ditiansuiAdvice = useMemo(() => {
    if (!dayMasterGan) return undefined;
    return getBaziDitiansuiAdvice(dayMasterGan);
  }, [dayMasterGan]);

  const zipingAdvice = useMemo(() => {
    const pattern = result.analysis.mingGe.pattern;
    if (!pattern) return undefined;
    return getBaziZipingPatternAdvice(pattern);
  }, [result.analysis.mingGe.pattern]);

  const functionalUse = formatUsefulGodFunctions(result.analysis.usefulGod);
  const decisionDetails = formatBaziDecisionDetails(result);
  const transformation = result.analysis.mingGe.transformation;
  const primaryUsefulWuxing =
    result.analysis.usefulGod.incrementStatus === '待判'
      ? undefined
      : result.analysis.usefulGod.primaryFavorableWuxing ||
        result.analysis.usefulGod.favorableWuxing?.[0];
  const primaryAvoidWuxing =
    result.analysis.usefulGod.incrementStatus === '待判'
      ? undefined
      : result.analysis.usefulGod.primaryUnfavorableWuxing ||
        result.analysis.usefulGod.unfavorableWuxing?.[0];
  const displayedUsefulWuxing =
    transformation?.status === '成化' ? transformation.element : primaryUsefulWuxing;

  const books: Array<{
    key: string;
    badge: string;
    title: string;
    verse?: string;
    verseLink?: string;
    advice: string;
  }> = [];
  if (qiongtongAdvice) {
    books.push({
      key: 'qiongtong',
      badge: '穷通宝鉴',
      title: `${dayMasterGan}日主生于${monthBranchZhi}月 · 调候参考`,
      verse: qiongtongAdvice.classicVerse,
      verseLink:
        'https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674',
      advice:
        `【调候要领】${qiongtongAdvice.modernExplanation}` +
        (qiongtongAdvice.primaryGods?.length
          ? `\n【条文取用候选（依原文条件）】${qiongtongAdvice.primaryGods.join('、')}`
          : '') +
        (qiongtongAdvice.taboos?.length
          ? `\n【条文所忌】${qiongtongAdvice.taboos.join('、')}`
          : ''),
    });
  }
  if (ditiansuiAdvice) {
    books.push({
      key: 'ditiansui',
      badge: '滴天髓',
      title: `${dayMasterGan}${ditiansuiAdvice.wuxing} · 日干体象`,
      verse: ditiansuiAdvice.verse,
      advice: `【体象概述】${ditiansuiAdvice.nature}\n【条件释义】${ditiansuiAdvice.modernAdvice}`,
    });
  }
  if (zipingAdvice) {
    books.push({
      key: 'ziping',
      badge: '子平真诠',
      title:
        (result.analysis.mingGe.pattern === zipingAdvice.pattern
          ? zipingAdvice.pattern
          : `${result.analysis.mingGe.pattern} · 参照${zipingAdvice.pattern}`) +
        ' · 格局精义',
      verse: zipingAdvice.verse || undefined,
      advice:
        `【格局要义】${zipingAdvice.rule}\n【现代解析】${zipingAdvice.modernAdvice}` +
        (zipingAdvice.taboos?.length ? `\n【破格防范】${zipingAdvice.taboos.join('、')}` : ''),
    });
  }

  return (
    <div className="rw-read">
      {/* 总断 */}
      <div className="rw-verdict">
        <h2 className="rw-verdict-title">
          {result.analysis.dayMasterStrength.status}
          <em> · </em>
          {result.analysis.mingGe.pattern || '格局待定'}
          {transformation?.status === '成化' ? (
            <>
              <em> · </em>化{transformation.element}
            </>
          ) : null}
        </h2>
        <p className="rw-verdict-use">
          取用 <b>{displayedUsefulWuxing || '待判'}</b>
          {' · '}所忌 <b>{primaryAvoidWuxing || '待判'}</b>
        </p>
        <p className="rw-verdict-meta">
          {name} · {formatGender(result.gender)} · {formatBaziDate(result)}
          {result.timing?.enabled ? ' · 真太阳时校正' : ''}
        </p>
      </div>

      {/* 旺衰与格局 */}
      <section className="rw-section">
        <h3 className="rw-sec-title">旺 衰 与 格 局</h3>
        <div className="rw-statline">
          <Button
            type="button"
            className="rw-stat is-clickable-term"
            onClick={() => openTerm('身旺')}
          >
            <span>旺衰</span>
            <strong>{result.analysis.dayMasterStrength.status}</strong>
            <small>
              {result.isThreePillars
                ? '月令与根气按候选分别核对'
                : `月令${result.analysis.dayMasterStrength.details.seasonalEffect} · ${
                    result.analysis.dayMasterStrength.details.hasRoot ? '有根' : '无根'
                  }`}
            </small>
          </Button>
          <Button
            type="button"
            className="rw-stat is-clickable-term"
            onClick={() => openTerm(result.analysis.mingGe.pattern || '格局')}
          >
            <span>命格</span>
            <strong>{result.analysis.mingGe.pattern}</strong>
            <small>{result.analysis.mingGe.isSpecial ? '特殊格局' : '月令取格'}</small>
          </Button>
          <Button
            type="button"
            className={`rw-stat${displayedUsefulWuxing ? ' is-clickable-term' : ''}`}
            onClick={() => displayedUsefulWuxing && openTerm(displayedUsefulWuxing)}
          >
            <span>取用</span>
            <strong>
              {transformation?.status === '成化'
                ? `化神${transformation.element}`
                : primaryUsefulWuxing || '待判'}
            </strong>
            <small>
              {transformation?.status === '成化'
                ? `原日主十神：${result.analysis.usefulGod.primaryUseful || result.analysis.usefulGod.useful || '待定'}`
                : formatUsefulGodPrioritySummary(result)}
            </small>
          </Button>
          <Button
            type="button"
            className={`rw-stat${primaryAvoidWuxing ? ' is-clickable-term' : ''}`}
            onClick={() => primaryAvoidWuxing && openTerm(primaryAvoidWuxing)}
          >
            <span>所忌</span>
            <strong>{primaryAvoidWuxing || '待判'}</strong>
            <small>{formatAvoidGodPrioritySummary(result)}</small>
          </Button>
        </div>
        {decisionDetails.map((line) => (
          <p key={line} className="rw-p">
            {line}
          </p>
        ))}
      </section>

      {functionalUse.length ? (
        <section className="rw-section">
          <h3 className="rw-sec-title">天 干 取 用 作 用</h3>
          {functionalUse.map((line) => (
            <p key={line} className="rw-p">
              {line}
            </p>
          ))}
        </section>
      ) : null}

      {books.map((book) => (
        <section className="rw-section" key={book.key}>
          <h3 className="rw-sec-title">
            <span className="rw-book-badge">{book.badge}</span>
            {book.title}
          </h3>
          {book.verse ? (
            <p className="rw-p rw-verse">
              {book.verse}
              {book.verseLink ? (
                <>
                  {' '}
                  <a href={book.verseLink} target="_blank" rel="noopener noreferrer">
                    查看原文
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {book.advice.split('\n').map((line) => (
            <p key={line} className="rw-p">
              {line}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
});
