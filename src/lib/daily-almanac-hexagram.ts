/**
 * 真实「今日之卦」与「今日吉凶」推算引擎（非随机，严格依据传统算法）：
 * 1. 今日之卦：调用 mingyu-core/divination/meihua 的《梅花易数》时间起卦（按真实农历年月日时）
 *    起出本卦、互卦、变卦、动爻与体用生克，并附六十四卦白话卦义与行事宜忌。
 * 2. 今日吉凶：调用 mingyu-core/divination/almanac 的《协纪辨方书》黄历择日算法，
 *    给出真实干支、农历、建除十二神、黄道黑道值神、二十八宿、冲煞、彭祖百忌与黄历宜忌。
 */

import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import {
  HEXAGRAM_LOTS,
  getHexagramByNo,
  getHexagramFullName,
  getShichenLabel,
  formatSolarDateLabel,
  type HexagramLot,
} from '@/lib/hexagram-lot';

export type HexagramGuidance = {
  /** 白话卦义解读 */
  plainMeaning: string;
  /** 本卦今日可做 */
  suitable: readonly string[];
  /** 本卦今日不宜 */
  avoid: readonly string[];
};

/** 六十四卦白话卦义与行事宜忌（按周易 1-64 卦序） */
const HEXAGRAM_GUIDANCE_BY_NO: Record<number, HexagramGuidance> = {
  1: {
    plainMeaning: '刚健中正、自强不息。阳气充沛，利主动谋划与担当主责，但忌骄盈过刚。',
    suitable: ['制定长期规划', '主动推进核心事务', '拜会贵人或长辈'],
    avoid: ['骄傲自满', '不顾现实盲目冒进'],
  },
  2: {
    plainMeaning: '厚德载物、顺势承接。宜柔顺配合、踏实蓄力，先跟进落实而非急于抢先出头。',
    suitable: ['配合团队落地', '整理资料与内务', '守成蓄力'],
    avoid: ['强出风头', '贸然开启全新冒险'],
  },
  3: {
    plainMeaning: '万物始生、初建维艰。起步阶段难免多阻，宜先打基础、寻助手，切忌急躁求成。',
    suitable: ['搭建框架与筹备', '寻求同道协助', '小步试探'],
    avoid: ['急于求大成', '孤军奋战'],
  },
  4: {
    plainMeaning: '启蒙求知、循序渐进。遇事不明当虚心请教，一次问清、反复核验，忌敷衍轻信。',
    suitable: ['学习进修', '请教专业人士', '查漏补缺'],
    avoid: ['不懂装懂', '三心二意反复折腾'],
  },
  5: {
    plainMeaning: '云上于天、待时而动。条件尚在酝酿，宜保持定力与诚信，养精蓄锐静候良机。',
    suitable: ['饮食调养', '耐心筹备方案', '维系既有信任'],
    avoid: ['焦虑催促', '时机未熟强行拍板'],
  },
  6: {
    plainMeaning: '天水违行、易生分歧。凡事以和为贵，见好就收，能协商化解则勿升级对抗。',
    suitable: ['复盘条款细节', '寻求公正调解', '退一步留余地'],
    avoid: ['意气争执', '纠缠到底两败俱伤'],
  },
  7: {
    plainMeaning: '地中有水、统御有章。行事须有明确纪律与领头人，以正道聚人心则可成事。',
    suitable: ['统筹分工', '整顿秩序与流程', '按计划执行'],
    avoid: ['政出多门', '无章法蛮干'],
  },
  8: {
    plainMeaning: '水地相亲、亲比互助。利结盟合作与人际往来，诚意为先，宜早响应勿迟疑。',
    suitable: ['团队协作', '拜访亲友客户', '确立合作意向'],
    avoid: ['拖延失约', '冷漠疏离'],
  },
  9: {
    plainMeaning: '密云不雨、小有积蓄。力量尚在累积阶段，宜精耕细作、修文润色，不宜大举扩张。',
    suitable: ['打磨细节', '小额储蓄与积累', '文书整理'],
    avoid: ['急于收割大果', '过度消耗资源'],
  },
  10: {
    plainMeaning: '履虎尾而不咥、如履薄冰。周遭或有敏感局势，谨言慎行、守礼循矩便能化险为夷。',
    suitable: ['按规章办事', '谨慎沟通', '稳妥应对难题'],
    avoid: ['轻率越界', '口无遮拦'],
  },
  11: {
    plainMeaning: '天地交泰、气机通畅。上下沟通顺遂，小往大来，是推进重要计划与合作的好气象。',
    suitable: ['签约洽谈', '推进重点项目', '跨部门沟通'],
    avoid: ['安逸懈怠', '错失良机'],
  },
  12: {
    plainMeaning: '天地不交、闭塞暂滞。外在阻力较大，宜收敛锋芒、潜心内修，静待格局松动。',
    suitable: ['独处反思', '收缩战线保稳', '精简开支'],
    avoid: ['强行说服他人', '大额投入冒险'],
  },
  13: {
    plainMeaning: '天火同人、志同道合。以公心待人、敞开协作，跨越圈层交流最易得助力。',
    suitable: ['公开交流合作', '结识新伙伴', '集体讨论决策'],
    avoid: ['拉帮结派', '心胸狭隘'],
  },
  14: {
    plainMeaning: '火在天上、光明丰盛。资源与声望俱佳，宜慷慨分享、遏恶扬善，以德配位。',
    suitable: ['成果展示与发布', '资源整合', '回馈协作伙伴'],
    avoid: ['居功自傲', '铺张浪费'],
  },
  15: {
    plainMeaning: '地中有山、高而能下。谦和守中是最强护身符，不争锋芒反能长久顺遂收成。',
    suitable: ['虚心听取意见', '低调务实办事', '平衡各方利益'],
    avoid: ['张扬炫耀', '争强好胜'],
  },
  16: {
    plainMeaning: '雷出地奋、顺势欢愉。顺应人心与趋势则易得支持，宜提前预备，乐而有节。',
    suitable: ['动员启程', '策划活动与聚会', '未雨绸缪'],
    avoid: ['沉溺享乐', '乐极忘备'],
  },
  17: {
    plainMeaning: '泽中有雷、随机应变。懂得顺应时势与他方合理建议，灵活调整步调则无往不利。',
    suitable: ['顺势调整方案', '听从专业建议', '劳逸结合'],
    avoid: ['固执己见', '盲从失去原则'],
  },
  18: {
    plainMeaning: '山下有风、整饬革弊。正是清理陈年积弊、修复漏洞的时机，需前后三思、标本兼治。',
    suitable: ['清理旧账与遗留问题', '修复流程漏洞', '复盘整改'],
    avoid: ['掩盖问题', '敷衍拖延'],
  },
  19: {
    plainMeaning: '泽上有地、居高临下。势头渐旺、亲临督导可得佳绩，但须防盛极转衰、早作预案。',
    suitable: ['亲自督办要事', '拓展业务与指导', '关怀下属'],
    avoid: ['高高在上脱离实际', '只看眼前忘却远忧'],
  },
  20: {
    plainMeaning: '风行地上、静观省察。宜先观察大局、看清本质，再决定行动，勿仓促表态。',
    suitable: ['调研观察', '审视自身得失', '读书沉淀'],
    avoid: ['草率下结论', '人云亦云'],
  },
  21: {
    plainMeaning: '雷电并至、明断去梗。面对卡点与是非，宜果断厘清规则、消除障碍，不可姑息。',
    suitable: ['解决卡点纠纷', '明确奖惩边界', '果断拍板'],
    avoid: ['优柔寡断', '偏听偏信'],
  },
  22: {
    plainMeaning: '山下有火、文饰增辉。宜修饰仪容、打磨呈现与文案，但须重实质、勿流于浮华。',
    suitable: ['美化方案与设计', '文艺创作', '社交礼仪往来'],
    avoid: ['华而不实', '仅凭外表做大决定'],
  },
  23: {
    plainMeaning: '山附于地、势在消减。外势趋弱时宜顺势止损、保全根本，切忌逆势硬拼。',
    suitable: ['休养生息', '精简减负', '守住核心资产'],
    avoid: ['逆势加仓', '强行折腾大事'],
  },
  24: {
    plainMeaning: '雷在地中、一阳来复。低谷渐过、生机回暖，宜循序恢复节奏、广结善缘。',
    suitable: ['重启搁置计划', '修复人际关系', '调理作息'],
    avoid: ['操之过急', '重蹈旧辙'],
  },
  25: {
    plainMeaning: '天下雷行、守正无妄。本心端正、顺理而行则吉，切忌投机取巧或存侥幸心理。',
    suitable: ['依本分踏实做事', '真诚沟通', '顺其自然'],
    avoid: ['投机冒险', '妄动生非'],
  },
  26: {
    plainMeaning: '天在山中、厚积薄发。既有积累已见规模，宜继续蓄养实力、广学前人经验，利外出施展。',
    suitable: ['外出拓展或出差', '深化专业积累', '统筹大项准备'],
    avoid: ['小富即安', '挥霍积蓄'],
  },
  27: {
    plainMeaning: '山下有雷、慎言节食。留意饮食起居与出口之言，滋养身心、自求务实之道。',
    suitable: ['规律饮食养生', '谨言慎行', '独立自持'],
    avoid: ['暴饮暴食', '口舌是非'],
  },
  28: {
    plainMeaning: '泽灭木、负荷过重。当前压力偏大，宜果断减轻负担或调整支撑点，勿硬扛到底。',
    suitable: ['主动减压分流', '寻找破局支点', '果断取舍'],
    avoid: ['死撑硬扛', '忽略风险信号'],
  },
  29: {
    plainMeaning: '重险在前、习坎行险。面对连续考验，唯凭真诚定力与扎实基本功方能稳步渡过。',
    suitable: ['保持冷静专注', '逐项排查风险', '坚守底线'],
    avoid: ['惊慌失措', '心存侥幸'],
  },
  30: {
    plainMeaning: '明两作离、光明附丽。思路清明、洞察力佳，宜依托正道与可靠平台发光发热。',
    suitable: ['汇报展示', '创意策划', '明辨是非'],
    avoid: ['急躁冒火', '孤立无援硬撑'],
  },
  31: {
    plainMeaning: '山上有泽、虚怀相感。以真诚之心换取共鸣，极利情感沟通、合作撮合与人际破冰。',
    suitable: ['感情升温与约会', '真诚谈合作', '倾听对方需求'],
    avoid: ['虚情假意', '心思摇摆不定'],
  },
  32: {
    plainMeaning: '雷风相与、持之以恒。贵在守常久行，把已经看准的方向坚持做深，切忌朝令夕改。',
    suitable: ['坚持日常习惯', '推进长期项目', '维护稳定关系'],
    avoid: ['频繁换赛道', '半途而废'],
  },
  33: {
    plainMeaning: '天下有山、知机退避。势头不利时主动退守是智慧而非懦弱，留得青山在。',
    suitable: ['适时抽身休息', '避开无谓消耗', '暗中蓄力'],
    avoid: ['恋战纠缠', '意气用事'],
  },
  34: {
    plainMeaning: '雷在天上、气势正盛。能量强旺但易冲动，须以理制力、守正不逾矩方能大成。',
    suitable: ['攻坚克难', '果断推进', '适度运动释放精力'],
    avoid: ['蛮干冲撞', '恃强凌弱'],
  },
  35: {
    plainMeaning: '明出地上、旭日晋升。顺风顺水、易获赏识，宜积极展示成果、把握晋升与合作机会。',
    suitable: ['汇报进展', '争取机会与资源', '公开表达'],
    avoid: ['贪得无厌', '忽视细节'],
  },
  36: {
    plainMeaning: '明入地中、韬光养晦。外境暂暗，宜收敛才华、外柔内刚，在艰难中守住本心。',
    suitable: ['低调做事', '保护核心成果', '静待天明'],
    avoid: ['锋芒毕露', '正面硬碰硬'],
  },
  37: {
    plainMeaning: '风自火出、齐家有序。重心宜回归家庭与内部团队，言行有度、各司其职则万事兴。',
    suitable: ['陪伴家人', '整理居家与内部秩序', '明确职责'],
    avoid: ['忽视亲近之人', '内部猜忌'],
  },
  38: {
    plainMeaning: '火泽相睽、求同存异。意见易有分歧，宜处理小事、尊重差异，不宜强求一致办大事。',
    suitable: ['处理日常小事', '独立完成工作', '求同存异'],
    avoid: ['强行统一意见', '因误会扩大矛盾'],
  },
  39: {
    plainMeaning: '山上有水、行路遇阻。前方有坎，宜停步自省、请教高明，绕道缓行胜过硬闯。',
    suitable: ['向长辈专家求助', '反躬自省', '暂缓远行'],
    avoid: ['冒进涉险', '埋怨外部'],
  },
  40: {
    plainMeaning: '雷雨作解、困顿舒缓。僵局迎来松动，宜抓紧解决核心问题，事成后归于平静休养。',
    suitable: ['化解误会与旧结', '尽快收尾待办', '放松减压'],
    avoid: ['旧事重提', '拖延不决'],
  },
  41: {
    plainMeaning: '山下有泽、损己益本。适度做减法、克制多余欲望，真诚简朴反而能换来长远收获。',
    suitable: ['断舍离与精简', '控制冲动消费', '诚意待人'],
    avoid: ['贪多嚼不烂', '铺张攀比'],
  },
  42: {
    plainMeaning: '风雷相益、见善则迁。顺风增益之象，利积极行动、学习长处、改过迁善。',
    suitable: ['开启有益新事', '学习新技能', '大方助人'],
    avoid: ['吝啬保守', '明知有过不改'],
  },
  43: {
    plainMeaning: '泽上于天、决断除弊。事情已到明朗决断关口，宜公开坦诚处理，但忌用蛮力。',
    suitable: ['坦诚沟通表态', '果断清理障碍', '防微杜渐'],
    avoid: ['暗箱操作', '情绪化对抗'],
  },
  44: {
    plainMeaning: '天下有风、不期而遇。易有突发邀约或意外变化，宜冷静甄别，防微杜渐勿轻率绑定。',
    suitable: ['谨慎观察新机会', '保持边界感', '灵活应对插曲'],
    avoid: ['轻信陌生承诺', '仓促确立长期绑定'],
  },
  45: {
    plainMeaning: '泽上于地、精英荟萃。利聚会、协作与资源汇聚，但人多事杂须提前防范意外。',
    suitable: ['团队聚会与交流', '拜访重要人物', '整合人脉'],
    avoid: ['毫无防备', '随波逐流'],
  },
  46: {
    plainMeaning: '地中生木、积小成高。势头稳步上升，宜脚踏实地、顺势向上推进，利拜见贵人。',
    suitable: ['稳步推进目标', '向上汇报或求教', '持续精进'],
    avoid: ['好高骛远', '半途松懈'],
  },
  47: {
    plainMeaning: '泽无水、身处困顿。言语易不被理解，少说多做、守住正念与韧性，静待时来运转。',
    suitable: ['沉默务实', '守正抗压', '向内沉淀'],
    avoid: ['多言辩解', '自暴自弃'],
  },
  48: {
    plainMeaning: '木上有水、井养不穷。根基稳固、靠真本事持续输出，注意把事情做到最后一公里。',
    suitable: ['深耕本职技能', '服务他人与团队', '善始善终'],
    avoid: ['功亏一篑', '忽视维护根基'],
  },
  49: {
    plainMeaning: '泽中有火、去旧布新。时机成熟时宜果断变革优化，先取得共识再落地则无悔。',
    suitable: ['升级旧方案', '改掉旧习惯', '坦诚推动变化'],
    avoid: ['未得共识强改', '墨守成规'],
  },
  50: {
    plainMeaning: '木上有火、革故鼎新。气象端正稳重，利确立新秩序、整合资源与共烹佳绩。',
    suitable: ['启动重要新项目', '汇聚贤能协作', '树立规范'],
    avoid: ['轻慢失礼', '破坏既定默契'],
  },
  51: {
    plainMeaning: '洊雷震惊、临变不乱。偶有突发消息或波澜，保持镇定自省，稳住手头核心事务即安。',
    suitable: ['冷静应对突发', '自省修整', '稳守本职'],
    avoid: ['惊慌失措', '仓促反击'],
  },
  52: {
    plainMeaning: '兼山艮、当止则止。动静有时，今日宜收心定神、专注当下，不越界、不胡思乱想。',
    suitable: ['静思冥想', '专注单一任务', '按时休整'],
    avoid: ['强行折腾', '分心多虑'],
  },
  53: {
    plainMeaning: '山上有木、循序渐进。如鸿雁南飞有序，一步一个脚印最稳妥，利长期关系与计划。',
    suitable: ['按步骤稳步推进', '情感与合作长线经营', '耐心积累'],
    avoid: ['拔苗助长', '急功近利'],
  },
  54: {
    plainMeaning: '泽上有雷、名位未正。凡事须看清立场与长远后果，切忌凭一时冲动做出不妥妥协。',
    suitable: ['厘清权责边界', '慎始敬终', '保持独立判断'],
    avoid: ['冲动承诺', '本末倒置'],
  },
  55: {
    plainMeaning: '雷电皆至、盛大丰明。状态饱满、视野开阔，宜把握高光时刻果断推进，莫忧莫疑。',
    suitable: ['高效处理要务', '公开展示成果', '果断执行'],
    avoid: ['杞人忧天', '错失黄金时段'],
  },
  56: {
    plainMeaning: '山上有火、行旅在外。处境多流动变化，宜谦逊守礼、轻装简行，办小事则吉。',
    suitable: ['短期出行或办事', '灵活适应新环境', '谨守礼节'],
    avoid: ['傲慢生事', '在变动中豪赌大事'],
  },
  57: {
    plainMeaning: '随风巽、柔顺深入。以温和细致的沟通反复渗透，比强硬施压更易成事，利请教贵人。',
    suitable: ['温和协商说服', '细致打磨细节', '请教有经验者'],
    avoid: ['优柔寡断', '硬碰硬'],
  },
  58: {
    plainMeaning: '丽泽兑、和悦交流。氛围轻松融洽，极利谈心、分享、教学相长与团队团建。',
    suitable: ['朋友交流切磋', '商务洽谈破冰', '分享喜悦'],
    avoid: ['言辞轻浮', '曲意逢迎'],
  },
  59: {
    plainMeaning: '风行水上、涣散冰释。积压的隔阂与僵局正在散开，宜用共同愿景凝聚人心、利远行。',
    suitable: ['化解隔阂', '跨区域联络或出行', '凝聚团队共识'],
    avoid: ['放任涣散', '各自为政'],
  },
  60: {
    plainMeaning: '泽上有水、节制有度。立好规矩、把握分寸，适度克制带来顺畅，但不可苛刻过度。',
    suitable: ['制定预算与作息', '有度自律', '清晰约定边界'],
    avoid: ['过度放纵', '苛求自己或他人'],
  },
  61: {
    plainMeaning: '泽上有风、诚信感通。以赤诚之心待人处事，无须机巧便能赢得深度信任，利远行大事。',
    suitable: ['真诚坦白沟通', '建立长期信任', '推进重要承诺'],
    avoid: ['口是心非', '猜疑算计'],
  },
  62: {
    plainMeaning: '山上有雷、小有过越。宜办细微务实之事，姿态放低、行动节俭保守则大吉，忌贪大。',
    suitable: ['处理琐碎细节', '低调务实节俭', '微调优化'],
    avoid: ['好大喜功', '贸然做大决策'],
  },
  63: {
    plainMeaning: '水在火上、事已初成。当前事务趋于圆满，正所谓「初吉终乱」，更需居安思危、做好收尾。',
    suitable: ['验收复盘与收尾', '巩固已有成果', '提前防范隐患'],
    avoid: ['功成懈怠', '疏忽后续维护'],
  },
  64: {
    plainMeaning: '火在水上、尚在渡河。距目标仅一步之遥，切忌临门松懈，仔细辨别位置与节奏方能成功。',
    suitable: ['审慎把控细节', '分阶段稳步收口', '辨明主次'],
    avoid: ['临尾草率', '盲目急行'],
  },
};

