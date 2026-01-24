import React, { useEffect, useRef } from 'react';
import './Fluidlanding.css'; // Make sure to import the CSS

const FluidLanding: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // --- SHADER SOURCES ---
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
          gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
      }

      void main() {
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          st.x *= u_resolution.x / u_resolution.y;

          vec2 mouse = u_mouse / u_resolution.xy;
          mouse.x *= u_resolution.x / u_resolution.y;
          
          float dist = distance(st, mouse);
          float interact = 1.0 - smoothstep(0.0, 0.5, dist);

          float time = u_time * 0.1;
          
          vec2 q = vec2(0.);
          q.x = snoise(st + vec2(0.0, time));
          q.y = snoise(st + vec2(1.0, time));

          vec2 r = vec2(0.);
          r.x = snoise(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * time);
          r.y = snoise(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time);
          r += interact * 0.2;

          float f = snoise(st + r);

          // COLORS - EDIT THESE FOR BRANDING
          vec3 color1 = vec3(0.1, 0.05, 0.2); // Dark Purple
          vec3 color2 = vec3(0.1, 0.6, 0.9);  // Cyan
          vec3 color3 = vec3(0.8, 0.2, 0.6);  // Magenta Highlight

          vec3 color = mix(color1, color2, clamp((f*f)*4.0, 0.0, 1.0));
          color = mix(color, color3, clamp(length(q), 0.0, 1.0));
          color = mix(color, vec3(1.0), interact * 0.1);

          gl_FragColor = vec4(color, 1.0);
      }
    `;

    // --- COMPILE SHADERS ---
    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile failed', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link failed', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // --- SET GEOMETRY ---
    const positionLocation = gl.getAttribLocation(program, "position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
      -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // --- UNIFORMS & EVENTS ---
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    let mouseX = 0;
    let mouseY = 0;
    let animationId: number;

    const handleMouseMove = (e: MouseEvent) => {
        mouseX = e.clientX;
        mouseY = window.innerHeight - e.clientY;
    };

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing

    // --- RENDER LOOP ---
    const render = (time: number) => {
        time *= 0.001; // seconds
        gl.uniform1f(uTime, time);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    // --- CLEANUP ---
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="fluid-container">
        <canvas ref={canvasRef} className="webgl-canvas" />
        
        <div className="grain"></div>
        
        <div className="overlay">
            <div className="top-bar">
                <span className="tune-in">● &nbsp; Tune In</span>
            </div>

            <div className="center-content">
                <h1 className="hero-text">Coming Soon</h1>
                <p className="sub-text">Something is taking shape.</p>
            </div>

            {/* Spacer for Flex Balance */}
            <div></div>
        </div>
    </div>
  );
};

export default FluidLanding;