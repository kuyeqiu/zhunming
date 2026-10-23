/**
 * 水墨视觉原子。
 *
 * 关键实现：枯笔飞白靠 SVG 滤镜（feTurbulence + feDisplacementMap）实现，
 * 而不是位图素材 —— 这样颜色跟随 currentColor，暗色模式自动生效，
 * 体积也只有几百字节。
 *
 * 滤镜 id 与 ink-tokens.css 中的 filter: url(#ink-dry-brush) 等引用一一对应。
 */

export type InkMotifName = 'shadow' | 'eye' | 'compass';

const filterDefs = (
  <defs>
    {/* 枯笔飞白：低频噪声做整体位移，高频噪声补毛边 */}
    <filter id="ink-dry-brush" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="8" result="noise" />
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="11"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="fineNoise" />
      <feDisplacementMap in="displaced" in2="fineNoise" scale="2.5" />
    </filter>

    {/* 宣纸微渗墨：只做轻微抖动，用于印章、四柱字 */}
    <filter id="ink-bleed" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" />
    </filter>
  </defs>
);

/** 全局只需挂一次：把滤镜定义注入文档。 */
export function InkFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      {filterDefs}
    </svg>
  );
}

/** 宣纸纤维层。fixed 定位，不吃事件。 */
export function PaperGrain() {
  return <div className="ink-grain" aria-hidden="true" />;
}

/** 孤影长行：行者背影 + 由浓转淡的长长投影。 */
function ShadowArtwork({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 400"
      fill="none"
      role="img"
      aria-label="水墨：独行者拖着长长的背影"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#ink-dry-brush)" stroke="currentColor" strokeLinecap="round">
        {/* 地面长影：面 + 一根主线，浓淡两层 */}
        <path
          d="M168 188 C145 245, 95 315, 25 382 C52 388, 118 330, 184 192 Z"
          fill="currentColor"
          stroke="none"
          opacity="0.2"
        />
        <path
          d="M165 188 C135 250, 82 325, 42 372"
          strokeWidth="14"
          opacity="0.36"
        />

        {/* 头部与发髻 */}
        <circle cx="174" cy="86" r="11" fill="currentColor" stroke="none" />
        {/* 斗笠弧线 */}
        <path d="M150 100 Q174 84 198 101" strokeWidth="6.5" />
        {/* 袍身：两侧轮廓留白，中间一道衣摆墨团 */}
        <path d="M162 104 C152 132, 150 165, 156 190" strokeWidth="9" />
        <path d="M185 104 C194 134, 192 162, 182 190" strokeWidth="7.5" />
        <path d="M160 128 C168 152, 176 170, 170 192" strokeWidth="12" />
        {/* 行杖 */}
        <path d="M202 92 L216 196" strokeWidth="3.2" />
      </g>
      {/* 朱砂落款点 */}
      <circle cx="222" cy="196" r="3" fill="var(--cinnabar, #9e2a2b)" opacity="0.85" />
    </svg>
  );
}

/** 水墨观眼：上下眼睑交于内外眼角，瞳仁破墨圆相，睫毛与悬墨收尾。 */
function EyeArtwork({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 340 200"
      fill="none"
      role="img"
      aria-label="水墨：一只注视的眼"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 眼窝淡墨：给瞳孔一点体积，不用纯白 */}
      <ellipse cx="170" cy="98" rx="86" ry="34" fill="currentColor" opacity="0.05" />

      <g filter="url(#ink-dry-brush)" stroke="currentColor" strokeLinecap="round" fill="none">
        {/* 上眼睑：主笔，起笔重、收笔轻 */}
        <path d="M40 100 C86 54, 254 54, 300 100" strokeWidth="7" />
        {/* 下眼睑：虚笔，淡墨 */}
        <path d="M44 102 C104 138, 236 138, 296 102" strokeWidth="4" opacity="0.62" />
        {/* 内外眼角：两处浓墨点，让眼形咬合 */}
        <path d="M34 101 C40 96, 47 99, 46 103" strokeWidth="5" />
        <path d="M297 99 C303 95, 310 99, 306 104" strokeWidth="4.5" />
        {/* 睫毛：由粗到细，只留四笔 */}
        <path d="M96 66 C92 58, 90 52, 90 46" strokeWidth="3" opacity="0.8" />
        <path d="M130 58 C127 50, 126 44, 127 38" strokeWidth="2.6" opacity="0.7" />
        <path d="M206 58 C209 50, 210 44, 209 38" strokeWidth="2.6" opacity="0.7" />
        <path d="M240 66 C244 58, 246 52, 246 46" strokeWidth="3" opacity="0.8" />
        {/* 瞳仁：破墨圆相，缺一段即「未画满」 */}
        <circle className="ink-iris" cx="170" cy="98" r="30" strokeWidth="6" strokeDasharray="148 40" />
        <circle cx="170" cy="98" r="10.5" fill="currentColor" stroke="none" />
        {/* 眼尾散逸：三笔浓淡递进 */}
        <path d="M302 100 C316 96, 328 88, 334 78" strokeWidth="2.6" opacity="0.5" />
        <path d="M300 106 C314 108, 326 114, 332 122" strokeWidth="1.8" opacity="0.32" />
        {/* 悬墨：一滴将落未落 */}
        <path d="M214 126 C216 146, 214 164, 216 178" strokeWidth="2" opacity="0.28" />
      </g>

      {/* 瞳心一点朱砂 */}
      <circle cx="175" cy="93" r="3.2" fill="var(--cinnabar, #9e2a2b)" />
    </svg>
  );
}