const YELLOW_ROAD_STARS = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
const GOOD_OFFICERS = new Set(['除', '危', '定', '执', '成', '开']);
const CAUTION_OFFICERS = new Set(['破', '闭', '建']);

export type RealDailyHexagram = {
  lot: HexagramLot;
  fullName: string;
  guidance: HexagramGuidance;
  /** 梅花易数动爻名称，如「九三」 */
  movingYaoName: string;
  /** 互卦名 */
  interName: string | null;
  /** 变卦名 */
  changedName: string | null;
  /** 体用关系，如「用生体」「体克用」 */
  tiYongRelation: string;
  /** 走势总结（梅花三阶段/体用断诀） */
  trendSummary: string;
  /** 农历与时辰 */
  dateLabel: string;
  shichenLabel: string;
};

export type RealDailyAlmanac = {
  date: string;
  dateLabel: string;
  lunarDate: string;
  ganzhiLabel: string;
  shichenLabel: string;
  /** 建除十二神 */
  dayOfficer: string;
  /** 十二值神（青龙/明堂/白虎等） */
  twelveStar: string;
  /** 是否黄道日 */
  isYellowRoad: boolean;
  /** 二十八宿 */
  twentyEightStar: string;
  /** 冲煞 */
  clash: string;
  /** 彭祖百忌 */
  pengZu: string;
  /** 综合吉凶等级（由真实黄历规则推导，非随机） */
  verdict: '黄道大吉' | '黄道吉日' | '平' | '宜慎' | '黑道慎行';
  isAuspicious: boolean;
  /** 吉凶依据简述 */
  basisSummary: string;
  /** 综合建议说明 */
  detail: string;
  /** 真实黄历宜 */
  recommends: readonly string[];
  /** 真实黄历忌 */
  avoids: readonly string[];
  /** 当前时辰黄历信息 */
  currentHour: {
    name: string;
    range: string;
    ganzhi: string;
    twelveStar: string;
    isYellowRoad: boolean;
  } | null;
};

function formatLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function findHexagramLotByTrigrams(lower: string, upper: string): HexagramLot {
  const target = `${lower}下${upper}上`;
  return HEXAGRAM_LOTS.find((item) => item.trigrams === target) ?? getHexagramByNo(1);
}

export function getHexagramGuidance(lot: HexagramLot): HexagramGuidance {
  return (
    HEXAGRAM_GUIDANCE_BY_NO[lot.no] ?? {
      plainMeaning: '顺时守正，察微知著，量力而行则无咎。',
      suitable: ['稳步推进日常事务', '静心复盘'],
      avoid: ['仓促冒进', '意气争执'],
    }
  );
}

/**
 * 按当前真实时间（梅花易数年月日时起卦）推算「今日之卦」。
 * 确定性结果：同一天同一时辰恒定不变，绝不随机。
 */
export function computeRealDailyHexagram(date = new Date()): RealDailyHexagram {
  const meihua = generateMeihua(date, { method: 'time' });
  const lot = findHexagramLotByTrigrams(meihua.mainHexagram.lower, meihua.mainHexagram.upper);
  const fullName = getHexagramFullName(lot);
  const guidance = getHexagramGuidance(lot);
  const trendSummary =
    meihua.analysis.timelineTrend?.summary ||
    meihua.analysis.tiYongSeasonEvaluation ||
    `体卦${meihua.tiGua.name}（${meihua.tiGua.element}）与用卦${meihua.yongGua.name}（${meihua.yongGua.element}）呈「${meihua.analysis.tiYongRelation}」之势。`;

  return {
    lot,
    fullName,
    guidance,
    movingYaoName: meihua.movingYao.yaoName || `第${meihua.movingYao.position}爻`,
    interName: meihua.interHexagram?.name ?? null,
    changedName: meihua.changedHexagram?.name ?? null,
    tiYongRelation: meihua.analysis.tiYongRelation,
    trendSummary,
    dateLabel: formatSolarDateLabel(date),
    shichenLabel: getShichenLabel(date),
  };
}

