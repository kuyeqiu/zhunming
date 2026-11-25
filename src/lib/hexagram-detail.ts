/**
 * 六十四卦「卦象详解」结构化数据与生成引擎：
 * 结合 mingyu-core/classics《周易》全本经文（卦辞、大象传《象曰》、彖传、六爻爻辞与小象）
 * 与传统解卦（白话释义、大象哲理、运势/事业/经商/婚恋/决策诸事参看）。
 */

import { getZhouyiHexagramClassic } from 'mingyu-core/classics';
import { getHexagramFullName, type HexagramLot } from '@/lib/hexagram-lot';
import { getHexagramGuidance } from '@/lib/daily-almanac-hexagram';

export type HexagramLifeAspects = {
  fortune: string;
  career: string;
  business: string;
  relationship: string;
  decision: string;
};

export type HexagramDetail = {
  no: number;
  fullName: string;
  trigrams: string;
  palace: string;
  /** 原典经文 */
  guaCi: string;
  daXiang: string;
  tuanCi: string;
  yaos: Array<{
    position: number;
    positionName: string;
    yaoCi: string;
    xiaoXiang: string;
  }>;
  yongCi?: string;
  /** 白话解卦与大象哲理 */
  vernacular: string;
  grandImage: string;
  philosophy: string;
  /** 传统解卦 · 诸事参看 */
  aspects: HexagramLifeAspects;
  /** 行事宜忌 */
  suitable: readonly string[];
  avoid: readonly string[];
};

const TRIGRAM_DESC: Record<string, { nature: string; virtue: string; image: string }> = {
  乾: { nature: '天', virtue: '健', image: '刚健中正、自强不息之象' },
  坤: { nature: '地', virtue: '顺', image: '厚德载物、柔顺承载之象' },
  震: { nature: '雷', virtue: '动', image: '震动奋发、起势行进之象' },
  巽: { nature: '风', virtue: '入', image: '柔和渐进、无孔不入之象' },
  坎: { nature: '水', virtue: '陷', image: '险阻历练、守信通达之象' },
  离: { nature: '火', virtue: '丽', image: '光明附丽、文明明察之象' },
  艮: { nature: '山', virtue: '止', image: '笃实稳重、当止则止之象' },
  兑: { nature: '泽', virtue: '悦', image: '润泽和悦、交流感通之象' },
};

/** 重点卦象精编详解（其余卦由上下卦象 + 卦义引擎按同规格生成，保证 64 卦全覆盖） */
const CURATED_DETAILS: Partial<
  Record<
    number,
    {
      vernacular: string;
      grandImage: string;
      philosophy: string;
      aspects: HexagramLifeAspects;
    }
  >
