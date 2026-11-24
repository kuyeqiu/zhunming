/**
 * 六十四卦水墨卦象与「今日之卦 / 今日吉凶」引擎。
 *
 * 选卦优先级：
 * 1. 页面语义关联卦（根据当前工具/页面选择贴合语境的卦池，并随时辰/日期动态流转）
 * 2. 当日 / 时辰卦（按本地日期与十二时辰定卦）
 * 3. 随缘换卦（支持交互式随机换卦，排除当前卦）
 */

export type YaoValue = 0 | 1; // 0 = 阴爻 (--), 1 = 阳爻 (—)

export type HexagramLot = {
  /** 周易卦序 1-64 */
  no: number;
  /** 卦画 unicode（䷀-䷿） */
  glyph: string;
  /** 卦名（不带「卦」字） */
  name: string;
  /** 上下卦，如「乾下乾上」 */
  trigrams: string;
  /** 《周易》卦辞 */
  text: string;
};

const TRIGRAM_LINES_BOTTOM_TO_TOP: Record<string, readonly [YaoValue, YaoValue, YaoValue]> = {
  乾: [1, 1, 1],
  坤: [0, 0, 0],
  震: [1, 0, 0],
  巽: [0, 1, 1],
  坎: [0, 1, 0],
  离: [1, 0, 1],
  艮: [0, 0, 1],
  兑: [1, 1, 0],
};

const TRIGRAM_NATURE: Record<string, string> = {
  乾: '天',
  坤: '地',
  震: '雷',
  巽: '风',
  坎: '水',
  离: '火',
  艮: '山',
  兑: '泽',
};

const SHICHEN_NAMES = [
  '子时',
  '丑时',
  '寅时',
  '卯时',
  '辰时',
  '巳时',
  '午时',
  '未时',
  '申时',
  '酉时',
  '戌时',
  '亥时',
] as const;

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

