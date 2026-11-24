/**
 * 岁庚页右侧「今日之卦」：六十四卦卦名 + 卦辞（《周易》原文）。
 * 按本地时钟定卦：当日卦重日更换，时辰卦时辰更换。
 */

export type HexagramLot = {
  /** 序号 1-64 */
  no: number;
  /** 卦画 unicode（䷀-䷿） */
  glyph: string;
  /** 卦名（不带「卦」字） */
  name: string;
  /** 上下卦，如「乾下乾上」 */
  trigrams: string;
  /** 卦辞 */
  text: string;
};

export const HEXAGRAM_LOTS: HexagramLot[] = [
  { no: 1,  glyph: '䷀', name: '乾',     trigrams: '乾下乾上', text: '元亨利贞。' },
  { no: 2,  glyph: '䷁', name: '坤',     trigrams: '坤下坤上', text: '元亨，利牝马之贞。君子有攸往，先迷后得主，利。西南得朋，东北丧朋。安贞吉。' },
  { no: 3,  glyph: '䷂', name: '屯',     trigrams: '震下坎上', text: '元亨，利贞。勿用有攸往，利建侯。' },
  { no: 4,  glyph: '䷃', name: '蒙',     trigrams: '坎下艮上', text: '亨。匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。利贞。' },
  { no: 5,  glyph: '䷄', name: '需',     trigrams: '乾下坎上', text: '有孚，光亨，贞吉。利涉大川。' },
  { no: 6,  glyph: '䷅', name: '讼',     trigrams: '坎下乾上', text: '有孚窒惕，中吉，终凶。利见大人，不利涉大川。' },
  { no: 7,  glyph: '䷆', name: '师',     trigrams: '坎下坤上', text: '贞，丈人吉，无咎。' },
  { no: 8,  glyph: '䷇', name: '比',     trigrams: '坤下坎上', text: '吉。原筮元永贞，无咎。不宁方来，后夫凶。' },
  { no: 9,  glyph: '䷈', name: '小畜',   trigrams: '乾下巽上', text: '亨。密云不雨，自我西郊。' },
  { no: 10, glyph: '䷉', name: '履',     trigrams: '兑下乾上', text: '履虎尾，不咥人，亨。' },
  { no: 11, glyph: '䷊', name: '泰',     trigrams: '乾下坤上', text: '小往大来，吉，亨。' },
  { no: 12, glyph: '䷋', name: '否',     trigrams: '坤下乾上', text: '否之匪人，不利君子贞，大往小来。' },
  { no: 13, glyph: '䷌', name: '同人',   trigrams: '离下乾上', text: '同人于野，亨。利涉大川，利君子贞。' },
  { no: 14, glyph: '䷍', name: '大有',   trigrams: '乾下离上', text: '元亨。' },
  { no: 15, glyph: '䷎', name: '谦',     trigrams: '艮下坤上', text: '亨，君子有终。' },
  { no: 16, glyph: '䷏', name: '豫',     trigrams: '坤下震上', text: '利建侯行师。' },
  { no: 17, glyph: '䷐', name: '随',     trigrams: '震下兑上', text: '元亨利贞，无咎。' },
  { no: 18, glyph: '䷑', name: '蛊',     trigrams: '巽下艮上', text: '元亨，利涉大川。先甲三日，后甲三日。' },
  { no: 19, glyph: '䷒', name: '临',     trigrams: '兑下坤上', text: '元亨利贞。至于八月有凶。' },
  { no: 20, glyph: '䷓', name: '观',     trigrams: '坤下巽上', text: '盥而不荐，有孚颙若。' },
  { no: 21, glyph: '䷔', name: '噬嗑',   trigrams: '震下离上', text: '亨。利用狱。' },
  { no: 22, glyph: '䷕', name: '贲',     trigrams: '离下艮上', text: '亨。小利有攸往。' },
  { no: 23, glyph: '䷖', name: '剥',     trigrams: '坤下艮上', text: '不利有攸往。' },
  { no: 24, glyph: '䷗', name: '复',     trigrams: '震下坤上', text: '亨。出入无疾，朋来无咎。反复其道，七日来复。利有攸往。' },
  { no: 25, glyph: '䷘', name: '无妄',   trigrams: '震下乾上', text: '元亨利贞。其匪正有眚，不利有攸往。' },
  { no: 26, glyph: '䷙', name: '大畜',   trigrams: '乾下艮上', text: '利贞。不家食吉，利涉大川。' },
  { no: 27, glyph: '䷚', name: '颐',     trigrams: '震下艮上', text: '贞吉。观颐，自求口实。' },
  { no: 28, glyph: '䷛', name: '大过',   trigrams: '巽下兑上', text: '栋桡，利有攸往，亨。' },
  { no: 29, glyph: '䷜', name: '坎',     trigrams: '坎下坎上', text: '有孚，维心亨，行有尚。' },
  { no: 30, glyph: '䷝', name: '离',     trigrams: '离下离上', text: '利贞，亨。畜牝牛，吉。' },
  { no: 31, glyph: '䷞', name: '咸',     trigrams: '艮下兑上', text: '亨，利贞。取女吉。' },
  { no: 32, glyph: '䷟', name: '恒',     trigrams: '巽下震上', text: '亨，无咎，利贞，利有攸往。' },
  { no: 33, glyph: '䷠', name: '遁',     trigrams: '艮下乾上', text: '亨，小利贞。' },
  { no: 34, glyph: '䷡', name: '大壮',   trigrams: '乾下震上', text: '利贞。' },
  { no: 35, glyph: '䷢', name: '晋',     trigrams: '坤下离上', text: '康侯用锡马蕃庶，昼日三接。' },
  { no: 36, glyph: '䷣', name: '明夷',   trigrams: '离下坤上', text: '利艰贞。' },
  { no: 37, glyph: '䷤', name: '家人',   trigrams: '离下巽上', text: '利女贞。' },
  { no: 38, glyph: '䷥', name: '睽',     trigrams: '兑下离上', text: '小事吉。' },
  { no: 39, glyph: '䷦', name: '蹇',     trigrams: '艮下坎上', text: '利西南，不利东北。利见大人，贞吉。' },
  { no: 40, glyph: '䷧', name: '解',     trigrams: '坎下震上', text: '利西南。无所往，其来复吉。有攸往，夙吉。' },
  { no: 41, glyph: '䷨', name: '损',     trigrams: '兑下艮上', text: '有孚，元吉，无咎，可贞，利有攸往。曷之用？二簋可用享。' },
  { no: 42, glyph: '䷩', name: '益',     trigrams: '震下巽上', text: '利有攸往，利涉大川。' },
  { no: 43, glyph: '䷪', name: '夬',     trigrams: '乾下兑上', text: '扬于王庭，孚号有厉。告自邑，不利即戎，利有攸往。' },
  { no: 44, glyph: '䷫', name: '姤',     trigrams: '巽下乾上', text: '女壮，勿用取女。' },
  { no: 45, glyph: '䷬', name: '萃',     trigrams: '坤下兑上', text: '亨。王假有庙。利见大人，亨，利贞。用大牲吉。利有攸往。' },
  { no: 46, glyph: '䷭', name: '升',     trigrams: '巽下坤上', text: '元亨，用见大人，勿恤，南征吉。' },
  { no: 47, glyph: '䷮', name: '困',     trigrams: '坎下兑上', text: '亨，贞，大人吉，无咎。有言不信。' },
  { no: 48, glyph: '䷯', name: '井',     trigrams: '巽下坎上', text: '改邑不改井，无丧无得，往来井井。汔至亦未繘井，羸其瓶，凶。' },
  { no: 49, glyph: '䷰', name: '革',     trigrams: '离下兑上', text: '巳日乃孚。元亨利贞，悔亡。' },
  { no: 50, glyph: '䷱', name: '鼎',     trigrams: '巽下离上', text: '元吉，亨。' },
  { no: 51, glyph: '䷲', name: '震',     trigrams: '震下震上', text: '亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。' },
  { no: 52, glyph: '䷳', name: '艮',     trigrams: '艮下艮上', text: '艮其背，不获其身；行其庭，不见其人。无咎。' },
  { no: 53, glyph: '䷴', name: '渐',     trigrams: '艮下巽上', text: '女归吉，利贞。' },
  { no: 54, glyph: '䷵', name: '归妹',   trigrams: '兑下震上', text: '征凶，无攸利。' },
  { no: 55, glyph: '䷶', name: '丰',     trigrams: '离下震上', text: '亨，王假之，勿忧，宜日中。' },
  { no: 56, glyph: '䷷', name: '旅',     trigrams: '艮下离上', text: '小亨，旅贞吉。' },
  { no: 57, glyph: '䷸', name: '巽',     trigrams: '巽下巽上', text: '小亨，利有攸往，利见大人。' },
  { no: 58, glyph: '䷹', name: '兑',     trigrams: '兑下兑上', text: '亨，利贞。' },
  { no: 59, glyph: '䷺', name: '涣',     trigrams: '坎下巽上', text: '亨。王假有庙，利涉大川，利贞。' },
  { no: 60, glyph: '䷻', name: '节',     trigrams: '兑下坎上', text: '亨。苦节不可贞。' },
  { no: 61, glyph: '䷼', name: '中孚',   trigrams: '兑下巽上', text: '豚鱼吉。利涉大川，利贞。' },
  { no: 62, glyph: '䷽', name: '小过',   trigrams: '艮下震上', text: '亨，利贞。可小事，不可大事。飞鸟遗之音，不宜上，宜下，大吉。' },
  { no: 63, glyph: '䷾', name: '既济',   trigrams: '离下坎上', text: '亨小，利贞。初吉终乱。' },
  { no: 64, glyph: '䷿', name: '未济',   trigrams: '坎下离上', text: '亨。小狐汔济，濡其尾，无攸利。' },
];

