// Three.js brain scene with MRI scan reveal effect.
// Placeholder shows immediately; real OBJ is parsed in a Web Worker to avoid blocking the main thread.

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const DEBUG = /[?&]debug=1/.test(location.search);

const SCAN_SPEED = 80;
const SCAN_WIDTH = 15;
const LOADING_ROTATION_SPEED = 0.07; // rad/s continuous gentle spin
const PARTICLE_STEP = 8;
const PLACEHOLDER_RADIUS = 70;
const PLACEHOLDER_DETAIL = 2;
const PLACEHOLDER_DECIMATE = 2;
const POINT_SIZE_BASE = 2.2;
const POINT_SIZE_REF_DIST = 300;

/** Take every step-th vertex for a lighter points cloud; copies normals when present. */
function decimateForPoints(geometry, step) {
  const pos = geometry.attributes.position;
  if (!pos) return null;
  const norm = geometry.attributes.normal;
  const count = pos.count;
  const outPos = [];
  const outNorm = norm ? [] : null;
  for (let i = 0; i < count; i += step) {
    outPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (norm) outNorm.push(norm.getX(i), norm.getY(i), norm.getZ(i));
  }
  const decimated = new THREE.BufferGeometry();
  decimated.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
  if (outNorm) decimated.setAttribute("normal", new THREE.Float32BufferAttribute(outNorm, 3));
  return decimated;
}

// Custom shader for scan reveal effect (bottom to top, reveal behind scan)
// Explicit highp helps Cursor/Electron WebGL match Chrome (avoids mediump blur/size quirks)
const scanVertexShader = `
  precision highp float;
  uniform float uScanY;
  uniform float uScanWidth;
  varying float vVisible;
  varying float vScanGlow;
  
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 2.2 * (300.0 / -mvPosition.z); /* POINT_SIZE_BASE * (REF_DIST / depth) */
    
    // Particles visible BELOW the scan line (revealed after scan passes)
    vVisible = step(position.y, uScanY);
    
    // Glow near the scan line
    float distToScan = abs(position.y - uScanY);
    vScanGlow = smoothstep(uScanWidth, 0.0, distToScan);
  }
`;

const scanFragmentShader = `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uScanColor;
  uniform float uOpacity;
  varying float vVisible;
  varying float vScanGlow;
  
  void main() {
    if (vVisible < 0.5) discard;
    
    // Circular point shape
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.2, dist);
    
    // Mix base color with scan glow color
    vec3 color = mix(uColor, uScanColor, vScanGlow * 0.8);
    float finalAlpha = alpha * uOpacity * (1.0 + vScanGlow * 2.0);
    
    gl_FragColor = vec4(color, finalAlpha);
  }
`;

// Brain region coordinates for thinking pathways
const BRAIN_REGIONS = [
  { name: "episodic", pos: [92, 45, 0] },
  { name: "semantic_r", pos: [20, -30, 65] },
  { name: "analytic", pos: [-80, 20, 0] },
  { name: "process", pos: [-50, 75, 0] },
  { name: "affective", pos: [-100, -30, 0] },
  { name: "semantic_l", pos: [20, -30, -65] },
];

