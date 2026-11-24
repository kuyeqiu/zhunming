import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PrivacyHint } from '@/components/PrivacyHint';
import { getPersonReferenceLabel, type PersonRole } from '@/lib/input-labels';
import {
  sortPersonalCasesForQuickSwitch,
  upsertCompatibilityHistory,
  upsertPersonalHistory,
  type PersonalHistoryRecord,
} from '@/lib/history-records';
import {
  createDefaultPromptState,
  defaultInputState,
  hasCompletePreciseBirthData,
  parseInputState,
  type PromptSourceKey,
  type QueryInputState,
  type ResultTabKey,
} from '@/lib/query-state';
import {
  buildChartRecordPath,
  CHART_RECORD_PARAM,
  normalizeChartInputForSource,
} from '@/lib/case-navigation';
import { clampNumericField, isValidHourMinute, validateBirthInput } from '@/lib/input-validation';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import {
  applyPersonalCaseToCompatibilityPerson,
  hydratePersonalCaseInput,
} from '@/lib/compatibility-case-selection';
import { isChartWorkspaceId, type ChartWorkspaceId } from '@/lib/workspace';
import type { InstantTimeStandard } from 'mingyu-core/instant';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  getInstantChartTypeForWorkspace,
  instantChartNeedsObserver,
} from '@/lib/instant-chart';
import {
  buildWorkspaceLaunchState,
  readWorkspaceLaunchState,
  type WorkspaceLaunchState,
} from '@/lib/workspace-launch';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';
import { BaziReverseInput } from '@/components/BaziReverseInput';
import { PersonForm, type PersonInputMode } from './InputPage.PersonForm';
import {
  WorkspaceButton,
  WorkspaceDialog,
  WorkspacePage,
} from '@/components/workspace/WorkspaceUI';
import { DropdownSelect, type DropdownSelectOption } from '@/components/DropdownSelect';
import {
  getFieldKey,
  getPersonInputMode,
  applyPersonReverseSelection,
  type SELF_FIELD_MAP,
} from './InputPage.field-helpers';
import { parseBaziReverseSource, type BaziReverseResolvedInput } from '@/lib/bazi-reverse-input';
import { getDailyHexagramLot, getDailyFortune } from '@/lib/hexagram-lot';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type ChartToolConfig = {
  label: string;
  chartType: QueryInputState['chartType'];
  promptSource: PromptSourceKey;
  resultTab: ResultTabKey;
  preciseBirthData: boolean;
  compatibility: boolean;
  allowUnknownTime: boolean;
};

type CompatibilityPromptSource = Extract<PromptSourceKey, 'bazi' | 'ziwei' | 'bazi-ziwei'>;

const COMPATIBILITY_PROMPT_SOURCE_OPTIONS: readonly DropdownSelectOption<CompatibilityPromptSource>[] =
  [
    { value: 'bazi', label: '八字' },
    { value: 'ziwei', label: '紫微斗数' },
    { value: 'bazi-ziwei', label: '八字紫微合参' },
  ];

const REVERSE_SOURCE_INVALIDATING_FIELDS: readonly (keyof typeof SELF_FIELD_MAP)[] = [
  'dateType',
  'year',
  'month',
  'day',
  'timeIndex',
  'isLeapMonth',
  'useTrueSolarTime',
  'birthHour',
  'birthMinute',
  'birthSecond',
];