export const HEXAGRAM_LOTS: HexagramLot[] = [
  { no: 1, glyph: '䷀', name: '乾', trigrams: '乾下乾上', text: '元亨利贞。' },
  { no: 2, glyph: '䷁', name: '坤', trigrams: '坤下坤上', text: '元亨，利牝马之贞。君子有攸往，先迷后得主，利。西南得朋，东北丧朋。安贞吉。' },
  { no: 3, glyph: '䷂', name: '屯', trigrams: '震下坎上', text: '元亨，利贞。勿用有攸往，利建侯。' },
  { no: 4, glyph: '䷃', name: '蒙', trigrams: '坎下艮上', text: '亨。匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。利贞。' },
  { no: 5, glyph: '䷄', name: '需', trigrams: '乾下坎上', text: '有孚，光亨，贞吉。利涉大川。' },
  { no: 6, glyph: '䷅', name: '讼', trigrams: '坎下乾上', text: '有孚窒惕，中吉，终凶。利见大人，不利涉大川。' },
  { no: 7, glyph: '䷆', name: '师', trigrams: '坎下坤上', text: '贞，丈人吉，无咎。' },
  { no: 8, glyph: '䷇', name: '比', trigrams: '坤下坎上', text: '吉。原筮元永贞，无咎。不宁方来，后夫凶。' },
  { no: 9, glyph: '䷈', name: '小畜', trigrams: '乾下巽上', text: '亨。密云不雨，自我西郊。' },
  { no: 10, glyph: '䷉', name: '履', trigrams: '兑下乾上', text: '履虎尾，不咥人，亨。' },
  { no: 11, glyph: '䷊', name: '泰', trigrams: '乾下坤上', text: '小往大来，吉，亨。' },
  { no: 12, glyph: '䷋', name: '否', trigrams: '坤下乾上', text: '否之匪人，不利君子贞，大往小来。' },
  { no: 13, glyph: '䷌', name: '同人', trigrams: '离下乾上', text: '同人于野，亨。利涉大川，利君子贞。' },
  { no: 14, glyph: '䷍', name: '大有', trigrams: '乾下离上', text: '元亨。' },
  { no: 15, glyph: '䷎', name: '谦', trigrams: '艮下坤上', text: '亨，君子有终。' },
  { no: 16, glyph: '䷏', name: '豫', trigrams: '坤下震上', text: '利建侯行师。' },
  { no: 17, glyph: '䷐', name: '随', trigrams: '震下兑上', text: '元亨利贞，无咎。' },
  { no: 18, glyph: '䷑', name: '蛊', trigrams: '巽下艮上', text: '元亨，利涉大川。先甲三日，后甲三日。' },
  { no: 19, glyph: '䷒', name: '临', trigrams: '兑下坤上', text: '元亨利贞。至于八月有凶。' },
  { no: 20, glyph: '䷓', name: '观', trigrams: '坤下巽上', text: '盥而不荐，有孚颙若。' },
  { no: 21, glyph: '䷔', name: '噬嗑', trigrams: '震下离上', text: '亨。利用狱。' },
  { no: 22, glyph: '䷕', name: '贲', trigrams: '离下艮上', text: '亨。小利有攸往。' },
  { no: 23, glyph: '䷖', name: '剥', trigrams: '坤下艮上', text: '不利有攸往。' },
  { no: 24, glyph: '䷗', name: '复', trigrams: '震下坤上', text: '亨。出入无疾，朋来无咎。反复其道，七日来复。利有攸往。' },
  { no: 25, glyph: '䷘', name: '无妄', trigrams: '震下乾上', text: '元亨利贞。其匪正有眚，不利有攸往。' },
  { no: 26, glyph: '䷙', name: '大畜', trigrams: '乾下艮上', text: '利贞。不家食吉，利涉大川。' },
  { no: 27, glyph: '䷚', name: '颐', trigrams: '震下艮上', text: '贞吉。观颐，自求口实。' },
  { no: 28, glyph: '䷛', name: '大过', trigrams: '巽下兑上', text: '栋桡，利有攸往，亨。' },
  { no: 29, glyph: '䷜', name: '坎', trigrams: '坎下坎上', text: '有孚，维心亨，行有尚。' },
  { no: 30, glyph: '䷝', name: '离', trigrams: '离下离上', text: '利贞，亨。畜牝牛，吉。' },
  { no: 31, glyph: '䷞', name: '咸', trigrams: '艮下兑上', text: '亨，利贞。取女吉。' },
  { no: 32, glyph: '䷟', name: '恒', trigrams: '巽下震上', text: '亨，无咎，利贞，利有攸往。' },
  { no: 33, glyph: '䷠', name: '遁', trigrams: '艮下乾上', text: '亨，小利贞。' },
  { no: 34, glyph: '䷡', name: '大壮', trigrams: '乾下震上', text: '利贞。' },
  { no: 35, glyph: '䷢', name: '晋', trigrams: '坤下离上', text: '康侯用锡马蕃庶，昼日三接。' },
  { no: 36, glyph: '䷣', name: '明夷', trigrams: '离下坤上', text: '利艰贞。' },
  { no: 37, glyph: '䷤', name: '家人', trigrams: '离下巽上', text: '利女贞。' },
  { no: 38, glyph: '䷥', name: '睽', trigrams: '兑下离上', text: '小事吉。' },
  { no: 39, glyph: '䷦', name: '蹇', trigrams: '艮下坎上', text: '利西南，不利东北。利见大人，贞吉。' },
  { no: 40, glyph: '䷧', name: '解', trigrams: '坎下震上', text: '利西南。无所往，其来复吉。有攸往，夙吉。' },
  { no: 41, glyph: '䷨', name: '损', trigrams: '兑下艮上', text: '有孚，元吉，无咎，可贞，利有攸往。曷之用？二簋可用享。' },
  { no: 42, glyph: '䷩', name: '益', trigrams: '震下巽上', text: '利有攸往，利涉大川。' },
  { no: 43, glyph: '䷪', name: '夬', trigrams: '乾下兑上', text: '扬于王庭，孚号有厉。告自邑，不利即戎，利有攸往。' },
  { no: 44, glyph: '䷫', name: '姤', trigrams: '巽下乾上', text: '女壮，勿用取女。' },
  { no: 45, glyph: '䷬', name: '萃', trigrams: '坤下兑上', text: '亨。王假有庙。利见大人，亨，利贞。用大牲吉。利有攸往。' },
  { no: 46, glyph: '䷭', name: '升', trigrams: '巽下坤上', text: '元亨，用见大人，勿恤，南征吉。' },
  { no: 47, glyph: '䷮', name: '困', trigrams: '坎下兑上', text: '亨，贞，大人吉，无咎。有言不信。' },
  { no: 48, glyph: '䷯', name: '井', trigrams: '巽下坎上', text: '改邑不改井，无丧无得，往来井井。汔至亦未繘井，羸其瓶，凶。' },
  { no: 49, glyph: '䷰', name: '革', trigrams: '离下兑上', text: '巳日乃孚。元亨利贞，悔亡。' },
  { no: 50, glyph: '䷱', name: '鼎', trigrams: '巽下离上', text: '元吉，亨。' },
  { no: 51, glyph: '䷲', name: '震', trigrams: '震下震上', text: '亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。' },
  { no: 52, glyph: '䷳', name: '艮', trigrams: '艮下艮上', text: '艮其背，不获其身；行其庭，不见其人。无咎。' },
  { no: 53, glyph: '䷴', name: '渐', trigrams: '艮下巽上', text: '女归吉，利贞。' },
  { no: 54, glyph: '䷵', name: '归妹', trigrams: '兑下震上', text: '征凶，无攸利。' },
  { no: 55, glyph: '䷶', name: '丰', trigrams: '离下震上', text: '亨，王假之，勿忧，宜日中。' },
  { no: 56, glyph: '䷷', name: '旅', trigrams: '艮下离上', text: '小亨，旅贞吉。' },
  { no: 57, glyph: '䷸', name: '巽', trigrams: '巽下巽上', text: '小亨，利有攸往，利见大人。' },
  { no: 58, glyph: '䷹', name: '兑', trigrams: '兑下兑上', text: '亨，利贞。' },
  { no: 59, glyph: '䷺', name: '涣', trigrams: '坎下巽上', text: '亨。王假有庙，利涉大川，利贞。' },
  { no: 60, glyph: '䷻', name: '节', trigrams: '兑下坎上', text: '亨。苦节不可贞。' },
  { no: 61, glyph: '䷼', name: '中孚', trigrams: '兑下巽上', text: '豚鱼吉。利涉大川，利贞。' },
  { no: 62, glyph: '䷽', name: '小过', trigrams: '艮下震上', text: '亨，利贞。可小事，不可大事。飞鸟遗之音，不宜上，宜下，大吉。' },
  { no: 63, glyph: '䷾', name: '既济', trigrams: '离下坎上', text: '亨小，利贞。初吉终乱。' },
  { no: 64, glyph: '䷿', name: '未济', trigrams: '坎下离上', text: '亨。小狐汔济，濡其尾，无攸利。' },
];

