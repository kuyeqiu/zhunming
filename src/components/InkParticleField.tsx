import { useEffect, useRef, useState } from 'react';

/**
 * 水墨粒子场：把一张水墨画采样成点云，用 WebGL2 顶点着色器做风。
 *
 * 移植自用户提供的独立 demo（drafts/ink-particle/original.html，留档）：
 * - 采样：按墨色密度拒绝采样，主体 7.8 万粒（移动端 3.2 万）+ 环境 650 粒，
 *   种子固定（mulberry32(712367)），场景可复现；
 * - 风向：右上往左下，树梢/人物/衣摆/雾分区扰动，衣摆柔性波动；
 * - 入场：粒子从中心一团飞散归位（2.8s），加色混合、银白墨色粒子；
 * - 交互：鼠标划过推开附近粒子。
 * 画布铺满父容器（hero），素材是压缩到 1000px 宽的 JPEG（原画 2.84MB PNG → 52KB，
 * 采样本来就只按 1000px 读像素，信息量无损）。
 * 降级：WebGL2 不可用时直接平铺原画；DPR 封顶 1.5；prefers-reduced-motion 冻结在
 * 入场完成的一帧；标签页隐藏或滚出视口时停帧。
 */

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aTarget;
in vec2 aStart;
in float aSeed;
in float aSize;
in float aLayer;
in vec3 aColor;
uniform float uTime;
uniform float uEnter;
uniform vec2 uMouse;
uniform vec2 uResolution;
out vec3 vColor;
out float vAlpha;
float ease(float x){return 1.0-pow(1.0-clamp(x,0.0,1.0),3.0);}
void main(){
  float e=ease(uEnter);
  vec2 p=mix(aStart,aTarget,e);
  float t=uTime;
  float env=aLayer;

  // 风向：从右上往左下斜吹。主体只做轻微偏移，局部雾、树梢和衣摆更明显。
  float treeZone = (1.0-smoothstep(0.18,0.34,aTarget.x)) * smoothstep(0.20,0.34,aTarget.y) * (1.0-smoothstep(0.62,0.76,aTarget.y));
  float personZone = smoothstep(0.29,0.325,aTarget.x) * (1.0-smoothstep(0.405,0.455,aTarget.x)) * smoothstep(0.44,0.49,aTarget.y) * (1.0-smoothstep(0.73,0.80,aTarget.y));
  float robeZone = smoothstep(0.315,0.335,aTarget.x) * (1.0-smoothstep(0.395,0.43,aTarget.x)) * smoothstep(0.515,0.55,aTarget.y) * (1.0-smoothstep(0.72,0.77,aTarget.y));
  float robeLower = smoothstep(0.54,0.72,aTarget.y);
  float mistZone = smoothstep(0.38,0.50,aTarget.y) * (1.0-smoothstep(0.72,0.84,aTarget.y));
  float windMask = clamp(treeZone*0.95 + personZone*1.25 + mistZone*0.30, 0.0, 1.35);

  float gust = sin(t*0.72 + aSeed*15.0 + aTarget.y*11.0) * 0.58 +
               sin(t*0.31 + aSeed*31.0 + aTarget.x*7.0) * 0.42;
  float baseSway = 0.0010 + windMask*0.0052 + env*0.0070;
  float windPulse = 0.58 + 0.42*sin(t*0.46 + aSeed*17.0);

  // 衣摆单独做柔性飘动：越靠下摆幅越大，并带一点滞后的波浪感。
  float clothWave = sin(t*1.05 + aSeed*8.0 + aTarget.y*28.0 + aTarget.x*13.0);
  float clothWave2 = sin(t*0.63 + aSeed*17.0 + aTarget.y*17.0);
  float clothAmp = robeZone * (0.45 + 0.85*robeLower);
  p.x -= clothAmp * (0.0045 + 0.0050*abs(clothWave)) ;
  p.y += clothAmp * (clothWave*0.0036 + clothWave2*0.0018);
  // 右上 -> 左下：x 减少，y 增加
  p.x -= abs(gust) * baseSway * 1.15 + windPulse*(windMask*0.0018 + env*0.0030);
  p.y += abs(gust) * baseSway * 0.62 + sin(t*0.41 + aSeed*23.0)*(windMask*0.0014 + env*0.0021);

  // 少量环境粒子沿右上 -> 左下持续穿过画面，形成稀疏风线。
  if(env > 0.5){
    float travel = fract(aSeed + t*(0.026 + aSeed*0.015));
    p.x = fract(aTarget.x - travel*0.48 + 1.0);
    p.y = fract(aTarget.y + travel*0.29);
    p.x += sin(t*0.23 + aSeed*29.0) * 0.003;
    p.y += cos(t*0.17 + aSeed*19.0) * 0.002;
  }

  vec2 m=uMouse;
  vec2 d=p-m;
  float md=length(d*vec2(uResolution.x/uResolution.y,1.0));
  float force=(1.0-smoothstep(0.0,0.18,md))*0.035;
  if(md>0.0001) p += normalize(d)*force*(0.30+0.70*env);

  float viewAspect=uResolution.x/uResolution.y;
  float imageAspect=1672.0/941.0;
  vec2 clip;
  // cover 模式：粒子画面真正铺满整个视口，允许边缘轻微裁切，不再出现留边。
  if(viewAspect>imageAspect){
    float s=viewAspect/imageAspect;
    clip=vec2(p.x*2.0-1.0, ((1.0-p.y)*2.0-1.0)*s);
  } else {
    float s=imageAspect/viewAspect;
    clip=vec2((p.x*2.0-1.0)*s, (1.0-p.y)*2.0-1.0);
  }
  gl_Position=vec4(clip,0.0,1.0);
  float pulse=1.0+sin(t*0.8+aSeed*30.0)*0.12*env;
  gl_PointSize=aSize*pulse*(0.85+0.15*e)*min(uResolution.y/900.0,1.35);
  vColor=aColor;
  vAlpha=mix(0.84,0.38,env)*e;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main(){
  vec2 q=gl_PointCoord-0.5;
  float r=length(q);
  if(r>0.5) discard;
  float a=(1.0-smoothstep(0.12,0.5,r))*vAlpha;
  outColor=vec4(vColor,a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
  }
  return shader;
}

function mulberry32(a: number) {
  return function random() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface InkParticleFieldProps {
  className?: string;
  /** 采样用的水墨画，默认是压缩进 public 的 1000px JPEG */
  imageSrc?: string;
  /** 置 true 后粒子从成画位置反向消散（入场动画倒放） */
  exiting?: boolean;
  /** 消散播完（uEnter 归零）时回调一次；离开页面/跳转由调用方决定 */
  onExited?: () => void;
}

export function InkParticleField({
  className,
  imageSrc = '/ink-scene.jpg',
  exiting = false,
  onExited,
}: InkParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useImageFallback, setUseImageFallback] = useState(false);
  const exitingRef = useRef(exiting);
  const onExitedRef = useRef<(() => void) | undefined>(onExited);

  useEffect(() => {
    exitingRef.current = exiting;
  }, [exiting]);
  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      setUseImageFallback(true);
      return undefined;
    }

    const program = gl.createProgram();
    if (!program) return undefined;
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseImageFallback(true);
      return undefined;
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    const location = (name: string) => gl.getAttribLocation(program, name);
    const loc = {
      aTarget: location('aTarget'),
      aStart: location('aStart'),
      aSeed: location('aSeed'),
      aSize: location('aSize'),
      aLayer: location('aLayer'),
      aColor: location('aColor'),
    };
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uEnter = gl.getUniformLocation(program, 'uEnter');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uResolution = gl.getUniformLocation(program, 'uResolution');

    const bindAttrib = (name: keyof typeof loc, data: Float32Array, size: number) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc[name]);
      gl.vertexAttribPointer(loc[name], size, gl.FLOAT, false, 0, 0);
    };

    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const image = new Image();
    image.onload = () => {
      const ow = 1000;
      const oh = Math.round((ow * image.height) / image.width);
      const offscreen = document.createElement('canvas');
      offscreen.width = ow;
      offscreen.height = oh;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, ow, oh);
      const px = ctx.getImageData(0, 0, ow, oh).data;

      const mobile = window.matchMedia('(max-width: 700px)').matches;
      const subjectCount = mobile ? 32000 : 78000;
      const envCount = mobile ? 300 : 650;
      const total = subjectCount + envCount;
      const target = new Float32Array(total * 2);
      const start = new Float32Array(total * 2);
      const seed = new Float32Array(total);
      const size = new Float32Array(total);
      const layer = new Float32Array(total);
      const color = new Float32Array(total * 3);

      const rand = mulberry32(712367);
      let made = 0;
      let tries = 0;
      while (made < subjectCount && tries < subjectCount * 90) {
        tries += 1;
        const x = (rand() * ow) | 0;
        const y = (rand() * oh) | 0;
        const i = (y * ow + x) * 4;
        const r = px[i]! / 255;
        const g = px[i + 1]! / 255;
        const b = px[i + 2]! / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const ink = 1 - lum;
        const warm = Math.max(0, r - b) * 0.45;
        const ny = y / oh;
        const nx = x / ow;
        let density = Math.pow(Math.max(0, ink), 0.78) * 0.98 + warm * 0.1;

        const ridge =
          0.435 +
          0.03 * Math.sin(nx * 7.7 + 0.8) +
          0.017 * Math.sin(nx * 18.3 - 1.4) +
          0.009 * Math.sin(nx * 41.0 + 2.2);
        const skyCell =
          0.5 + 0.5 * Math.sin(nx * 15.7 + ny * 21.3 + Math.sin(nx * 33.0) * 1.7);
        const skyVoid =
          0.5 + 0.5 * Math.sin(nx * 5.1 - ny * 11.7 + Math.sin(nx * 12.9 + 1.2) * 2.1);
        if (ny < ridge) {
          const localKeep =
            (0.035 + 0.24 * Math.pow(skyCell, 3.2)) * (0.18 + 0.82 * Math.pow(skyVoid, 2.6));
          density *= ink > 0.18 ? 0.18 + localKeep * 1.65 : localKeep * 0.09;
        } else if (ny < ridge + 0.2) {
          const blend = Math.min(1, Math.max(0, (ny - ridge) / 0.2));
          density *= 0.46 + blend * 0.4;
        }
        if (ny >= 0.63) {
          const waves =
            Math.sin(nx * 18.0 + ny * 9.0) + 0.62 * Math.sin(nx * 33.0 - ny * 13.0);
          const keepBand = waves > -0.12 ? 1.0 : 0.1;
          density *= keepBand * (0.2 + 1.25 * Math.pow(ink, 0.92));
          if (ink < 0.075) density *= 0.025;
        }

        if (rand() > Math.min(density, 0.94)) continue;
        const j = made * 2;
        target[j] = (x + rand()) / ow;
        target[j + 1] = (y + rand()) / oh;
        const angle = rand() * Math.PI * 2;
        const radius = 0.22 + rand() * 0.7;
        start[j] = 0.5 + Math.cos(angle) * radius;
        start[j + 1] = 0.52 + Math.sin(angle) * radius * 0.56;
        seed[made] = rand();
        size[made] = 0.95 + rand() * 2.25 * (0.38 + ink);
        layer[made] = 0;
        const k = made * 3;
        const white = 0.62 + Math.pow(ink, 0.65) * 0.38;
        const sunBoost = warm * 0.22;
        color[k] = Math.min(1.0, white + sunBoost);
        color[k + 1] = Math.min(1.0, white + sunBoost * 0.55);
        color[k + 2] = Math.min(1.0, white - sunBoost * 0.2);
        made += 1;
      }

      let envMade = 0;
      let envTries = 0;
      while (envMade < envCount && envTries < envCount * 40) {
        envTries += 1;
        const ex = 0.06 + rand() * 0.92;
        const ey = 0.1 + rand() * 0.76;
        const cluster =
          0.5 + 0.5 * Math.sin(ex * 9.3 + ey * 13.7 + Math.sin(ex * 21.0) * 1.9);
        const voidMask =
          0.5 + 0.5 * Math.sin(ex * 4.1 - ey * 7.6 + Math.sin(ey * 16.0 + 0.7) * 2.4);
        const vertical = ey < 0.48 ? 0.42 : ey < 0.68 ? 0.72 : 0.32;
        const accept =
          vertical * Math.pow(cluster, 2.8) * (0.12 + 0.88 * Math.pow(voidMask, 2.2));
        if (rand() > accept) continue;
        const idx = subjectCount + envMade;
        const j = idx * 2;
        target[j] = ex;
        target[j + 1] = ey;
        start[j] = rand();
        start[j + 1] = rand();
        seed[idx] = rand();
        size[idx] = 0.7 + rand() * 1.45;
        layer[idx] = 1;
        const k = idx * 3;
        const gold = rand() < 0.035;
        color[k] = gold ? 1.0 : 0.82;
        color[k + 1] = gold ? 0.82 : 0.84;
        color[k + 2] = gold ? 0.58 : 0.88;
        envMade += 1;
      }
      const count = subjectCount + envMade;

      bindAttrib('aTarget', target, 2);
      bindAttrib('aStart', start, 2);
      bindAttrib('aSeed', seed, 1);
      bindAttrib('aSize', size, 1);
      bindAttrib('aLayer', layer, 1);
      bindAttrib('aColor', color, 3);
      run(count);
    };

    let raf = 0;
    let inView = true;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const run = (count: number) => {
      const t0 = performance.now();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ENTER_DURATION = 2.8;
      const EXIT_DURATION = 0.9;
      let enter = reducedMotion ? 1 : 0;
      let last = t0;
      let notified = false;
      const frame = (now: number) => {
        raf = window.requestAnimationFrame(frame);
        if (!inView || document.hidden) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (exitingRef.current) {
          // 消散：入场动画倒放，uEnter 从 1 回到 0 后通知一次
          if (reducedMotion || enter <= 0) {
            if (!notified) {
              notified = true;
              enter = 0;
              onExitedRef.current?.();
            }
          } else {
            enter = Math.max(0, enter - dt / EXIT_DURATION);
            if (enter <= 0 && !notified) {
              notified = true;
              onExitedRef.current?.();
            }
          }
        } else if (enter < 1) {
          enter = Math.min(1, enter + dt / ENTER_DURATION);
        }
        pointer.x += (pointer.tx - pointer.x) * 0.07;
        pointer.y += (pointer.ty - pointer.y) * 0.07;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(uTime, reducedMotion ? 0 : (now - t0) / 1000);
        gl.uniform1f(uEnter, enter);
        gl.uniform2f(uMouse, pointer.x, pointer.y);
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.drawArrays(gl.POINTS, 0, count);
      };
      raf = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
    });
    intersectionObserver.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.ty = (event.clientY - rect.top) / Math.max(1, rect.height);
    };
    const onPointerLeave = () => {
      pointer.tx = 0.5;
      pointer.ty = 0.5;
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    image.src = imageSrc;

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      gl.getProgramParameter(program, gl.LINK_STATUS) && gl.deleteProgram(program);
    };
  }, [imageSrc]);

  if (useImageFallback) {
    return <img className={className} src={imageSrc} alt="" aria-hidden="true" />;
  }
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
