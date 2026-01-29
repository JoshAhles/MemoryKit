// Three.js brain scene with MRI scan reveal effect
// Particles revealed slice-by-slice like a brain scan

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/OBJLoader.js";

/** Merge multiple BufferGeometries into one. */
function mergeBufferGeometries(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    if (!pos) continue;
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return merged;
}

/** Take every step-th vertex for a lighter points cloud. */
function decimateForPoints(geometry, step) {
  const pos = geometry.attributes.position;
  if (!pos) return null;
  const count = pos.count;
  const outPos = [];
  for (let i = 0; i < count; i += step) {
    outPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  const decimated = new THREE.BufferGeometry();
  decimated.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
  return decimated;
}

// Custom shader for scan reveal effect (bottom to top, reveal behind scan)
const scanVertexShader = `
  uniform float uScanY;
  uniform float uScanWidth;
  varying float vVisible;
  varying float vScanGlow;
  
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 2.2 * (300.0 / -mvPosition.z);
    
    // Particles visible BELOW the scan line (revealed after scan passes)
    vVisible = step(position.y, uScanY);
    
    // Glow near the scan line
    float distToScan = abs(position.y - uScanY);
    vScanGlow = smoothstep(uScanWidth, 0.0, distToScan);
  }
`;

const scanFragmentShader = `
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

export function initBrainScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x020617, 400, 1500);

  const w = Math.max(canvas.clientWidth || 1, 1);
  const h = Math.max(canvas.clientHeight || 1, 1);
  const camera = new THREE.PerspectiveCamera(54, w / h, 1, 2000);
  camera.position.set(0, 0, 380);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.autoRotate = false; // Disable during scan
  controls.autoRotateSpeed = 0.3;
  controls.minDistance = 200;
  controls.maxDistance = 700;
  controls.minPolarAngle = Math.PI / 3;
  controls.maxPolarAngle = (2 * Math.PI) / 3;

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

  // Flashing nodes
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

  // State for scan animation (bottom to top)
  let scanState = {
    phase: "scanning", // "scanning", "complete"
    scanY: -120, // Start below the brain
    scanSpeed: 80, // units per second
    maxY: 120, // End above the brain
    startTime: performance.now(),
  };

  // Store refs for materials
  let brainPointsMaterial = null;

  const objLoader = new OBJLoader();
  objLoader.load(
    "third_party/3dbrain/static/models/BrainUVs.obj",
    (obj) => {
      const geometries = [];
      obj.traverse((child) => {
        if (child.isMesh && child.geometry) {
          geometries.push(child.geometry);
        }
      });
      if (geometries.length === 0) return;

      const mergedGeo = mergeBufferGeometries(geometries);
      if (!mergedGeo) return;

      mergedGeo.computeVertexNormals();
      mergedGeo.computeBoundingBox();
      
      // Get brain bounds for scan animation (bottom to top)
      const bbox = mergedGeo.boundingBox;
      scanState.scanY = bbox.min.y - 10; // Start below
      scanState.maxY = bbox.max.y + 10; // End above

      // Particle layer with custom scan shader
      const PARTICLE_STEP = 8;
      const particleGeo = decimateForPoints(mergedGeo, PARTICLE_STEP);
      
      brainPointsMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uScanY: { value: scanState.scanY },
          uScanWidth: { value: 15.0 },
          uColor: { value: new THREE.Color(0xdde3e9) },
          uScanColor: { value: new THREE.Color(0x38bdf8) },
          uOpacity: { value: 0.85 },
        },
        vertexShader: scanVertexShader,
        fragmentShader: scanFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      
      const brainPoints = new THREE.Points(particleGeo, brainPointsMaterial);
      brainPoints.frustumCulled = false;
      brainGroup.add(brainPoints);

      // X-ray shell (hidden during scan, fades in after)
      const xRayMat = new THREE.MeshBasicMaterial({
        color: 0x84ccff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const xRayGeo = mergedGeo.clone();
      const xRayMesh = new THREE.Mesh(xRayGeo, xRayMat);
      xRayMesh.scale.setScalar(1.03);
      brainGroup.add(xRayMesh);
      
      // Store reference for later
      scene.userData.xRayMat = xRayMat;

      brainGroup.rotation.y = Math.PI / 2;
    },
    undefined,
    () => {
      // OBJ load error - show simple fallback
      const geo = new THREE.IcosahedronGeometry(80, 3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x020617,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.35,
      });
      const mesh = new THREE.Mesh(geo, mat);
      brainGroup.add(mesh);
      brainGroup.rotation.y = Math.PI / 2;
      scanState.phase = "complete";
    }
  );

  function resizeRendererToDisplaySize() {
    const width = Math.max(canvas.clientWidth || 0, 1);
    const height = Math.max(canvas.clientHeight || 0, 1);
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

  function render(now) {
    now = now || performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    resizeRendererToDisplaySize();
    controls.update();

    const t = now / 1000;

    // Scan animation (bottom to top)
    if (scanState.phase === "scanning") {
      scanState.scanY += scanState.scanSpeed * dt; // Moving upward
      
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
        
        // Fade in x-ray shell
        if (scene.userData.xRayMat) {
          scene.userData.xRayMat.opacity = 0.1;
        }
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
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