/** 返回由上至下（上爻 → 初爻）的六爻阴阳数组，直接对应画面排版 */
export function getHexagramLines(
  lot: HexagramLot,
): readonly [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue] {
  const lowerName = lot.trigrams.slice(0, 1);
  const upperName = lot.trigrams.slice(2, 3);
  const lower = TRIGRAM_LINES_BOTTOM_TO_TOP[lowerName] ?? [1, 1, 1];
  const upper = TRIGRAM_LINES_BOTTOM_TO_TOP[upperName] ?? [1, 1, 1];
  // 画面从上到下依次为：上爻(upper[2])、五爻(upper[1])、四爻(upper[0])、三爻(lower[2])、二爻(lower[1])、初爻(lower[0])
  return [upper[2], upper[1], upper[0], lower[2], lower[1], lower[0]];
}

/** 传统全称：如「水风井」「地天泰」「乾为天」 */
export function getHexagramFullName(lot: HexagramLot): string {
  const lowerName = lot.trigrams.slice(0, 1);
  const upperName = lot.trigrams.slice(2, 3);
  const lowerNature = TRIGRAM_NATURE[lowerName] ?? lowerName;
  const upperNature = TRIGRAM_NATURE[upperName] ?? upperName;
  if (lowerName === upperName) {
    return `${lot.name}为${upperNature}`;
  }
  return `${upperNature}${lowerNature}${lot.name}`;
}

