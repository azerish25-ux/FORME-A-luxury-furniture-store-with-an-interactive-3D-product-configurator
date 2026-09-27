/** Loaded only after an explicit request to explore Arc in 3D. */
import {
  ACESFilmicToneMapping, Box3, BufferGeometry, Color, DataTexture, DirectionalLight,
  Group, HemisphereLight, Line, LineDashedMaterial, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, RepeatWrapping, RGBAFormat, Scene, SRGBColorSpace,
  Vector3, WebGLRenderer, LinearFilter,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function textile(kind) {
  const size = 256;
  const height = new Float32Array(size * size);
  const colour = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 7183;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin(x * Math.PI / 2.8);
      const weft = Math.sin(y * Math.PI / 3.1 + Math.sin(x / 8) * .22);
      const loop = Math.sin(x / 2.7 + Math.sin(y / 4)) * Math.cos(y / 2.2 + Math.sin(x / 6));
      height[y * size + x] = kind === 'Bouclé'
        ? .5 + loop * .27 + random() * .14
        : kind === 'Wool'
          ? .45 + random() * .3 + (warp + weft) * .04
          : .5 + (warp * weft) * .22 + random() * .12;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = height[i];
      const dx = height[y * size + ((x + 1) % size)] - height[y * size + ((x + size - 1) % size)];
      const dy = height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x];
      const gray = Math.round(204 + v * 48);
      colour.set([gray, gray, gray, 255], i * 4);
      normal.set([Math.round(128 - dx * 85), Math.round(128 - dy * 85), 246, 255], i * 4);
      const r = Math.round(205 + v * 40);
      roughness.set([r, r, r, 255], i * 4);
    }
  }
  const texture = (bytes, isColour = false) => {
    const map = new DataTexture(bytes, size, size, RGBAFormat);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(13, 13);
    map.magFilter = map.minFilter = LinearFilter;
    map.anisotropy = 4;
    if (isColour) map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  };
  return { map: texture(colour, true), normalMap: texture(normal), roughnessMap: texture(roughness) };
}

function disposeObject(object, disposeMaterials = true) {
  object.traverse(child => {
    child.geometry?.dispose();
    if (disposeMaterials && child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
    }
  });
}