> = {
  1: {
    vernacular:
      '乾卦象征纯阳刚健、万物之始。卦辞「元亨利贞」指起始宏大、通达顺畅、合宜而守正持久。大象强调天道运行刚健不息，君子观此当自强不息、以德统力。',
    grandImage: '上下皆乾（天），重刚而不息，阳气充盈，象征极强的开创力与主动力。',
    philosophy:
      '乾卦六爻以龙为喻，从「潜龙勿用」到「飞龙在天」再到「亢龙有悔」，揭示成事之道在于审时度势：蓄势时隐忍、得位时担当、极盛时知戒，刚健而不过刚方能长久。',
    aspects: {
      fortune: '气运强旺、生机勃发，宜顺势立志推进大事，但盛极须防骄盈。',
      career: '处于上升与开拓期，适合主动担纲主责、制定长远布局，切忌刚愎自用。',
      business: '利正道经营与品牌立信，忌盲目扩张或意气豪赌。',
      relationship: '双方气场较强，宜多一分体谅与柔软，避免针锋相对。',
      decision: '大方向明朗，宜果断立意、稳步落地，并始终留出防亢的缓冲余地。',
    },
  },
  2: {
    vernacular:
      '坤卦象征大地厚德、柔顺承接。卦辞「利牝马之贞」喻指如母马般柔顺而耐久，先迷失方向、后得主而利；得同道相助、安守正道则吉。',
    grandImage: '上下皆坤（地），纯阴厚重，万物皆由地而生载，象征包容、承载与踏实积累。',
    philosophy:
      '坤道贵在「后得主而有常」：不争一时之先，而以深厚承载成全大局。君子以厚德载物，先修内功与信誉，资源与人和自然归聚。',
    aspects: {
      fortune: '运势平稳厚重，宜守成蓄力、顺势配合，急躁冒进反易迷途。',
      career: '适合深耕执行、辅助核心团队或打牢根基，切忌强出风头。',
      business: '利稳健长线与老客维系，重信用与复利，不宜投机短炒。',
      relationship: '温润包容则家庭和睦，宜多倾听与体贴，忌冷战固执。',
      decision: '先谋稳妥、借助可靠伙伴或成熟路径，循序推进最为有利。',
    },
  },
  11: {
    vernacular:
      '泰卦下乾上坤，天气下降、地气上升，阴阳交感而万物通泰。「小往大来，吉亨」意为微小消耗换来丰厚回馈，诸事顺达通畅。',
    grandImage: '天居地下、地处天上，二气相交不隔，正是上下同心、内外融通之盛象。',
    philosophy:
      '《象》云「财成天地之道，辅相天地之宜」，泰极易转否，故盛世通泰之时更须节制有度、未雨绸缪，以长保通达。',
    aspects: {
      fortune: '气机通畅、顺风顺水，是推进重要计划与联络贵人的良机。',
      career: '上下沟通顺畅，团队协作默契，利晋升、签约与跨界合作。',
      business: '市场与人脉双向呼应，利扩展渠道与促成大单，同时注意留存准备金。',
      relationship: '心意相通、情感融洽，利表白、订盟与家庭和合。',
      decision: '顺势而为、把握窗口，但忌安逸松懈而忽视长远风控。',
    },
  },
  15: {
    vernacular:
      '谦卦艮下坤上，高山隐于平地之中，象征位高而不自满、才盛而不炫耀。「亨，君子有终」指秉持谦逊之道，终能行稳致远、圆满收成。',
    grandImage: '地中有山，内蕴高峻而外显平实，君子观此「裒多益寡，称物平施」，损有余而补不足。',
    philosophy:
      '六十四卦中唯谦卦六爻皆无凶辞。谦不是卑微怯懦，而是看清天道「亏盈益谦」后的清醒与笃定——不居功、不争锋，反而赢得最持久的信任与助力。',
    aspects: {
      fortune: '稳健向好、逢凶化吉，低调务实最易获得意外贵人扶持。',
      career: '切忌居功自傲，多礼让功劳、虚心纳谏，反而威望日隆。',
      business: '利薄利多销与诚信共赢，平衡各方利益可成长期大业。',
      relationship: '彼此尊重、礼让有度，感情绵长稳固。',
      decision: '收起锋芒、留三分余地，以平和均衡之道处事必有善终。',
    },
  },
  43: {
    vernacular:
      '夬卦兑上乾下，意为决断、清除积弊。卦辞警示：于公开场合诚恳宣告风险，虽有危机但只要守正不轻启争端、先整饬自身，则利有攸往。《象辞》指泽水升于天上即将化雨润物，君子当广施恩泽而不居功自傲。',
    grandImage:
      '泽水积满于天、决注成雨；五阳盛极而去一阴，象征决断与转折，势虽强盛却暗藏风险。',
    philosophy:
      '《序卦》云「益而不已必决，故受之以夬」。增益到极点必生溃决，故处于兴盛高峰时尤须居安思危：对下广施恩惠、不以德自居，对隐患则以公开、温和而坚定的方式及时决断，切忌莽撞激化矛盾。',
    aspects: {
      fortune: '目前虽呈兴盛之势，但变动与考验正在酝酿，宜提高警觉、戒骄防口舌。',
      career: '处于关键高位期，务必团结众人、分享成果、防范小人干扰，处理分歧宜柔中带刚。',
      business: '留意市场拐点与合作方诚意，不宜盲目大举冒进，稳中求变、加强盟友协作。',
      relationship: '注重真诚沟通，防轻信传言或功利介入，保持清醒边界。',
      decision: '多谋深思、虚心纳谏，切勿外强中干或一时鲁莽，以和缓有序之法果断去弊。',
    },
  },
  49: {
    vernacular:
      '革卦离下兑上，火在泽下、水火相息而促成变革。「巳日乃孚，元亨利贞，悔亡」意为变革须待时机成熟、赢得众人信服后再推行，方能通达无悔。',
    grandImage: '泽中有火，水火激荡而旧貌换新颜，君子观此「治历明时」，顺应天时节奏推进革新。',
    philosophy:
      '革故鼎新之道在于「顺天应人、审时而动」：既不能因循守旧错失转机，也不能操之过急强行改制。先沟通共识、再稳步落地，变革才能水到渠成。',
    aspects: {
      fortune: '迎来除旧布新的转折节点，主动优化调整比被动守旧更有利。',
      career: '适合升级方法、调整定位或推动流程改造，先争取核心成员共识再实施。',
      business: '旧模式趋于饱和，宜顺应新趋势迭代产品或转型，切忌盲目跟风。',
      relationship: '宜坦诚化解积压心结、改善相处方式，切忌情绪化推翻重来。',
      decision: '看准时机果断更新，做到有理有据、步步取信，则无后顾之忧。',
    },
  },
  63: {
    vernacular:
      '既济卦离下坎上，水在火上、烹煮调和，象征事务已经达成初成阶段。但卦辞特别提醒「初吉终乱」，圆满之后最易滋生懈怠与隐患。',
    grandImage: '水在火上各得其位，既已成事，君子观此当「思患而预防之」，在顺境中提前设防。',
    philosophy:
      '天下事往往难在善终。既济之后六爻虽各当其位，却已到盈满之界，唯保持敬畏与警觉、做好收尾验收与长期维护，方能守住胜果。',
    aspects: {
      fortune: '前期进展顺利、初见成果，但须防后劲不足或细节疏漏导致反复。',
      career: '项目临近验收收官，务必把控最后细节与复盘归档，切忌提前松懈。',
      business: '已有收益宜落袋为安、巩固老客与现金流，防盲目加杠杆。',
      relationship: '感情稳定之时更需用心经营，莫因习以为常而疏于关怀。',
      decision: '守成重于再扩，提前做好风险预案，方保长治久安。',
    },
  },
  64: {
    vernacular:
      '未济卦坎下离上，火炎上、水润下，尚未交合，象征事业仍在渡河途中、距成事仅一步之遥。「小狐汔济，濡其尾」警示临近终点切忌急躁大意。',
    grandImage: '火在水上未成既济，君子观此「慎辨物居方」，理清各方位置与轻重缓急。',
    philosophy:
      '《周易》以未济作结，正寓「生生不息、永无止境」之深意。未完成意味着仍有无限可能，只要辨明方向、沉住气走稳最后几步，便能由未济转向既济。',
    aspects: {
      fortune: '处于过渡与酝酿阶段，前景可期但尚未完全定局，贵在耐心与细致。',
      career: '临门一脚切忌草率，梳理清分工与优先级，分阶段稳步收口。',
      business: '尚在投入与磨合期，宜控制节奏、严核条款，静待回款与成熟。',
      relationship: '关系仍在磨合了解中，多给彼此时间与尊重，勿急于求成。',
      decision: '先辨清主次与界限，每走一步核对一次，切忌临尾急躁。',
    },
  },
};