export function getShichenLabel(date = new Date()): string {
  // 23:00-00:59 为子时
  const index = Math.floor(((date.getHours() + 1) % 24) / 2);
  return SHICHEN_NAMES[index] ?? '子时';
}

export function formatSolarDateLabel(date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_NAMES[date.getDay()] ?? '';
  return `${month}月${day}日 · ${weekday}`;
}

function hash32(seed: number, salt: number) {
  let h = seed ^ salt;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getHexagramByNo(no: number): HexagramLot {
  return HEXAGRAM_LOTS[(no - 1 + HEXAGRAM_LOTS.length) % HEXAGRAM_LOTS.length] ?? HEXAGRAM_LOTS[0];
}

/** 当日卦：按本地日期定，换日换卦 */
export function getDailyHexagramLot(date = new Date()): HexagramLot {
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  return HEXAGRAM_LOTS[hash32(daySeed, 0x9e3779b9) % HEXAGRAM_LOTS.length];
}

/** 时辰卦：按时辰（12 时制）定，换时辰换卦 */
export function getHourlyHexagramLot(date = new Date()): HexagramLot {
  const hourIndex = Math.floor(((date.getHours() + 1) % 24) / 2);
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  return HEXAGRAM_LOTS[hash32(daySeed * 13 + hourIndex, 0x85ebca6b) % HEXAGRAM_LOTS.length];
}

/** 页面 / 工具语义关联卦池 */
const CONTEXT_HEXAGRAM_POOLS: Record<string, readonly number[]> = {
  // 排盘类
  'chart-menu': [1, 2, 11, 14, 20, 30, 50, 63],
  bazi: [1, 2, 11, 14, 24, 32, 46, 50],
  ziwei: [1, 14, 30, 35, 45, 50, 55, 63],
  'bazi-ziwei': [11, 13, 31, 42, 49, 50, 61, 63],
  'qimen-lifetime': [5, 7, 15, 29, 40, 48, 51, 57],
  astrolabe: [1, 14, 20, 22, 30, 35, 55, 64],
  qizheng: [1, 14, 20, 30, 35, 49, 55, 63],
  bazhai: [2, 15, 37, 45, 48, 52, 53, 60],
  compatibility: [11, 13, 17, 31, 32, 37, 53, 61],
  // 占问类
  liuyao: [1, 3, 5, 11, 15, 20, 24, 29, 30, 42, 48, 50, 61, 63, 64],
  meihua: [1, 2, 22, 24, 29, 30, 51, 52, 57, 58],
  qimen: [5, 7, 15, 16, 40, 46, 51, 57],
  liuren: [5, 8, 20, 29, 40, 48, 59, 63],
  xiaoliuren: [11, 14, 15, 17, 24, 42, 58, 61],
  jinkoujue: [10, 21, 25, 34, 43, 49, 51, 63],
  taiyi: [1, 11, 14, 20, 24, 49, 50, 55],
  huangji: [1, 2, 11, 24, 32, 49, 63, 64],
  tarot: [4, 20, 22, 30, 49, 56, 59, 61],
  lenormand: [8, 13, 20, 22, 37, 53, 58, 61],
  almanac: [11, 14, 15, 16, 17, 19, 24, 34, 42, 46, 55],
  // 其他功能页
  profile: [1, 2, 11, 14, 15, 20, 24, 32, 42, 46, 48, 50, 53, 61, 63],
  account: [15, 26, 32, 37, 48, 52, 60, 61],
  'account-login': [4, 5, 15, 20, 24, 48, 53, 61],
  'culture-tools': [14, 22, 30, 42, 50, 53, 55, 57],
  'culture-naming': [1, 11, 14, 22, 42, 50, 53, 61],
  'culture-name': [14, 20, 22, 30, 35, 50, 55, 61],
  'culture-hanzi': [4, 20, 22, 26, 30, 48, 50, 57],
  'culture-number': [11, 15, 24, 32, 42, 51, 58, 63],
  cases: [2, 8, 13, 20, 37, 45, 48, 61],
  tutorial: [4, 15, 20, 26, 48, 53, 57, 61],
};

/** 结合页面语义与当前时辰/日期取卦，支持 salt 手动轮转 */
export function getContextHexagramLot(
  contextKey: string,
  options?: { date?: Date; salt?: number },
): HexagramLot {
  const date = options?.date ?? new Date();
  const salt = options?.salt ?? 0;
  const pool = CONTEXT_HEXAGRAM_POOLS[contextKey];
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  const shichen = Math.floor(((date.getHours() + 1) % 24) / 2);

  if (pool && pool.length > 0) {
    const idx = (hash32(daySeed * 17 + shichen + hashString(contextKey), 0x517cc1b7) + salt) % pool.length;
    return getHexagramByNo(pool[idx]);
  }
  const idx = (hash32(daySeed * 13 + shichen + hashString(contextKey), 0x85ebca6b) + salt) % HEXAGRAM_LOTS.length;
  return HEXAGRAM_LOTS[idx];
}

/** 随缘换卦：从六十四卦中随机取一卦，默认避开当前卦 */
export function getRandomHexagramLot(excludeNo?: number): HexagramLot {
  const candidates = excludeNo ? HEXAGRAM_LOTS.filter((item) => item.no !== excludeNo) : HEXAGRAM_LOTS;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] ?? HEXAGRAM_LOTS[0];
}