export async function createConfigurator(host, config) {
  const status = host.querySelector('[data-viewer-status]');
  const labelHost = host.querySelector('[data-dimension-labels]');
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Arc sofa in three dimensions');
  host.prepend(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#e6e2d9');
  const environmentScene = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .06);
  scene.environment = environment.texture;
  scene.environmentIntensity = .7;
  environmentScene.dispose();
  pmrem.dispose();

  const camera = new PerspectiveCamera(33, 1, .05, 60);
  camera.position.set(3.8, 2.2, 4.7);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .42, 0);
  controls.enableDamping = false; // On-demand rendering avoids an idle animation loop.
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 8;
  controls.minPolarAngle = .25;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.rotateSpeed = .6;
  controls.zoomSpeed = .65;

  const sky = new HemisphereLight('#fff7e9', '#a39883', 1.6);
  scene.add(sky);
  const key = new DirectionalLight('#fff4df', 3.0);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = .1;
  key.shadow.camera.far = 16;
  key.shadow.bias = -.0002;
  key.shadow.normalBias = .015;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new DirectionalLight('#e2eaf2', .7);
  fill.position.set(4, 3, -2);
  scene.add(fill);

  const floor = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: '#e6e2d9', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.007;
  floor.receiveShadow = true;
  scene.add(floor);

  const textileSets = new Map();
  const fabricMaterial = new MeshPhysicalMaterial({ color: '#c3b7a5', roughness: .91, sheen: .7, sheenRoughness: .85, sheenColor: new Color('#cfc4b1') });
  fabricMaterial.normalScale.set(.26, .26);
  const pipingMaterial = new MeshPhysicalMaterial({ color: '#b8ab96', roughness: .9, sheen: .4 });
  let model = null;
  let modelSize = null;
  let selected = null;
  let revision = 0;
  let disposed = false;
  let visible = true;
  let dimensionsVisible = false;
  let frame = 0;
  let dimensionGroup = new Group();
  const dimensionLabels = [];
  const cache = new Map();
  const loader = new GLTFLoader();
  const scratch = new Vector3();

  function projectLabels() {
    if (!dimensionsVisible) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    dimensionLabels.forEach(({ position, element }) => {
      scratch.copy(position).project(camera);
      element.style.left = `${(scratch.x * .5 + .5) * width}px`;
      element.style.top = `${(-scratch.y * .5 + .5) * height}px`;
      element.hidden = scratch.z > 1;
    });
  }

  function draw() {
    frame = 0;
    if (disposed || !visible || !host.clientWidth || !host.clientHeight || document.hidden) return;
    renderer.render(scene, camera);
    projectLabels();
  }

  function invalidate() {
    if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function resize() {
    if (!host.clientWidth || !host.clientHeight || disposed) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    invalidate();
  }

  function measure(dimensions) {
    scene.remove(dimensionGroup);
    disposeObject(dimensionGroup);
    dimensionGroup = new Group();
    dimensionGroup.visible = dimensionsVisible;
    dimensionLabels.splice(0);
    labelHost.replaceChildren();
    const [w, d, ht] = dimensions.map(value => value / 100);
    const material = new LineDashedMaterial({ color: '#6e6b5e', dashSize: .035, gapSize: .025, transparent: true, opacity: .8 });
    const line = (a, b) => {
      const mesh = new Line(new BufferGeometry().setFromPoints([new Vector3(...a), new Vector3(...b)]), material.clone());
      mesh.computeLineDistances();
      dimensionGroup.add(mesh);
    };
    const label = (text, position) => {
      const element = document.createElement('span');
      element.textContent = text;
      labelHost.append(element);
      dimensionLabels.push({ position: new Vector3(...position), element });
    };
    const bounds = new Box3().setFromObject(model);
    const front = bounds.max.z + .18;
    const back = bounds.min.z;
    const depthMiddle = (bounds.min.z + bounds.max.z) / 2;
    line([-w / 2, .04, front], [w / 2, .04, front]);
    line([-w / 2, 0, front - .08], [-w / 2, .12, front + .08]);
    line([w / 2, 0, front - .08], [w / 2, .12, front + .08]);
    label(`${dimensions[0]} cm`, [0, .09, front + .03]);
    line([-w / 2 - .19, .04, back], [-w / 2 - .19, .04, bounds.max.z]);
    label(`${dimensions[1]} cm`, [-w / 2 - .23, .08, depthMiddle]);
    line([w / 2 + .15, .02, -.26], [w / 2 + .15, ht, -.26]);
    label(`${dimensions[2]} cm`, [w / 2 + .22, ht / 2, -.26]);
    material.dispose();
    scene.add(dimensionGroup);
  }

  function paint() {
    if (!selected) return;
    const kind = ['Linen', 'Bouclé', 'Wool'].includes(selected.fabric) ? selected.fabric : 'Linen';
    if (!textileSets.has(kind)) textileSets.set(kind, textile(kind));
    const maps = textileSets.get(kind);
    fabricMaterial.map = maps.map;
    fabricMaterial.normalMap = maps.normalMap;
    fabricMaterial.roughnessMap = maps.roughnessMap;
    fabricMaterial.normalScale.setScalar(kind === 'Bouclé' ? .62 : kind === 'Wool' ? .22 : .32);
    fabricMaterial.sheen = kind === 'Wool' ? .9 : .6;
    fabricMaterial.color.set(config.colours[selected.colour] || config.colours.Oat);
    fabricMaterial.sheenColor.copy(fabricMaterial.color).lerp(new Color('#ffffff'), .25);
    fabricMaterial.needsUpdate = true;
    pipingMaterial.color.copy(fabricMaterial.color).multiplyScalar(.88);
    invalidate();
  }

  async function update(selection) {
    if (disposed) return;
    selected = selection;
    paint();
    const size = config.models[selection.size] ? selection.size : 'Compact';
    // Every selection invalidates an older request, even when returning to the displayed size.
    const currentRevision = ++revision;
    if (modelSize === size) { status.hidden = true; return; }
    status.textContent = 'Preparing your sofa…';
    status.hidden = false;
    try {
      if (!cache.has(size)) {
        const promise = loader.loadAsync(config.models[size]);
        cache.set(size, promise);
        promise.catch(() => cache.delete(size));
      }
      const gltf = await cache.get(size);
      if (disposed || currentRevision !== revision) return;
      if (model) scene.remove(model);
      model = gltf.scene;
      model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const name = child.material?.name || '';
        if (/upholstery/i.test(name)) child.material = fabricMaterial;
        else if (/piping/i.test(name)) child.material = pipingMaterial;
        else if (/walnut/i.test(name)) { child.material.roughness = .5; child.material.color.set('#68513b'); }
      });
      scene.add(model);
      modelSize = size;
      // Correct only placement, never stretch a size model to fake a different configuration.
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model);
      model.position.y -= bounds.min.y;
      measure(config.dimensions[size]);
      paint();
      status.hidden = true;
      resize();
      host.dataset.model = size;
      host.dataset.ready = 'true';
    } catch (error) {
      if (currentRevision === revision) {
        status.textContent = 'This model could not load. Choose Gallery to keep exploring, then try 3D again.';
        status.hidden = false;
      }
      if (!disposed && currentRevision === revision) throw error;
    }
  }

  const keyboard = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') offset.applyAxisAngle(new Vector3(0, 1, 0), event.key === 'ArrowLeft' ? .13 : -.13);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') offset.y = Math.max(.25, Math.min(4, offset.y + (event.key === 'ArrowUp' ? .2 : -.2)));
    if (event.key === '+' || event.key === '=') offset.multiplyScalar(.93);
    if (event.key === '-') offset.multiplyScalar(1.07);
    offset.clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    invalidate();
  };
  const contextLost = event => {
    event.preventDefault();
    status.textContent = 'The 3D connection was interrupted. The gallery and purchase options are still available.';
    status.hidden = false;
  };
  const contextRestored = () => { status.hidden = false; status.textContent = 'Restoring your sofa…'; resize(); status.hidden = true; };
  const onVisibility = () => { if (!document.hidden) invalidate(); };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener('change', invalidate);
  host.addEventListener('keydown', keyboard);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', onVisibility);
  controls.update();
  resize();

  return {
    update,
    setVisible(value) { visible = value; if (visible) resize(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } },
    setDimensions(value) { dimensionsVisible = value; dimensionGroup.visible = value; labelHost.hidden = !value; invalidate(); },
    reset() { camera.position.set(3.8, 2.2, 4.7); controls.target.set(0, .42, 0); controls.update(); invalidate(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      revision++;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      host.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      cache.forEach(promise => promise.then(gltf => disposeObject(gltf.scene)).catch(() => {}));
      textileSets.forEach(maps => Object.values(maps).forEach(map => map.dispose()));
      fabricMaterial.dispose();
      pipingMaterial.dispose();
      disposeObject(floor);
      disposeObject(dimensionGroup);
      key.shadow.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelHost.replaceChildren();
      delete host.dataset.ready;
    },
  };
}
