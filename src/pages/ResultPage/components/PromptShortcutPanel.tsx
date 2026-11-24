import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type ShortcutAction = { label: string };

interface PromptShortcutSection {
  key: string;
  title: string;
  description: string;
  labels: readonly string[];
}

interface PromptShortcutPanelProps {
  actions: ReadonlyArray<ShortcutAction>;
  activeMode: string;
  onApplyMode: (mode: string) => void;
  showCustomAndInspiration: boolean;
  customDraft: string;
  onCustomDraftChange: (value: string) => void;
  customPlaceholder: string;
  onOpenInspiration: () => void;
  quickGridClassName?: string;
  showCustomAction?: boolean;
  showInspirationAction?: boolean;
  alwaysShowCustomField?: boolean;
  customFieldTitle?: string;
  sections?: ReadonlyArray<PromptShortcutSection>;
  afterShortcuts?: ReactNode;
}

export function PromptShortcutPanel({
  actions,
  activeMode,
  onApplyMode,
  showCustomAndInspiration,
  customDraft,
  onCustomDraftChange,
  customPlaceholder,
  onOpenInspiration,
  quickGridClassName,
  showCustomAction = showCustomAndInspiration,
  showInspirationAction = showCustomAndInspiration,
  alwaysShowCustomField = false,
  customFieldTitle = '自定义问题',
  sections,
  afterShortcuts,
}: PromptShortcutPanelProps) {
  const actionMap = useMemo(() => new Map(actions.map((item) => [item.label, item])), [actions]);
  const normalizedSections = useMemo(() => {
    if (!sections || sections.length === 0) {
      return [];
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.labels
          .map((label) => actionMap.get(label))
          .filter((item): item is ShortcutAction => Boolean(item)),
      }))
      .filter((section) => section.items.length > 0);
  }, [actionMap, sections]);
  const sectionLabelSet = useMemo(
    () => new Set(normalizedSections.flatMap((section) => section.items.map((item) => item.label))),
    [normalizedSections],
  );
  const ungroupedActions = useMemo(
    () => actions.filter((item) => !sectionLabelSet.has(item.label)),
    [actions, sectionLabelSet],
  );
  const hasCustomSection = showCustomAction || showInspirationAction;
  const customActionCount = Number(showInspirationAction) + Number(showCustomAction);
  const hasSectionLayout = normalizedSections.length > 0 || hasCustomSection;

  const defaultExpandedKey = useMemo(() => {
    if (hasCustomSection && (activeMode === '自定义' || activeMode === '问题灵感')) {
      return 'custom';
    }

    if (normalizedSections.length === 0) {
      return '';
    }

    const matched = normalizedSections.find((section) =>
      section.items.some((item) => item.label === activeMode),
    );
    return matched?.key ?? normalizedSections[0]?.key ?? '';
  }, [activeMode, hasCustomSection, normalizedSections]);
  const [expandedKey, setExpandedKey] = useState(defaultExpandedKey);

  useEffect(() => {
    setExpandedKey(defaultExpandedKey);
  }, [defaultExpandedKey]);

  const isCustomSectionExpanded = hasCustomSection && expandedKey === 'custom';
  const shouldShowCustomField = isCustomSectionExpanded || alwaysShowCustomField;

  return (
    <>
      {hasSectionLayout ? (
        <div className="workspace-prompt-sections">
          {normalizedSections.map((section) => {
            const isExpanded = expandedKey === section.key;

            return (
              <section
                key={section.key}
                className={`workspace-prompt-section ${isExpanded ? 'is-expanded' : ''}`}
              >
                <Button
                  type="button"
                  className="workspace-prompt-section-head"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedKey(section.key)}
                >
                  <span className="workspace-prompt-section-copy">
                    <strong>{section.title}</strong>
                    <small>{section.description}</small>
                  </span>
                  <span className="workspace-prompt-section-state">
                    {isExpanded ? '已展开' : `${section.items.length} 项`}
                  </span>
                </Button>

                {isExpanded ? (
                  <div
                    className={`workspace-ui-choice-grid${quickGridClassName ? `${quickGridClassName}` : ''}`}
                  >
                    {section.items.map((item) => (
                      <Button
                        key={item.label}
                        type="button"
                        variant={activeMode === item.label ? 'secondary' : 'outline'}
                        onClick={() => onApplyMode(item.label)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}

          {ungroupedActions.length > 0 ? (
            <div
              className={`workspace-ui-choice-grid${quickGridClassName ? `${quickGridClassName}` : ''}`}
            >
              {ungroupedActions.map((item) => (
                <Button
                  key={item.label}
                  type="button"
                  variant={activeMode === item.label ? 'secondary' : 'outline'}
                  onClick={() => onApplyMode(item.label)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          ) : null}

          {hasCustomSection ? (
            <section
              className={`workspace-prompt-section ${isCustomSectionExpanded ? 'is-expanded' : ''}`}
            >
              <Button
                type="button"
                className="workspace-prompt-section-head"
                aria-expanded={isCustomSectionExpanded}
                onClick={() => setExpandedKey('custom')}
              >
                <span className="workspace-prompt-section-copy">
                  <strong>自定义提问</strong>
                  <small>直接输入真实问题，不确定怎么问时可以先看问题灵感。</small>
                </span>
                <span className="workspace-prompt-section-state">
                  {isCustomSectionExpanded ? '已展开' : `${customActionCount} 项`}
                </span>
              </Button>

              {isCustomSectionExpanded ? (
                <div
                  className={`workspace-ui-choice-grid${quickGridClassName ? `${quickGridClassName}` : ''}`}
                >
                  {showInspirationAction ? (
                    <Button
                      type="button"
                      variant={activeMode === '问题灵感' ? 'secondary' : 'outline'}
                      onClick={onOpenInspiration}
                    >
                      问题灵感
                    </Button>
                  ) : null}
                  {showCustomAction ? (
                    <Button
                      type="button"
                      variant={activeMode === '自定义' ? 'secondary' : 'outline'}
                      onClick={() => onApplyMode('自定义')}
                    >
                      直接输入问题
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : (
        <div
          className={`workspace-ui-choice-grid${quickGridClassName ? `${quickGridClassName}` : ''}`}
        >
          {actions.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant={activeMode === item.label ? 'secondary' : 'outline'}
              onClick={() => onApplyMode(item.label)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}

      {afterShortcuts}

      {shouldShowCustomField ? (
        <Label className="workspace-ui-field">
          <span>{customFieldTitle}</span>
          <Textarea
            rows={6}
            value={customDraft}
            placeholder={customPlaceholder}
            onChange={(event) => onCustomDraftChange(event.target.value)}
          />
        </Label>
      ) : null}
    </>
  );
}