const FORTUNE_PROFILES = [
  {
    verdict: '大吉' as const,
    detail: '气机通畅，利有攸往。宜顺势推进积压之事，先谋后动则事半功倍。',
    suitable: ['定计启程', '会友晤谈', '签约立约'],
    avoid: ['犹豫观望', '半途而废'],
  },
  {
    verdict: '中吉' as const,
    detail: '循序渐进，水到渠成。凡事以稳为先，得贵人相助而渐见成效。',
    suitable: ['读书修业', '整理旧案', '洽谈协作'],
    avoid: ['急于求成', '言语过激'],
  },
  {
    verdict: '小吉' as const,
    detail: '微明初生，宜办小事。细致筹谋，积跬步以致千里，不必贪大求全。',
    suitable: ['理清账目', '拜访师长', '调养身心'],
    avoid: ['大额投机', '轻信传言'],
  },
  {
    verdict: '平' as const,
    detail: '守常持中，无咎无誉。宜安步当车，把分内之事做深做实，静候转机。',
    suitable: ['复盘总结', '日常功课', '居家静修'],
    avoid: ['仓促变更', '意气争执'],
  },
  {
    verdict: '小凶' as const,
    detail: '时势略滞，宜守静而忌妄动。退一步海阔天空，留有余地反成保护。',
    suitable: ['内省校准', '暂缓决策', '清简作息'],
    avoid: ['强行推进', '远行舟车'],
  },
  {
    verdict: '中凶' as const,
    detail: '风波未定，宜敛锋蓄势。大事暂搁，多听旁观者言，守正不移则险自化。',
    suitable: ['请教长者', '查漏补缺', '早歇养神'],
    avoid: ['独断专行', '锋芒毕露'],
  },
] as const;

export type DailyFortune = {
  verdict: (typeof FORTUNE_PROFILES)[number]['verdict'];
  detail: string;
  suitable: readonly string[];
  avoid: readonly string[];
  shichenLabel: string;
  dateLabel: string;
};

/** 今日吉凶：按日期 + 卦象定签，附宜忌与时辰 */
export function getDailyFortune(lot: HexagramLot, date = new Date()): DailyFortune {
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  const h = hash32(daySeed + lot.no * 97, 0x27d4eb2f);
  const profile = FORTUNE_PROFILES[h % FORTUNE_PROFILES.length];
  return {
    verdict: profile.verdict,
    detail: profile.detail,
    suitable: profile.suitable,
    avoid: profile.avoid,
    shichenLabel: getShichenLabel(date),
    dateLabel: formatSolarDateLabel(date),
  };
}
