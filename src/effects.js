import * as THREE from 'three';
import { shared } from './materials.js';

const NOFOG = { fog: false };

export class Bubbles {
  constructor(scene, count = 420) {
    this.n = count; this.i = 0;
    this.p = new Float32Array(count * 3); this.v = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(99); this.life = new Float32Array(count).fill(1);
    this.size = new Float32Array(count); this.alpha = new Float32Array(count); this.base = new Float32Array(count); this.ph = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uScale = { value: 800 };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
        void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(aSize*uScale/max(-mv.z,0.1),1.5,90.); }`,
      fragmentShader: `varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float r=length(c)*2.; if(r>1.) discard;
          float ring=smoothstep(.55,.95,r)*(1.-smoothstep(.95,1.,r));
          float hl=smoothstep(.3,0.,length(c-vec2(-.17,-.17)))*.9;
          float a=(ring*.55+.07+hl)*vA; gl_FragColor=vec4(vec3(.8,.95,1.),a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
    this.carry = 0; this.g = g;
  }
  emit(origin, shipVel, back, strength) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    const j = i * 3, r = Math.random;
    this.p[j] = origin.x + (r() - 0.5) * 0.18; this.p[j + 1] = origin.y + (r() - 0.5) * 0.18; this.p[j + 2] = origin.z + (r() - 0.5) * 0.18;
    const k = 0.5 + strength * 0.5;
    this.v[j] = shipVel.x * 0.35 + back.x * k * 1.2 + (r() - 0.5) * 0.5;
    this.v[j + 1] = shipVel.y * 0.35 + back.y * k * 1.2 + (r() - 0.5) * 0.5;
    this.v[j + 2] = shipVel.z * 0.35 + back.z * k * 1.2 + (r() - 0.5) * 0.5;
    this.age[i] = 0; this.life[i] = 2.2 + r() * 2.6; this.base[i] = 0.025 + r() * r() * 0.09; this.ph[i] = r() * 6.28;
  }
  update(dt, t, origin, sub) {
    // emission scales with propeller speed
    const w = Math.abs(sub.omega);
    this.carry += dt * (w > 1.2 ? w * 2.3 : 0);
    const back = _b.set(-sub.fwd.x, -sub.fwd.y, -sub.fwd.z).multiplyScalar(Math.sign(sub.omega) || 1);
    while (this.carry >= 1) { this.carry -= 1; this.emit(origin, sub.vel, back, Math.min(1, w / 30)); }
    const drag = Math.exp(-dt * 1.4);
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      const a = this.age[i] / this.life[i], j = i * 3;
      if (a >= 1) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.v[j] *= drag; this.v[j + 2] *= drag;
      this.v[j + 1] = this.v[j + 1] * drag + (0.9 + this.base[i] * 4) * (1 - drag);
      this.p[j] += (this.v[j] + Math.sin(t * 3 + this.ph[i]) * 0.12) * dt;
      this.p[j + 1] += this.v[j + 1] * dt;
      this.p[j + 2] += (this.v[j + 2] + Math.cos(t * 2.6 + this.ph[i]) * 0.12) * dt;
      this.size[i] = this.base[i] * (0.6 + a * 0.9);
      this.alpha[i] = Math.min(1, a * 12) * (1 - a * a);
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aSize.needsUpdate = true; this.g.attributes.aAlpha.needsUpdate = true;
  }
}
const _b = new THREE.Vector3();

