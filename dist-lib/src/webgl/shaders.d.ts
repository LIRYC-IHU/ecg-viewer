/**
 * WebGL shaders for the ECG trace renderer.
 *
 * Each sample of a lead is expanded on the CPU into two vertices (one on each
 * side of the polyline). The vertex shader uses the previous and next sample
 * positions to compute a miter-join perpendicular in screen space and offsets
 * the vertex by ±thickness/2 along it — giving genuine pixel-accurate line
 * thickness independent of WebGL's unreliable `lineWidth()`.
 */
export declare const VS_SOURCE = "\nattribute vec2 a_pos;\nattribute vec2 a_prev;\nattribute vec2 a_next;\nattribute float a_side;\nuniform float u_timeOffsetSec;\nuniform float u_pxPerSec;\nuniform float u_pxPerMv;\nuniform float u_originX;\nuniform float u_baselineY;\nuniform vec2 u_canvasSizePx;\nuniform float u_thicknessPx;\n\nvec2 toScreen(vec2 p) {\n  return vec2(\n    u_originX + (p.x - u_timeOffsetSec) * u_pxPerSec,\n    u_baselineY - p.y * u_pxPerMv\n  );\n}\n\nvoid main() {\n  vec2 currS = toScreen(a_pos);\n  vec2 prevS = toScreen(a_prev);\n  vec2 nextS = toScreen(a_next);\n\n  vec2 inDir = currS - prevS;\n  vec2 outDir = nextS - currS;\n  float inLen = length(inDir);\n  float outLen = length(outDir);\n  if (inLen > 0.0001) inDir /= inLen; else inDir = vec2(0.0);\n  if (outLen > 0.0001) outDir /= outLen; else outDir = vec2(0.0);\n\n  vec2 dir = inDir + outDir;\n  float dl = length(dir);\n  if (dl < 0.0001) {\n    dir = outLen > 0.0001 ? outDir : inDir;\n  } else {\n    dir /= dl;\n  }\n  vec2 perp = vec2(-dir.y, dir.x);\n  vec2 finalScreen = currS + perp * (u_thicknessPx * 0.5 * a_side);\n\n  gl_Position = vec4(\n    (finalScreen.x / u_canvasSizePx.x) * 2.0 - 1.0,\n    1.0 - (finalScreen.y / u_canvasSizePx.y) * 2.0,\n    0.0, 1.0\n  );\n}";
export declare const FS_SOURCE = "\nprecision mediump float;\nuniform vec3 u_color;\nvoid main() {\n  gl_FragColor = vec4(u_color, 1.0);\n}";
export declare function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader;
export declare function compileProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram;