const CHART_TOOL_CONFIG: Record<ChartWorkspaceId, ChartToolConfig> = {
  bazi: {
    label: '八字',
    chartType: 'bazi',
    promptSource: 'bazi',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: false,
    allowUnknownTime: true,
  },
  ziwei: {
    label: '紫微斗数',
    chartType: 'ziwei',
    promptSource: 'ziwei',
    resultTab: 'ziwei',
    preciseBirthData: false,
    compatibility: false,
    allowUnknownTime: false,
  },
  'bazi-ziwei': {
    label: '八字紫微合参',
    chartType: 'bazi',
    promptSource: 'bazi-ziwei',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: false,
    allowUnknownTime: false,
  },
  'qimen-lifetime': {
    label: '奇门终身局',
    chartType: 'bazi',
    promptSource: 'qimen-lifetime',
    resultTab: 'qimen-lifetime',
    preciseBirthData: false,
    compatibility: false,
    allowUnknownTime: false,
  },
  astrolabe: {
    label: '西洋星盘',
    chartType: 'astrolabe',
    promptSource: 'astrolabe',
    resultTab: 'astrolabe',
    preciseBirthData: true,
    compatibility: false,
    allowUnknownTime: false,
  },
  qizheng: {
    label: '七政四余',
    chartType: 'astrolabe',
    promptSource: 'qizheng',
    resultTab: 'qizheng',
    preciseBirthData: true,
    compatibility: false,
    allowUnknownTime: false,
  },
  bazhai: {
    label: '八宅风水',
    chartType: 'bazi',
    promptSource: 'bazhai',
    resultTab: 'bazhai',
    preciseBirthData: false,
    compatibility: false,
    allowUnknownTime: false,
  },
  compatibility: {
    label: '双人合盘',
    chartType: 'bazi',
    promptSource: 'bazi',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: true,
    allowUnknownTime: false,
  },
};

function createFormForTool(config: ChartToolConfig): QueryInputState {
  return {
    ...defaultInputState,
    analysisMode: config.compatibility ? 'compatibility' : 'single',
    chartType: config.chartType,
    useTrueSolarTime: false,
  };
}

function normalizeFormForTool(input: QueryInputState, config: ChartToolConfig): QueryInputState {
  return {
    ...normalizeChartInputForSource(input, config.promptSource),
    analysisMode: config.compatibility ? 'compatibility' : 'single',
  };
}

function createFormFromLocation(
  searchParams: URLSearchParams,
  config: ChartToolConfig,
  routeCase: PersonalHistoryRecord | null,
  launchState?: WorkspaceLaunchState,
) {
  const hasInputSnapshot = searchParams.has('y') || searchParams.has('year');
  const snapshot = hasInputSnapshot ? parseInputState(searchParams) : createFormForTool(config);
  if (!routeCase && !hasInputSnapshot && launchState) {
    if (launchState.initialGender) {
      snapshot.gender = launchState.initialGender === '女' ? 'female' : 'male';
    }
    if (launchState.initialBirthYear) {
      snapshot.year = launchState.initialBirthYear;
    }
  }
  const input = routeCase ? hydratePersonalCaseInput(snapshot, routeCase) : snapshot;
  return normalizeFormForTool(input, config);
}