function hash32(seed: number, salt: number) {
  let h = seed ^ salt;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 当日卦：按本地日期定，换日换卦 */
export function getDailyHexagramLot(date = new Date()): HexagramLot {
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  return HEXAGRAM_LOTS[hash32(daySeed, 0x9e3779b9) % HEXAGRAM_LOTS.length];
}

/** 时辰卦：按时辰（12 时制）定，换时辰换卦 */
export function getHourlyHexagramLot(date = new Date()): HexagramLot {
  const hourIndex = Math.floor(date.getHours() / 2); // 0-11，对应子丑寅卯…
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  return HEXAGRAM_LOTS[hash32(daySeed * 13 + hourIndex, 0x85ebca6b) % HEXAGRAM_LOTS.length];
}

const FORTUNE_VERDICTS = ['大吉', '中吉', '小吉', '平', '小凶', '中凶'] as const;

const FORTUNE_DETAILS = [
  '宜守静，忌妄动。事缓则圆，水到渠成。',
  '利有攸往，宜早不宜迟。',
  '宜修心，忌争执。退一步，海阔天空。',
  '有所往则吉，守旧则滞。',
  '宜请教长者，忌独断专行。',
  '小利可图，大事勿决。',
  '宜修文墨，忌远行舟车。',
  '守正则吉，邪念则凶。',
] as const;

export type DailyFortune = {
  verdict: (typeof FORTUNE_VERDICTS)[number];
  detail: string;
};

/** 今日吉凶：按日期 + 当日卦定，换日换签 */
export function getDailyFortune(lot: HexagramLot, date = new Date()): DailyFortune {
  const daySeed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  const h = hash32(daySeed + lot.no * 97, 0x27d4eb2f);
  return {
    verdict: FORTUNE_VERDICTS[h % FORTUNE_VERDICTS.length],
    detail: FORTUNE_DETAILS[(h >>> 3) % FORTUNE_DETAILS.length],
  };
}