/**
 * 水墨罗盘：首页视觉锚点。
 *
 * 刻意不承担导航——它只是"注视的中心"，点它不会跳去某个系统。
 * 三环：外环 24 山刻度（15° 一格）、中环八字方位、内环朱砂虚圆。
 */
function CompassArtwork({ className }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, index) => index * 15);
  const directions = [
    { label: '子', angle: 0 },
    { label: '艮', angle: 45 },
    { label: '卯', angle: 90 },
    { label: '巽', angle: 135 },
    { label: '午', angle: 180 },
    { label: '坤', angle: 225 },
    { label: '酉', angle: 270 },
    { label: '乾', angle: 315 },
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      fill="none"
      role="img"
      aria-label="水墨罗盘"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeLinecap="round">
        {/* 外环：两道同心细线 */}
        <circle cx="200" cy="200" r="186" strokeWidth="1.1" opacity="0.5" />
        <circle cx="200" cy="200" r="176" strokeWidth="0.8" opacity="0.28" />

        {/* 24 山刻度：长短交替 */}
        {spokes.map((angle) => {
          const long = angle % 45 === 0;
          const outer = 186;
          const inner = long ? 156 : 168;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={200 + Math.sin(rad) * inner}
              y1={200 - Math.cos(rad) * inner}
              x2={200 + Math.sin(rad) * outer}
              y2={200 - Math.cos(rad) * outer}
              strokeWidth={long ? 1.6 : 0.9}
              opacity={long ? 0.62 : 0.34}
            />
          );
        })}

        {/* 中环：方位字 */}
        {directions.map(({ label, angle }) => {
          const rad = (angle * Math.PI) / 180;
          const r = 134;
          return (
            <text
              key={label}
              x={200 + Math.sin(rad) * r}
              y={200 - Math.cos(rad) * r}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              stroke="none"
              fontSize="17"
              fontFamily="var(--ink-font-serif, serif)"
              opacity="0.82"
            >
              {label}
            </text>
          );
        })}

        {/* 内环：朱砂虚圆，留缺一段（破墨） */}
        <circle
          cx="200"
          cy="200"
          r="86"
          stroke="var(--cinnabar, #9e2a2b)"
          strokeWidth="1.4"
          strokeDasharray="210 62"
          opacity="0.55"
        />

        {/* 四条正交轴线 */}
        {[0, 90, 180, 270].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={`axis-${angle}`}
              x1={200 + Math.sin(rad) * 92}
              y1={200 - Math.cos(rad) * 92}
              x2={200 + Math.sin(rad) * 150}
              y2={200 - Math.cos(rad) * 150}
              strokeWidth="0.9"
              opacity="0.22"
            />
          );
        })}
      </g>

      {/* 中心：一点朱砂 + 一圈淡墨 */}
      <circle cx="200" cy="200" r="26" stroke="currentColor" strokeWidth="0.9" opacity="0.22" />
      <circle cx="200" cy="200" r="4.4" fill="var(--cinnabar, #9e2a2b)" />
    </svg>
  );
}

const MOTIFS: Record<InkMotifName, (props: { className?: string }) => React.ReactElement> = {
  shadow: ShadowArtwork,
  eye: EyeArtwork,
  compass: CompassArtwork,
};

export function InkMotif({
  name,
  className,
}: {
  name: InkMotifName;
  className?: string;
}) {
  const Artwork = MOTIFS[name];
  return <Artwork className={className} />;
}

export const INK_MOTIF_LABELS: Record<InkMotifName, string> = {
  shadow: '孤影长行',
  eye: '水墨观眼',
  compass: '水墨罗盘',
};