export function buildHexagramDetail(lot: HexagramLot): HexagramDetail {
  const classic = getZhouyiHexagramClassic(lot.no);
  const fullName = getHexagramFullName(lot);
  const guidance = getHexagramGuidance(lot);
  const lowerName = lot.trigrams.slice(0, 1);
  const upperName = lot.trigrams.slice(2, 3);
  const lowerDesc = TRIGRAM_DESC[lowerName] ?? TRIGRAM_DESC['乾'];
  const upperDesc = TRIGRAM_DESC[upperName] ?? TRIGRAM_DESC['乾'];
  const curated = CURATED_DETAILS[lot.no];

  const daXiang = classic?.daXiang ?? '';
  const guaCi = classic?.guaCi ?? lot.text;
  const tuanCi = classic?.tuanCi ?? '';
  const palace = classic?.palace ? `${classic.palace}宫` : '';

  const vernacular =
    curated?.vernacular ??
    `${fullName}（${lot.trigrams}）：${guidance.plainMeaning} 卦辞「${lot.text}」意在提醒观象者顺应当下气机，把握分寸与节奏。`;

  const grandImage =
    curated?.grandImage ??
    `本卦下卦为${lowerName}（${lowerDesc.nature}、${lowerDesc.virtue}），上卦为${upperName}（${upperDesc.nature}、${upperDesc.virtue}）；${upperDesc.nature}${lowerDesc.nature}相叠，内具${lowerDesc.image}，外显${upperDesc.image}。`;

  const philosophy =
    curated?.philosophy ??
    `${daXiang ? `《大象》提示「${daXiang.replace(/^象曰：/, '')}」。` : ''}此卦启示处世当兼顾内修与外行：以${lowerName}卦之「${lowerDesc.virtue}」稳住根本，以${upperName}卦之「${upperDesc.virtue}」应对外境；宜${guidance.suitable.join('、')}，切忌${guidance.avoid.join('、')}。`;

  const aspects: HexagramLifeAspects = curated?.aspects ?? {
    fortune: `${guidance.plainMeaning}`,
    career: `宜围绕「${guidance.suitable[0] ?? '稳步推进'}」展开，${guidance.suitable[1] ? `兼顾${guidance.suitable[1]}，` : ''}忌${guidance.avoid[0] ?? '盲目冒进'}。`,
    business: `财务与往来重在守信与节奏，适合${guidance.suitable[guidance.suitable.length - 1] ?? '务实积累'}，防范${guidance.avoid[guidance.avoid.length - 1] ?? '仓促决断'}。`,
    relationship: `人际与情感贵在真诚有度，顺应${upperName}（${upperDesc.virtue}）与${lowerName}（${lowerDesc.virtue}）相济之道，忌${guidance.avoid[0] ?? '意气用事'}。`,
    decision: `行动前先定心校准方向，优先落实「${guidance.suitable.slice(0, 2).join('、')}」，避开「${guidance.avoid.join('、')}」。`,
  };

  return {
    no: lot.no,
    fullName,
    trigrams: lot.trigrams,
    palace,
    guaCi,
    daXiang,
    tuanCi,
    yaos: classic?.yaos ?? [],
    yongCi: classic?.yongCi,
    vernacular,
    grandImage,
    philosophy,
    aspects,
    suitable: guidance.suitable,
    avoid: guidance.avoid,
  };
}
