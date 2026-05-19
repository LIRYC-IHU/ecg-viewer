/**
 * WebGL shaders for the ECG trace renderer.
 *
 * Each sample of a lead is expanded on the CPU into two vertices (one on each
 * side of the polyline). The vertex shader uses the previous and next sample
 * positions to compute a miter-join perpendicular in screen space and offsets
 * the vertex by ±thickness/2 along it — giving genuine pixel-accurate line
 * thickness independent of WebGL's unreliable `lineWidth()`.
 */

export const VS_SOURCE = `
attribute vec2 a_pos;
attribute vec2 a_prev;
attribute vec2 a_next;
attribute float a_side;
uniform float u_timeOffsetSec;
uniform float u_pxPerSec;
uniform float u_pxPerMv;
uniform float u_originX;
uniform float u_baselineY;
uniform vec2 u_canvasSizePx;
uniform float u_thicknessPx;

vec2 toScreen(vec2 p) {
  return vec2(
    u_originX + (p.x - u_timeOffsetSec) * u_pxPerSec,
    u_baselineY - p.y * u_pxPerMv
  );
}

void main() {
  vec2 currS = toScreen(a_pos);
  vec2 prevS = toScreen(a_prev);
  vec2 nextS = toScreen(a_next);

  vec2 inDir = currS - prevS;
  vec2 outDir = nextS - currS;
  float inLen = length(inDir);
  float outLen = length(outDir);
  if (inLen > 0.0001) inDir /= inLen; else inDir = vec2(0.0);
  if (outLen > 0.0001) outDir /= outLen; else outDir = vec2(0.0);

  vec2 dir = inDir + outDir;
  float dl = length(dir);
  if (dl < 0.0001) {
    dir = outLen > 0.0001 ? outDir : inDir;
  } else {
    dir /= dl;
  }
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 finalScreen = currS + perp * (u_thicknessPx * 0.5 * a_side);

  gl_Position = vec4(
    (finalScreen.x / u_canvasSizePx.x) * 2.0 - 1.0,
    1.0 - (finalScreen.y / u_canvasSizePx.y) * 2.0,
    0.0, 1.0
  );
}`;

export const FS_SOURCE = `
precision mediump float;
uniform vec3 u_color;
void main() {
  gl_FragColor = vec4(u_color, 1.0);
}`;

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Failed to create shader.');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compilation failed: ' + log);
  }
  return sh;
}

export function compileProgram(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const vsh = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fsh = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program.');
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error('Program link failed: ' + log);
  }
  return prog;
}