/**
 * 按真实黄历择日算法（mingyu-core/divination/almanac）推算「今日吉凶」。
 * 确定性结果：完全由当日干支、黄道黑道、建除十二神、二十八宿、原始宜忌推导，绝不随机。
 */
export function computeRealDailyAlmanac(date = new Date()): RealDailyAlmanac {
  const dateStr = formatLocalDateISO(date);
  const selection = generateAlmanacSelection({
    topic: 'custom',
    startDate: dateStr,
    endDate: dateStr,
  });
  const day = selection.days[0];
  const shichenLabel = getShichenLabel(date);
  const currentBranch = shichenLabel.slice(0, 1);

  const starName = day.twelveStar.replace(/[（(].*[）)]$/, '').trim();
  const officerName = day.dayOfficer.replace(/日$/, '').trim();
  const isYellowRoad = YELLOW_ROAD_STARS.has(starName);
  const isGoodOfficer = GOOD_OFFICERS.has(officerName);
  const isCautionOfficer = CAUTION_OFFICERS.has(officerName);
  const starFortune = day.twentyEightStarDetail?.fortune ?? '';
  const hasAllAvoid =
    day.avoids.includes('诸事不宜') || day.recommends.includes('诸事不宜');
  const hasRestAvoid =
    day.avoids.some((item) => /[馀余]事勿取/.test(item)) ||
    day.recommends.some((item) => /[馀余]事勿取/.test(item));

  // 严格按黄道黑道 + 建除十二神 + 二十八宿 + 诸事不宜推导确定性吉凶
  let verdict: RealDailyAlmanac['verdict'];
  if (hasAllAvoid) {
    verdict = '黑道慎行';
  } else if (isYellowRoad && isGoodOfficer && starFortune !== '凶') {
    verdict = '黄道大吉';
  } else if (isYellowRoad && !isCautionOfficer) {
    verdict = '黄道吉日';
  } else if (!isYellowRoad && (isCautionOfficer || starFortune === '凶' || hasRestAvoid)) {
    verdict = '黑道慎行';
  } else if (!isYellowRoad) {
    verdict = '宜慎';
  } else {
    verdict = '平';
  }

  const isAuspicious = verdict === '黄道大吉' || verdict === '黄道吉日';
  const roadText = isYellowRoad ? '黄道' : '黑道';
  const basisParts = [
    `值神「${starName}」${roadText}`,
    `建除「${officerName}」日`,
    day.twentyEightStar ? `宿值「${day.twentyEightStar}${starFortune ? `·${starFortune}` : ''}」` : '',
  ].filter(Boolean);
  const basisSummary = basisParts.join(' · ');

  let detail: string;
  if (verdict === '黄道大吉') {
    detail = `今日${basisSummary}，吉神汇聚、气机清朗，适合推进重要安排与对外事务，仍须避开黄历所忌事项。`;
  } else if (verdict === '黄道吉日') {
    detail = `今日${basisSummary}，总体平顺偏吉，日常要务与黄历所宜之事可稳步展开，大事以精选吉时为佳。`;
  } else if (verdict === '平') {
    detail = `今日${basisSummary}，吉凶参半、守常为宜，日常事务可照常处理，重大决断宜多核验细节。`;
  } else if (verdict === '宜慎') {
    detail = `今日${basisSummary}，值神偏黑道，常规事务可缓步推进，涉及签约、动土、远行等要事宜格外审慎。`;
  } else {
    detail = `今日${basisSummary}${hasAllAvoid ? '，且黄历明列「诸事不宜」' : ''}，宜静养守成、整理内务，重大事项建议另择吉日。`;
  }

  const matchedHour = day.hours?.find((h) => h.branch === currentBranch) ?? null;
  const hourStarName = matchedHour
    ? matchedHour.twelveStar.replace(/[（(].*[）)]$/, '').trim()
    : '';

  return {
    date: day.date,
    dateLabel: `${formatSolarDateLabel(date)}`,
    lunarDate: day.lunarDate,
    ganzhiLabel: `${day.ganzhi.year}年 ${day.ganzhi.month}月 ${day.ganzhi.day}日`,
    shichenLabel,
    dayOfficer: officerName,
    twelveStar: starName,
    isYellowRoad,
    twentyEightStar: day.twentyEightStar,
    clash: day.clash,
    pengZu: day.pengZu,
    verdict,
    isAuspicious,
    basisSummary,
    detail,
    recommends: day.recommends.length ? day.recommends : ['平顺日常'],
    avoids: day.avoids.length ? day.avoids : ['无特殊禁忌'],
    currentHour: matchedHour
      ? {
          name: matchedHour.name,
          range: matchedHour.range,
          ganzhi: matchedHour.ganzhi,
          twelveStar: hourStarName,
          isYellowRoad: YELLOW_ROAD_STARS.has(hourStarName),
        }
      : null,
  };
}