/** Floating particulate in a wrapped box around the camera: gives parallax / speed sense. */
export class Snow {
  constructor(scene, count = 700, box = 56) {
    const pos = new Float32Array(count * 3), sz = new Float32Array(count);
    for (let i = 0; i < count; i++) { pos[i * 3] = Math.random() * box; pos[i * 3 + 1] = Math.random() * box; pos[i * 3 + 2] = Math.random() * box; sz[i] = 0.5 + Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.u = { uCam: { value: new THREE.Vector3() }, uTime: shared.uTime, uBox: { value: box }, uScale: { value: 800 }, uBright: { value: 1 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSize; uniform vec3 uCam; uniform float uTime, uBox, uScale; varying float vA;
        void main(){ vec3 p=position+vec3(sin(uTime*.1+position.y),-uTime*.06,cos(uTime*.08+position.x))*1.0;
          vec3 q=mod(p-uCam+uBox*.5,uBox)-uBox*.5; vec3 w=q+uCam; vec4 mv=viewMatrix*vec4(w,1.);
          gl_Position=projectionMatrix*mv; float d=length(q); vA=(1.-smoothstep(uBox*.25,uBox*.5,d))*smoothstep(.5,3.,d);
          gl_PointSize=clamp(0.045*aSize*uScale/max(-mv.z,.1),1.,6.); }`,
      fragmentShader: `uniform float uBright; varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float a=(1.-smoothstep(.2,.5,length(c)))*vA*.5*uBright; gl_FragColor=vec4(.75,.9,.95,a);
        #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
}

/** Sun shafts: wrapped billboard ribbons hanging from the surface. */
export class Shafts {
  constructor(scene, count = 16) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .5, 1, 0, -.5, 0, 0, .5, 1, 0, -.5, 1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    const base = new Float32Array(count * 3), ph = new Float32Array(count);
    for (let i = 0; i < count; i++) { base[i * 3] = Math.random() * 300; base[i * 3 + 1] = Math.random() * 300; base[i * 3 + 2] = 5 + Math.random() * 14; ph[i] = Math.random(); }
    geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    geo.instanceCount = count;
    this.u = { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uInt: { value: 0.2 }, uSun: { value: new THREE.Vector3(0.22, -1, 0.12).normalize() } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute vec3 aBase; attribute float aPh; uniform vec3 uCam; uniform vec3 uSun; varying vec2 vUv; varying float vPh; varying float vD;
        void main(){ vec2 b=mod(aBase.xy-uCam.xz+150.,300.)-150.+uCam.xz;
          vec3 top=vec3(b.x,3.,b.y); vec3 bot=top+uSun*110.; vec3 pt=mix(top,bot,position.y);
          vec3 axis=bot-top; vec3 vd=normalize(uCam-pt); vec3 side=normalize(cross(axis,vd));
          vec3 w=pt+side*position.x*aBase.z; vUv=uv; vPh=aPh; vD=length(uCam-w);
          gl_Position=projectionMatrix*viewMatrix*vec4(w,1.); }`,
      fragmentShader: `uniform float uTime, uInt; varying vec2 vUv; varying float vPh; varying float vD;
        void main(){ float ac=1.-abs(vUv.x*2.-1.); ac=pow(ac,1.6); float al=pow(1.-vUv.y,1.3);
          float fl=.65+.35*sin(vUv.y*7.+uTime*.6+vPh*20.)*sin(uTime*.31+vPh*9.+vUv.x*3.);
          float a=ac*al*fl*uInt*smoothstep(170.,50.,vD)*smoothstep(1.,9.,vD);
          gl_FragColor=vec4(vec3(.55,.9,1.)*a,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
  }
}

/** The shimmering ceiling, seen from below. */
export class Surface {
  constructor(scene) {
    const g = new THREE.PlaneGeometry(900, 900); g.rotateX(-Math.PI / 2);
    this.u = { uTime: shared.uTime, uFog: { value: new THREE.Color() }, uDensity: { value: 0.013 }, uLight: { value: new THREE.Color(0.35, 0.8, 0.95) } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime, uDensity; uniform vec3 uFog, uLight; varying vec3 vW;
        void main(){ float d=length(vW-cameraPosition); vec2 p=vW.xz*.1;
          float w=sin(p.x*3.+uTime*.8)+sin(p.y*2.3-uTime*.6)+sin((p.x+p.y)*4.1+uTime*1.1)+sin(p.x*7.-p.y*5.+uTime*1.5)*.5;
          float glint=smoothstep(1.6,3.,w);
          vec3 c=uLight*(.8+.12*w)+glint*vec3(.5,.7,.7);
          c*=exp(-max(-cameraPosition.y,0.)*.018);
          float f=1.-exp(-pow(d*uDensity,2.)); c=mix(c,uFog,f);
          gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
}