// Create curved path between two points
function createCurvedPath(start, end, segments = 20) {
  const points = [];
  const midPoint = new THREE.Vector3(
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2 + 30,
    (start[2] + end[2]) / 2
  );
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * midPoint.x + t * t * end[0];
    const y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * midPoint.y + t * t * end[1];
    const z = (1 - t) * (1 - t) * start[2] + 2 * (1 - t) * t * midPoint.z + t * t * end[2];
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

function logPerf(label, startMs) {
  if (!DEBUG) return;
  const elapsed = (performance.now() - startMs).toFixed(1);
  console.log(`[brain] ⏱ ${label}: ${elapsed}ms`);
}

export function initBrainScene(canvas) {
  const t0 = performance.now();
  if (DEBUG) console.log("[brain] initBrainScene() start", document.activeElement?.id || document.activeElement?.tagName);

  let t = performance.now();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  canvas.style.pointerEvents = "none"; // keep page clickable; brain is visual only
  logPerf("renderer create", t);

  t = performance.now();
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x020617, 400, 1500);
  const container = canvas.parentElement;
  const w = Math.max(canvas.clientWidth || container?.clientWidth || 1, 1);
  const h = Math.max(canvas.clientHeight || container?.clientHeight || 1, 1);
  const camera = new THREE.PerspectiveCamera(54, w / h, 1, 2000);
  camera.position.set(0, 0, 380);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.3;
  controls.minDistance = 200;
  controls.maxDistance = 700;
  controls.minPolarAngle = Math.PI / 3;
  controls.maxPolarAngle = (2 * Math.PI) / 3;
  controls.keys = {};
  logPerf("scene/camera/controls", t);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xb8c5cf, 0.3);
  scene.add(ambientLight);

  const spotLight = new THREE.SpotLight(0xb8c5cf, 1.45, 500, Math.PI / 2, 0, 0);
  spotLight.position.set(0, 500, -10);
  scene.add(spotLight);

  const brainGroup = new THREE.Group();
  scene.add(brainGroup);

  // Scan line (invisible - just tracks position for shader)
  const scanLine = { position: { y: 0 }, visible: false };

  // Thinking pathways group (hidden until scan complete)
  const pathwaysGroup = new THREE.Group();
  pathwaysGroup.visible = false;
  brainGroup.add(pathwaysGroup);

  // Create thinking pathway lines
  t = performance.now();
  const pathways = [];
  const pathwayConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [0, 3], [1, 4], [2, 5],
  ];

  pathwayConnections.forEach((conn, idx) => {
    const start = BRAIN_REGIONS[conn[0]].pos;
    const end = BRAIN_REGIONS[conn[1]].pos;
    const curvePoints = createCurvedPath(start, end, 30);
    
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const material = new THREE.LineBasicMaterial({
      color: 0x84ccff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    
    const line = new THREE.Line(geometry, material);
    pathwaysGroup.add(line);
    pathways.push({
      line,
      delay: idx * 0.4,
      duration: 1.5,
    });
  });
  logPerf("pathways loop", t);

  // Flashing nodes
  t = performance.now();
  const nodeGeometry = new THREE.BufferGeometry();
  const nodePositions = new Float32Array(BRAIN_REGIONS.length * 3);
  BRAIN_REGIONS.forEach((region, i) => {
    nodePositions[i * 3] = region.pos[0];
    nodePositions[i * 3 + 1] = region.pos[1];
    nodePositions[i * 3 + 2] = region.pos[2];
  });
  nodeGeometry.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
  
  const nodeMaterial = new THREE.PointsMaterial({
    size: 8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    color: 0x84ccff,
    sizeAttenuation: true,
  });
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  pathwaysGroup.add(nodes);
  logPerf("nodes", t);
  logPerf("initBrainScene sync total", t0);

  // State for scan animation (bottom to top)
  let scanState = {
    phase: "scanning",
    scanY: -120,
    scanSpeed: SCAN_SPEED,
    maxY: 120,
    startTime: performance.now(),
  };

  // Store refs for materials (used by render loop for uScanY)
  let brainPointsMaterial = null;

  // --- Placeholder: show a brain-like shape and start render loop immediately ---
  const placeholderGeo = new THREE.IcosahedronGeometry(PLACEHOLDER_RADIUS, PLACEHOLDER_DETAIL);
  const placeholderPointsGeo = decimateForPoints(placeholderGeo, PLACEHOLDER_DECIMATE);
  placeholderGeo.dispose();
  brainPointsMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uScanY: { value: scanState.scanY },
      uScanWidth: { value: SCAN_WIDTH },
      uColor: { value: new THREE.Color(0xe2e8ef) },
      uScanColor: { value: new THREE.Color(0x38bdf8) },
      uOpacity: { value: 0.9 },
    },
    vertexShader: scanVertexShader,
    fragmentShader: scanFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const placeholderPoints = new THREE.Points(placeholderPointsGeo, brainPointsMaterial);
  placeholderPoints.frustumCulled = false;
  brainGroup.add(placeholderPoints);
  brainGroup.rotation.y = Math.PI / 2;
  scene.userData.placeholderBrain = placeholderPoints;
  if (DEBUG) console.log("[brain] placeholder visible, render loop starting", `${(performance.now() - t0).toFixed(0)}ms`);
  requestAnimationFrame(render);

  // --- Load real brain in worker (non-blocking) ---
  const OBJ_URL = "third_party/models/BrainUVs.obj";
  fetch(OBJ_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`OBJ fetch ${res.status}`);
      return res.text();
    })
    .then((text) => {
      const tFetched = performance.now();
      if (DEBUG) console.log("[brain] OBJ fetched, parsing in worker", `${(tFetched - t0).toFixed(0)}ms`);
      const worker = new Worker(new URL("./objParser.worker.js", import.meta.url));
      worker.onmessage = (e) => {
        const { error, positions, normals } = e.data;
        worker.terminate();
        if (error || !positions || !normals) {
          console.warn("[brain] worker error or empty result", error);
          return;
        }
        const tBuild = performance.now();
        const mergedGeo = new THREE.BufferGeometry();
        mergedGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        mergedGeo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        mergedGeo.computeVertexNormals();
        mergedGeo.computeBoundingBox();
        const bbox = mergedGeo.boundingBox;
        scanState.scanY = bbox.min.y - 10;
        scanState.maxY = bbox.max.y + 10;
        const particleGeo = decimateForPoints(mergedGeo, PARTICLE_STEP);
        brainPointsMaterial.uniforms.uScanY.value = scanState.scanY;
        const brainPoints = new THREE.Points(particleGeo, brainPointsMaterial);
        brainPoints.frustumCulled = false;
        brainGroup.remove(placeholderPoints);
        placeholderPointsGeo.dispose();
        brainGroup.add(brainPoints);
        mergedGeo.dispose();
        if (DEBUG) console.log("[brain] real brain visible", `${(performance.now() - t0).toFixed(0)}ms`, `build: ${(performance.now() - tBuild).toFixed(0)}ms`);
      };
      worker.onerror = () => {
        worker.terminate();
        if (DEBUG) console.warn("[brain] worker error, keeping placeholder");
      };
      worker.postMessage(text);
    })
    .catch((err) => {
      if (DEBUG) console.warn("[brain] OBJ fetch error, keeping placeholder", err);
    });

  function resizeRendererToDisplaySize() {
    const parent = canvas.parentElement;
    const width = Math.max(canvas.clientWidth || parent?.clientWidth || 0, 1);
    const height = Math.max(canvas.clientHeight || parent?.clientHeight || 0, 1);
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  let lastTime = performance.now();
  let cycleTime = 0;
  const cycleDuration = 8;
  let firstRenderLogged = false;
  let frameShown = false;
  let frameCount = 0;
  let lastLogTime = performance.now();

  function render(now) {
    const frameStart = performance.now();
    if (DEBUG && !firstRenderLogged) {
      console.log("[brain] first render frame", `${(frameStart - t0).toFixed(0)}ms`);
      firstRenderLogged = true;
    }
    // Show frame only after first draw to avoid white canvas flash on reload
    if (!frameShown && canvas.parentElement) {
      frameShown = true;
      canvas.parentElement.classList.add("is-ready");
    }
    now = now || frameStart;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    resizeRendererToDisplaySize();
    controls.update();

    const t = now / 1000;

    // Continuous rotation (loading + scan-in)
    brainGroup.rotation.y += LOADING_ROTATION_SPEED * dt;

    // Scan animation (bottom to top)
    if (scanState.phase === "scanning") {
      scanState.scanY += scanState.scanSpeed * dt;
      
      // Update scan line position
      scanLine.position.y = scanState.scanY;
      scanLine.visible = true;
      
      // Update shader uniform
      if (brainPointsMaterial) {
        brainPointsMaterial.uniforms.uScanY.value = scanState.scanY;
      }
      
      // Check if scan is complete (reached the top)
      if (scanState.scanY > scanState.maxY) {
        scanState.phase = "complete";
        scanLine.visible = false;
        controls.autoRotate = true;
        pathwaysGroup.visible = true;
        if (DEBUG) console.log("[brain] scan complete", `${(performance.now() - t0).toFixed(0)}ms`);
      }
    }

    // After scan complete, animate pathways
    if (scanState.phase === "complete") {
      cycleTime = (cycleTime + dt) % cycleDuration;
      
      pathways.forEach((pathway) => {
        const pathTime = (cycleTime - pathway.delay + cycleDuration) % cycleDuration;
        
        if (pathTime < pathway.duration) {
          const progress = pathTime / pathway.duration;
          pathway.line.material.opacity = Math.sin(progress * Math.PI) * 0.7;
        } else if (pathTime < pathway.duration + 0.5) {
          const fadeProgress = (pathTime - pathway.duration) / 0.5;
          pathway.line.material.opacity = 0.7 * (1 - fadeProgress);
        } else {
          pathway.line.material.opacity = 0;
        }
      });

      // Pulse nodes
      const nodePulse = 0.4 + 0.3 * Math.sin(t * 2);
      nodeMaterial.opacity = nodePulse;
      nodeMaterial.size = 6 + 4 * Math.sin(t * 1.5);
    }

    renderer.render(scene, camera);
    frameCount++;
    if (DEBUG) {
      const frameMs = performance.now() - frameStart;
      if (frameMs > 50) console.log("[brain] ⚠️ long frame", frameMs.toFixed(1), "ms");
      if (frameCount > 0 && frameCount % 120 === 0) {
        const elapsed = (performance.now() - lastLogTime) / 1000;
        console.log("[brain] 120 frames in", elapsed.toFixed(2), "s (~", (120 / elapsed).toFixed(1), "fps)");
        lastLogTime = performance.now();
      }
    }
    requestAnimationFrame(render);
  }

  if (DEBUG) console.log("[brain] initBrainScene returned", `${(performance.now() - t0).toFixed(0)}ms`);
}