export function InputPage({ mode = 'chart' }: { mode?: 'chart' | 'profile' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const launchState = useMemo(() => readWorkspaceLaunchState(location.state), [location.state]);
  const { tool: toolParam } = useParams();
  const [searchParams] = useSearchParams();
  const [, startSubmitTransition] = useTransition();
  const tool = isChartWorkspaceId(toolParam) ? toolParam : null;
  const config = tool ? CHART_TOOL_CONFIG[tool] : CHART_TOOL_CONFIG.bazi;
  // 合盘不再是单独工具入口：个人资料页内的开关，打开后追加“对方资料”
  const [compatMode, setCompatMode] = useState(config.compatibility);
  const dailyHexagramLot = useMemo(() => getDailyHexagramLot(), []);
  const dailyFortune = useMemo(() => getDailyFortune(dailyHexagramLot), [dailyHexagramLot]);
  const { cases, activeCaseId } = useActivePersonalCase();
  const routeCaseId = searchParams.get(CHART_RECORD_PARAM);
  const routeCase = useMemo(
    () => cases.find((record) => record.id === routeCaseId) ?? null,
    [cases, routeCaseId],
  );
  const [form, setForm] = useState<QueryInputState>(() =>
    createFormFromLocation(searchParams, config, routeCase, launchState),
  );
  const [compatibilityPromptSource, setCompatibilityPromptSource] =
    useState<CompatibilityPromptSource>('bazi');
  const [error, setError] = useState('');
  const [isInstantDialogOpen, setIsInstantDialogOpen] = useState(false);
  const [casePickerRole, setCasePickerRole] = useState<PersonRole | null>(null);
  const [caseSearchText, setCaseSearchText] = useState('');
  const [personInputKeys, setPersonInputKeys] = useState({ self: 0, partner: 0 });
  const [instantTimeStandard, setInstantTimeStandard] = useState<InstantTimeStandard>('beijing');
  const [resumeInstantDialogAfterPlace, setResumeInstantDialogAfterPlace] = useState(false);
  const [personInputModes, setPersonInputModes] = useState<Record<PersonRole, PersonInputMode>>(
    () => ({
      self: getPersonInputMode(form, 'self'),
      partner: getPersonInputMode(form, 'partner'),
    }),
  );
  const birthPlace = useBirthPlace({ form, setForm });
  const instantType = getInstantChartTypeForWorkspace(mode === 'profile' ? 'bazi' : (tool ?? ''));
  // profile 模式（/profile 岁庚）：不依赖路由 tool 参数，强制按八字口径建表；
  // chart 模式从排盘菜单带 ?auto=1 进来时，case 数据齐全即跳过表单直接出盘。
  const autoSubmit = mode === 'chart' && searchParams.get('auto') === '1';
  const didAutoSubmitRef = useRef(false);
  const visibleCases = useMemo(() => {
    const query = caseSearchText.trim().toLowerCase();
    return sortPersonalCasesForQuickSwitch(cases).filter((record) => {
      if (!query) return true;
      return `${record.name} ${record.birthText} ${record.input.birthPlace}`
        .toLowerCase()
        .includes(query);
    });
  }, [caseSearchText, cases]);

  useEffect(() => {
    if (!tool) return;
    const nextConfig = CHART_TOOL_CONFIG[tool];
    setError('');
    setCompatMode(nextConfig.compatibility);
    const nextForm = createFormFromLocation(searchParams, nextConfig, routeCase);
    setForm(nextForm);
    setCompatibilityPromptSource('bazi');
    setPersonInputModes({
      self: getPersonInputMode(nextForm, 'self'),
      partner: getPersonInputMode(nextForm, 'partner'),
    });
  }, [location.key, routeCase, searchParams, tool]);

  // chart 模式 + ?auto=1：首次 mount 后表单已由 case/URL 参数水合，直接走提交
  useEffect(() => {
    if (!autoSubmit || didAutoSubmitRef.current) return;
    didAutoSubmitRef.current = true;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCompatMode() {
    const next = !compatMode;
    setCompatMode(next);
    setForm((current) => ({
      ...current,
      analysisMode: next ? 'compatibility' : 'single',
    }));
    setError('');
  }

  useEffect(() => {
    if (!resumeInstantDialogAfterPlace || birthPlace.isBirthPlaceModalOpen) return;
    if (buildFrontendInstantObserver(form)) {
      setIsInstantDialogOpen(true);
    }
    setResumeInstantDialogAfterPlace(false);
  }, [birthPlace.isBirthPlaceModalOpen, form, resumeInstantDialogAfterPlace]);

  if (!tool && mode !== 'profile') {
    return <Navigate to="/chart" replace />;
  }

  // 首页入场（?entry=dialog）：个人信息（八字）以弹出小窗呈现，
  // 不渲染整页外壳；问题经 launch state 在提交时带到结果页。
  const isDialogEntry = searchParams.get('entry') === 'dialog';

  if (isDialogEntry) {
    return (
      <div className="workspace-input-dialog-overlay">
        <section className="workspace-input-dialog-card" aria-label={`${config.label}个人信息`}>
          <PersonForm
            role="self"
            form={form}
            updatePersonField={updatePersonField}
            updateNumericField={updateNumericField}
            updateBirthTime={updateBirthTime}
            openBirthPlaceModal={birthPlace.openBirthPlaceModal}
            sectionTitle={config.label}
            forcePreciseBirthPlace={config.preciseBirthData}
            inputMode={personInputModes.self}
            onInputModeChange={(mode) => changePersonInputMode('self', mode)}
            allowUnknownTime={config.allowUnknownTime}
          />
          {error ? <div className="workspace-ui-form-error">{error}</div> : null}
          <div className="workspace-input-dialog-actions">
            <WorkspaceButton variant="primary" size="large" block onClick={handleSubmit}>
              开始
            </WorkspaceButton>
          </div>
        </section>
        {birthPlace.isBirthPlaceModalOpen ? (
          <BirthPlaceModal birthPlace={birthPlace} purpose="birth" />
        ) : null}
      </div>
    );
  }

  function updatePersonField(
    role: PersonRole,
    key: keyof typeof SELF_FIELD_MAP,
    value: QueryInputState[keyof QueryInputState],
  ) {
    const fieldKey = getFieldKey(role, key) as keyof QueryInputState;
    setForm((current) => ({
      ...current,
      [fieldKey]: value as QueryInputState[keyof QueryInputState],
      ...(key === 'dateType' && value === 'solar'
        ? { [getFieldKey(role, 'isLeapMonth')]: false }
        : {}),
      ...(REVERSE_SOURCE_INVALIDATING_FIELDS.includes(key)
        ? { [getFieldKey(role, 'reverseSource')]: '' }
        : {}),
    }));
  }

  function updateNumericField(
    role: PersonRole,
    key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute' | 'birthSecond',
    value: string,
  ) {
    if (value === '' || /^\d*$/.test(value)) {
      updatePersonField(
        role,
        key,
        clampNumericField(key === 'birthSecond' ? 'birthMinute' : key, value),
      );
    }
  }

  function updateBirthTime(role: PersonRole, value: string) {
    if (!value) {
      updatePersonField(role, 'birthHour', '');
      updatePersonField(role, 'birthMinute', '');
      updatePersonField(role, 'birthSecond', '');
      return;
    }
    const [hour, minute, second = ''] = value.split(':');
    updatePersonField(role, 'birthHour', hour);
    updatePersonField(role, 'birthMinute', minute);
    updatePersonField(role, 'birthSecond', second);
  }

  function changePersonInputMode(role: PersonRole, mode: PersonInputMode) {
    if (mode === personInputModes[role]) return;
    setPersonInputModes((current) => ({ ...current, [role]: mode }));
    if (mode !== 'pillars') {
      updatePersonField(role, 'dateType', mode);
    }
    setError('');
  }

  function applyReverseSelection(role: PersonRole, selection: BaziReverseResolvedInput) {
    setForm((current) => applyPersonReverseSelection(current, role, selection));
    setError('');
  }

  function openCasePicker(role: PersonRole) {
    setCaseSearchText('');
    setCasePickerRole(role);
  }

  function closeCasePicker() {
    setCasePickerRole(null);
    setCaseSearchText('');
  }

  function chooseCase(record: PersonalHistoryRecord) {
    if (!casePickerRole) return;
    setPersonInputKeys((current) => ({
      ...current,
      [casePickerRole]: current[casePickerRole] + 1,
    }));
    const nextForm = applyPersonalCaseToCompatibilityPerson(form, record, casePickerRole);
    setForm(nextForm);
    setPersonInputModes((current) => ({
      ...current,
      [casePickerRole]: getPersonInputMode(nextForm, casePickerRole),
    }));
    setError('');
    closeCasePicker();
  }

  function validatePerson(role: PersonRole) {
    const isPartner = role === 'partner';
    const label = getPersonReferenceLabel(form.analysisMode, role);
    const year = isPartner ? form.partnerYear : form.year;
    const month = isPartner ? form.partnerMonth : form.month;
    const day = isPartner ? form.partnerDay : form.day;
    const timeIndex = isPartner ? form.partnerTimeIndex : form.timeIndex;
    const useTrueSolarTime = isPartner ? form.partnerUseTrueSolarTime : form.useTrueSolarTime;
    const birthHour = isPartner ? form.partnerBirthHour : form.birthHour;
    const birthMinute = isPartner ? form.partnerBirthMinute : form.birthMinute;
    const birthSecond = isPartner ? form.partnerBirthSecond : form.birthSecond;
    const birthPlaceText = isPartner ? form.partnerBirthPlace : form.birthPlace;
    const birthLongitude = isPartner ? form.partnerBirthLongitude : form.birthLongitude;
    const dateType = isPartner ? form.partnerDateType : form.dateType;
    const isLeapMonth = isPartner ? form.partnerIsLeapMonth : form.isLeapMonth;
    const hasClockInput = birthHour !== '' || birthMinute !== '' || birthSecond !== '';
    const hasCompleteClock = birthHour !== '' && birthMinute !== '';

    if (
      personInputModes[role] === 'pillars' &&
      !parseBaziReverseSource(String(form[getFieldKey(role, 'reverseSource')]))
    ) {
      return `请先为${label}选择一个可回填的四柱候选时段`;
    }
    if (!year || !month || !day) return `请填写完整的${label}信息`;
    const requiresPreciseBirthData = role === 'self' && config.preciseBirthData;
    const validateAsPreciseBirthData = useTrueSolarTime || requiresPreciseBirthData;
    if ((validateAsPreciseBirthData || hasClockInput) && !hasCompleteClock) {
      return `请填写${label}的精准出生时间`;
    }
    if (
      !validateAsPreciseBirthData &&
      !hasCompleteClock &&
      (timeIndex === '' || (timeIndex === -1 && (!config.allowUnknownTime || role !== 'self')))
    ) {
      return `请选择${label}的出生时辰`;
    }
    if (hasCompleteClock && !isValidHourMinute(Number(birthHour), Number(birthMinute))) {
      return `${label}出生时间需在有效时分范围内`;
    }
    if (validateAsPreciseBirthData && (!birthPlaceText.trim() || !birthLongitude.trim())) {
      return `请先为${label}选择出生地`;
    }

    const result = validateBirthInput(
      {
        year,
        month,
        day,
        dateType,
        isLeapMonth,
        useTrueSolarTime: validateAsPreciseBirthData,
        birthHour,
        birthMinute,
        birthLongitude,
      },
      label,
    );
    if (result.ok && birthSecond !== '') {
      const second = Number(birthSecond);
      if (!Number.isInteger(second) || second < 0 || second > 59) {
        return `${label}出生秒数需在 0-59 之间`;
      }
    }
    return result.ok ? '' : result.message;
  }

  function handleSubmit() {
    setError('');
    const selfError = validatePerson('self');
    if (selfError) {
      setError(selfError);
      return;
    }
    let recordId: string | undefined;
    const promptSource = compatMode ? compatibilityPromptSource : config.promptSource;
    try {
      if (compatMode) {
        const partnerError = validatePerson('partner');
        if (partnerError) {
          setError(partnerError);
          return;
        }
        recordId = upsertCompatibilityHistory(form)[0]?.id;
      } else {
        recordId = upsertPersonalHistory(
          form,
          config.promptSource,
          routeCaseId ?? activeCaseId ?? undefined,
        )[0]?.id;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '案例保存失败，请稍后重试');
      return;
    }

    startSubmitTransition(() => {
      if (mode === 'profile' && !compatMode) {
        // 岁庚页：资料已入库，去排盘菜单选盘
        navigate('/chart');
        return;
      }
      const promptDefaults = createDefaultPromptState();
      navigate(
        buildChartRecordPath(
          form,
          {
            ...promptDefaults,
            tab: config.resultTab,
            promptSource,
            baziShortcutMode: compatMode ? '合婚' : promptDefaults.baziShortcutMode,
            baziPresetId: compatMode ? 'ai-compat-marriage' : promptDefaults.baziPresetId,
          },
          recordId,
        ),
        {
          state: buildWorkspaceLaunchState(launchState.initialQuestion, {
            supplementaryInfo: launchState.initialSupplementaryInfo,
          }),
        },
      );
    });
  }

  function openInstantLocationPicker() {
    setIsInstantDialogOpen(false);
    setResumeInstantDialogAfterPlace(true);
    birthPlace.openBirthPlaceModal('self');
  }

  function handleInstantSubmit() {
    if (!instantType) return;
    setError('');
    const observer = buildFrontendInstantObserver(form);
    if (instantChartNeedsObserver(instantType, instantTimeStandard) && !observer) {
      setError('请先选择观测地点，再使用这一时间口径即时起盘。');
      openInstantLocationPicker();
      return;
    }
    setIsInstantDialogOpen(false);
    startSubmitTransition(() => {
      navigate(
        buildInstantResultPath({
          type: instantType,
          timeStandard: instantTimeStandard,
          observer,
        }),
        {
          state: buildWorkspaceLaunchState(launchState.initialQuestion, {
            supplementaryInfo: launchState.initialSupplementaryInfo,
          }),
        },
      );
    });
  }

  const selfReverseSource = parseBaziReverseSource(form.birthReverseSource);
  const selfReverseInputKey = [
    'self',
    location.key,
    personInputKeys.self,
    selfReverseSource?.pillars.year,
    selfReverseSource?.pillars.month,
    selfReverseSource?.pillars.day,
    selfReverseSource?.pillars.hour,
    selfReverseSource?.intervalStart,
    selfReverseSource?.intervalEnd,
  ].join('|');
  const partnerReverseSource = parseBaziReverseSource(form.partnerBirthReverseSource);
  const partnerReverseInputKey = [
    'partner',
    location.key,
    personInputKeys.partner,
    partnerReverseSource?.pillars.year,
    partnerReverseSource?.pillars.month,
    partnerReverseSource?.pillars.day,
    partnerReverseSource?.pillars.hour,
    partnerReverseSource?.intervalStart,
    partnerReverseSource?.intervalEnd,
  ].join('|');

  function renderFormLayout() {
    return (
      <>
        {compatMode ? (
          <div className="workspace-ui-form-row">
            <div className="workspace-ui-field">
              <Label htmlFor="compatibility-method-select">合盘方法</Label>
              <DropdownSelect<CompatibilityPromptSource>
                id="compatibility-method-select"
                value={compatibilityPromptSource}
                options={COMPATIBILITY_PROMPT_SOURCE_OPTIONS}
                onChange={setCompatibilityPromptSource}
                ariaLabel="合盘方法"
                prefix="方法"
                variant="field"
              />
            </div>
          </div>
        ) : null}
        <div className={`workspace-ui-form-layout${compatMode ? ' is-two-column' : ''}`}>
          <PersonForm
            role="self"
            form={form}
            updatePersonField={updatePersonField}
            updateNumericField={updateNumericField}
            updateBirthTime={updateBirthTime}
            openBirthPlaceModal={birthPlace.openBirthPlaceModal}
            sectionTitle={compatMode ? '本人资料' : '出生资料'}
            headerAction={
              compatMode ? (
                <WorkspaceButton size="small" variant="primary" onClick={() => openCasePicker('self')}>
                  从案例选择
                </WorkspaceButton>
              ) : null
            }
            footerHint={
              routeCase &&
              (config.preciseBirthData || form.useTrueSolarTime) &&
              !hasCompletePreciseBirthData(routeCase.input)
                ? `填写后会补全“${routeCase.name}”，以后无需重复输入。`
                : null
            }
            forcePreciseBirthPlace={config.preciseBirthData}
            inputMode={personInputModes.self}
            onInputModeChange={(mode) => changePersonInputMode('self', mode)}
            reversePanel={
              <BaziReverseInput
                key={selfReverseInputKey}
                source={selfReverseSource}
                onInvalidate={() => updatePersonField('self', 'reverseSource', '')}
                onSelect={(selection) => applyReverseSelection('self', selection)}
              />
            }
            reverseSource={selfReverseSource}
            allowUnknownTime={config.allowUnknownTime}
            compact={mode === 'profile'}
          />
          {compatMode ? (
            <PersonForm
              role="partner"
              form={form}
              updatePersonField={updatePersonField}
              updateNumericField={updateNumericField}
              updateBirthTime={updateBirthTime}
              openBirthPlaceModal={birthPlace.openBirthPlaceModal}
              sectionTitle="对方资料"
              headerAction={
                <WorkspaceButton size="small" variant="primary" onClick={() => openCasePicker('partner')}>
                  从案例选择
                </WorkspaceButton>
              }
              inputMode={personInputModes.partner}
              onInputModeChange={(mode) => changePersonInputMode('partner', mode)}
              reversePanel={
                <BaziReverseInput
                  key={partnerReverseInputKey}
                  source={partnerReverseSource}
                  onInvalidate={() => updatePersonField('partner', 'reverseSource', '')}
                  onSelect={(selection) => applyReverseSelection('partner', selection)}
                />
              }
              reverseSource={partnerReverseSource}
              compact={mode === 'profile'}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className={`workspace-input-page${compatMode ? ' is-compatibility' : ''}`}>
      <WorkspacePage
        title={
          compatMode
            ? mode === 'profile'
              ? '岁庚合盘'
              : '双人合盘'
            : mode === 'profile'
              ? '岁庚'
              : config.label
        }
        width={compatMode ? 'wide' : mode === 'profile' ? 'wide' : 'default'}
        action={
          <div className="workspace-input-page-actions">
            {instantType ? (
              <WorkspaceButton
                size="small"
                variant="outline"
                onClick={() => setIsInstantDialogOpen(true)}
              >
                即时起盘
              </WorkspaceButton>
            ) : null}
            <WorkspaceButton
              size="small"
              variant={compatMode ? 'primary' : 'outline'}
              onClick={toggleCompatMode}
              aria-pressed={compatMode}
            >
              双人合盘
            </WorkspaceButton>
          </div>
        }
      >
        {mode === 'profile' && !compatMode ? (
          <div className="profile-ledger">
            <div className="profile-ledger-work">
              <aside className="profile-ledger-side" aria-label="已存岁庚">
              <div className="profile-ledger-side-head">
                <span>已存岁庚</span>
                <button
                  type="button"
                  className="profile-ledger-new"
                  onClick={() => navigate('/profile')}
                >
                  + 新岁庚
                </button>
              </div>
              {cases.length ? (
                <ul className="profile-ledger-list">
                  {sortPersonalCasesForQuickSwitch(cases).map((record) => (
                    <li key={record.id}>
                      <button
                        type="button"
                        className={`profile-ledger-item${record.id === (routeCaseId ?? activeCaseId) ? ' is-active' : ''}`}
                        onClick={() => navigate(`/profile?rid=${record.id}`)}
                      >
                        <span className="profile-ledger-item-name">{record.name}</span>
                        <span className="profile-ledger-item-meta">{record.birthText}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="profile-ledger-empty">还没有岁庚，右边填好资料存入后这里会列出来。</div>
              )}
              </aside>
              <div className="profile-ledger-form">
                <PrivacyHint />
                {renderFormLayout()}
                {error ? <div className="workspace-ui-form-error">{error}</div> : null}
                <div className="workspace-ui-form-actions is-sticky-mobile">
                  <WorkspaceButton variant="primary" size="large" block onClick={handleSubmit}>
                    存入岁庚
                  </WorkspaceButton>
                </div>
              </div>
            </div>
            <aside className="profile-hexagram" aria-label="今日之卦">
              <div className="profile-hexagram-main">
                <span className="profile-hexagram-glyph" aria-hidden="true">{dailyHexagramLot.glyph}</span>
                <div className="profile-hexagram-info">
                  <span className="profile-hexagram-name">{dailyHexagramLot.name}卦</span>
                  <span className="profile-hexagram-trigrams">{dailyHexagramLot.trigrams}</span>
                  <span className="profile-hexagram-quote">{dailyHexagramLot.text}</span>
                </div>
              </div>
              <div className="profile-hexagram-frame" aria-hidden="true" />
              <div className="profile-hexagram-fortune">
                <div className="profile-hexagram-fortune-head">
                  <span>今日吉凶</span>
                  <span className="profile-hexagram-verdict">{dailyFortune.verdict}</span>
                </div>
                <div className="profile-hexagram-fortune-body">
                  <span className="profile-hexagram-fortune-text">{dailyFortune.detail}</span>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <>
            <PrivacyHint />
            {renderFormLayout()}
            {error ? <div className="workspace-ui-form-error">{error}</div> : null}
            <div className="workspace-ui-form-actions is-sticky-mobile">
              <WorkspaceButton variant="primary" size="large" block onClick={handleSubmit}>
                {compatMode ? '查看合盘' : `查看完整${config.label}盘面`}
              </WorkspaceButton>
            </div>
          </>
        )}
      </WorkspacePage>

      {birthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal
          birthPlace={birthPlace}
          purpose={resumeInstantDialogAfterPlace ? 'observer' : 'birth'}
        />
      ) : null}
      {casePickerRole ? (
        <WorkspaceDialog
          className="compatibility-case-picker"
          labelledBy="compatibility-case-picker-title"
          onClose={closeCasePicker}
        >
          <header className="workspace-ui-dialog-header">
            <div>
              <h2 id="compatibility-case-picker-title">
                选择{casePickerRole === 'self' ? '本人' : '对方'}案例
              </h2>
              <p>选中后只替换这一方的出生资料。</p>
            </div>
            <WorkspaceButton
              variant="ghost"
              size="small"
              aria-label="关闭案例选择"
              onClick={closeCasePicker}
            >
              关闭
            </WorkspaceButton>
          </header>
          <div className="workspace-ui-dialog-body compatibility-case-picker-body">
            <Input
              type="search"
              className="compatibility-case-search"
              value={caseSearchText}
              placeholder="搜索姓名、日期或出生地"
              aria-label="搜索案例"
              onChange={(event) => setCaseSearchText(event.target.value)}
            />
            {visibleCases.length ? (
              <div className="compatibility-case-options">
                {visibleCases.map((record) => (
                  <Button
                    type="button"
                    key={record.id}
                    className="compatibility-case-option"
                    onClick={() => chooseCase(record)}
                  >
                    <span className="compatibility-case-option-mark" aria-hidden="true">
                      {record.name.trim().slice(0, 1) || '案'}
                    </span>
                    <span className="compatibility-case-option-copy">
                      <strong>{record.name}</strong>
                      <small>
                        {record.gender === 'male' ? '男' : '女'} · {record.birthText}
                        {record.input.birthPlace ? ` · ${record.input.birthPlace}` : ''}
                      </small>
                    </span>
                    {record.pinned ? <span className="compatibility-case-pinned">置顶</span> : null}
                    <span className="compatibility-case-option-arrow" aria-hidden="true">
                      ›
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="workspace-ui-empty">
                {cases.length ? '没有匹配的案例' : '还没有可选择的案例'}
              </div>
            )}
          </div>
        </WorkspaceDialog>
      ) : null}
      {isInstantDialogOpen && instantType ? (
        <WorkspaceDialog
          className="workspace-instant-dialog"
          labelledBy="workspace-instant-dialog-title"
          onClose={() => setIsInstantDialogOpen(false)}
        >
          <header className="workspace-ui-dialog-header">
            <div>
              <h2 id="workspace-instant-dialog-title">即时起盘</h2>
              <p>以点击起盘时的当前时刻生成，不加入案例。</p>
            </div>
          </header>
          <div className="workspace-ui-dialog-body workspace-instant-dialog-body">
            <div
              className="workspace-instant-standard is-dialog"
              role="group"
              aria-label="时间口径"
            >
              <Button
                type="button"
                className={instantTimeStandard === 'beijing' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'beijing'}
                onClick={() => setInstantTimeStandard('beijing')}
              >
                <strong>北京时间</strong>
                <small>按东八区当前时刻</small>
              </Button>
              <Button
                type="button"
                className={instantTimeStandard === 'true-solar' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'true-solar'}
                onClick={() => setInstantTimeStandard('true-solar')}
              >
                <strong>真太阳时</strong>
                <small>按地点经度校正</small>
              </Button>
            </div>
            {instantChartNeedsObserver(instantType, instantTimeStandard) ? (
              <Button
                type="button"
                className="workspace-instant-place is-dialog"
                onClick={openInstantLocationPicker}
              >
                <span>观测地点</span>
                <strong>{form.birthPlace || '选择地点'}</strong>
                <span aria-hidden="true">›</span>
              </Button>
            ) : null}
          </div>
          <footer className="workspace-ui-dialog-footer">
            <WorkspaceButton onClick={() => setIsInstantDialogOpen(false)}>取消</WorkspaceButton>
            <WorkspaceButton variant="primary" onClick={handleInstantSubmit}>
              立即起盘
            </WorkspaceButton>
          </footer>
        </WorkspaceDialog>
      ) : null}
    </div>
  );
}
