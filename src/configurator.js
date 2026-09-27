/** On-demand Arc viewer. Geometry, UV scale and maps share the Blender asset contract. */
import {
  AgXToneMapping, Box3, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight,
  Line, LineDashedMaterial, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RepeatWrapping,
  Scene, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function createConfigurator(host, config) {
  const status = host.querySelector('[data-viewer-status]');
  const labelHost = host.querySelector('[data-dimension-labels]');
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Arc sofa in three dimensions');
  host.prepend(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color('#e8e3da');
  const environmentScene = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .08);
  scene.environment = environment.texture; scene.environmentIntensity = .5;
  environmentScene.dispose(); pmrem.dispose();
  const camera = new PerspectiveCamera(33, 1, .05, 60);
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; // No idle render loop.
  controls.enablePan = false; controls.minDistance = .8; controls.maxDistance = 18;
  controls.minPolarAngle = .25; controls.maxPolarAngle = Math.PI / 2.02;
  controls.rotateSpeed = .55; controls.zoomSpeed = .65;
  scene.add(new HemisphereLight('#fff8ee', '#968b7d', 1.25));
  const key = new DirectionalLight('#fff5e8', 3.2);
  key.position.set(-3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 3, bottom: -3, near: .1, far: 16 });
  key.shadow.bias = -.0001; key.shadow.normalBias = .006; key.shadow.radius = 4;
  scene.add(key);
  const fill = new DirectionalLight('#e5ecf3', .65); fill.position.set(4, 3, -2); scene.add(fill);
  const floor = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: '#e8e3da', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.004; floor.receiveShadow = true; scene.add(floor);
  const fabricMaterial = new MeshPhysicalMaterial({ roughness: 1, sheen: .45, sheenRoughness: .7 });
  fabricMaterial.normalScale.setScalar(.65);
  const pipingMaterial = new MeshPhysicalMaterial({ roughness: .92, sheen: .3 });
  let model = null, modelSize = null, selected = null, revision = 0, frame = 0;
  let disposed = false, visible = true, dimensionsVisible = false, contextInterrupted = false;
  let dimensionGroup = new Group();
  let cameraView = 'angle';
  let lastFit = 0;
  const dimensionLabels = [];
  const cache = new Map();
  const textiles = new Map();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const loader = new GLTFLoader();
  const textureLoader = new TextureLoader();
  const scratch = new Vector3();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function retain(object) {
    object.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      for (const material of child.material ? Array.isArray(child.material) ? child.material : [child.material] : []) {
        materials.add(material);
        Object.values(material).forEach(value => {
          if (!value?.isTexture) return;
          value.anisotropy = anisotropy; textures.add(value);
        });
      }
    });
    if (disposed) releaseAssets();
  }
  function releaseAssets() {
    geometries.forEach(value => value.dispose()); geometries.clear();
    materials.forEach(value => value.dispose()); materials.clear();
    textures.forEach(value => value.dispose()); textures.clear();
  }
  function clearMeasurements() {
    scene.remove(dimensionGroup);
    dimensionGroup.traverse(child => { child.geometry?.dispose(); child.material?.dispose(); });
    dimensionGroup = new Group(); dimensionLabels.length = 0; labelHost.replaceChildren();
  }
  function projectLabels() {
    if (!dimensionsVisible) return;
    dimensionLabels.forEach(({ position, element }) => {
      scratch.copy(position).project(camera);
      const inset = element.offsetWidth / 2 + 8;
      element.style.left = `${Math.max(inset, Math.min(host.clientWidth - inset, (scratch.x * .5 + .5) * host.clientWidth))}px`;
      element.style.top = `${Math.max(24, Math.min(host.clientHeight - 80, (-scratch.y * .5 + .5) * host.clientHeight))}px`;
      element.hidden = scratch.z > 1 || scratch.z < -1;
    });
  }
  function draw() {
    frame = 0;
    if (disposed || contextInterrupted || !visible || !host.clientWidth || !host.clientHeight || document.hidden) return;
    renderer.render(scene, camera); projectLabels();
  }
  function invalidate() {
    if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function fit(direction, preserveZoom = false) {
    if (!model) return;
    const bounds = new Box3().setFromObject(model);
    if (dimensionsVisible) bounds.expandByScalar(.3);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const n = direction.clone().normalize();
    const right = new Vector3(n.z, 0, -n.x).normalize();
    const up = new Vector3().crossVectors(n, right).normalize();
    const tanV = Math.tan(camera.fov * Math.PI / 360);
    const tanH = tanV * camera.aspect;
    let distance = 0;
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
      const corner = new Vector3(size.x * x, size.y * y, size.z * z);
      distance = Math.max(distance, corner.dot(n) + Math.max(Math.abs(corner.dot(right)) / tanH, Math.abs(corner.dot(up)) / tanV));
    }
    distance *= dimensionsVisible ? 1.35 : 1.26;
    const zoom = preserveZoom && lastFit ? camera.position.distanceTo(controls.target) / lastFit : 1;
    lastFit = distance;
    if (cameraView === 'detail') { center.set(bounds.min.x * .32, .56, bounds.max.z * .7); distance *= .55; lastFit = distance; }
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(n, Math.max(controls.minDistance, Math.min(controls.maxDistance, distance * zoom)));
    controls.update(); invalidate();
  }
  function view(name = 'angle') {
    const presets = { angle: [.48, .32, .83], front: [0, .17, 1], side: [1, .22, .04], detail: [.2, .4, 1] };
    if (!presets[name]) return;
    cameraView = name; fit(new Vector3(...presets[name]));
    host.dataset.camera = name;
    host.closest('[data-product-section]')?.querySelectorAll('[data-camera]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.camera === name)));
  }
  function rotate(sign) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new Vector3(0, 1, 0), sign * .22);
    camera.position.copy(controls.target).add(offset); cameraView = 'custom'; controls.update(); invalidate();
  }
  function zoom(sign) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(sign > 0 ? .88 : 1.12);
    offset.clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset); controls.update(); invalidate();
  }
  function resize() {
    if (!host.clientWidth || !host.clientHeight || disposed) return;
    const oldAspect = camera.aspect;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight, false);
    if (model && Math.abs(oldAspect - camera.aspect) > .005) fit(camera.position.clone().sub(controls.target), true);
    invalidate();
  }

  function measure(dimensions) {
    clearMeasurements();
    dimensionGroup.visible = dimensionsVisible;
    const bounds = new Box3().setFromObject(model);
    const [w, d, ht] = dimensions.map(value => value / 100);
    const front = bounds.max.z + .18, back = bounds.min.z;
    const line = (a, b) => {
      const material = new LineDashedMaterial({ color: '#625c4e', dashSize: .035, gapSize: .02 });
      const mesh = new Line(new BufferGeometry().setFromPoints([new Vector3(...a), new Vector3(...b)]), material);
      mesh.computeLineDistances(); dimensionGroup.add(mesh);
    };
    const label = (text, position) => {
      const element = document.createElement('span'); element.textContent = text; labelHost.append(element);
      dimensionLabels.push({ position: new Vector3(...position), element });
    };
    line([-w / 2, .04, front], [w / 2, .04, front]);
    line([-w / 2, 0, front - .08], [-w / 2, .12, front + .08]);
    line([w / 2, 0, front - .08], [w / 2, .12, front + .08]);
    label(`${dimensions[0]} cm`, [0, .08, front + .08]);
    line([-w / 2 - .2, .04, back], [-w / 2 - .2, .04, back + d]);
    label(`${dimensions[1]} cm`, [-w / 2 - .23, .08, back + d / 2]);
    line([w / 2 + .2, 0, back], [w / 2 + .2, ht, back]);
    label(`${dimensions[2]} cm`, [w / 2 + .23, ht / 2, back]);
    scene.add(dimensionGroup);
  }

  function loadModel(size) {
    if (!cache.has(size)) {
      const promise = loader.loadAsync(config.models[size]).then(gltf => {
        retain(gltf.scene);
        if (!textiles.has('Linen')) gltf.scene.traverse(child => {
          const material = child.material;
          if (/upholstery/i.test(material?.name || '') && material.map) textiles.set('Linen', Promise.resolve({ map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap }));
        });
        return gltf;
      });
      cache.set(size, promise); promise.catch(() => cache.delete(size));
    }
    return cache.get(size);
  }
  function loadTextile(kind, gltf) {
    if (kind === 'Linen') {
      let material;
      gltf.scene.traverse(child => { if (/upholstery/i.test(child.material?.name || '')) material = child.material; });
      // A cached scene may already use the shared presentation material. Keep the original maps separately.
      if (!textiles.has('Linen') && material?.map) textiles.set('Linen', Promise.resolve({ map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap }));
      if (textiles.has('Linen')) return textiles.get('Linen');
    }
    if (!textiles.has(kind)) {
      const id = config.fabrics[kind].id;
      const promise = Promise.all(['color', 'normal', 'rough'].map(async channel => {
        const base = new URL(config.assetBase, location.href);
        const url = new URL(`arc-${id}-${channel}.png`, base); url.search = base.search;
        const texture = await textureLoader.loadAsync(url.href);
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.flipY = false; texture.anisotropy = anisotropy;
        if (channel === 'color') texture.colorSpace = SRGBColorSpace;
        textures.add(texture); if (disposed) { texture.dispose(); textures.delete(texture); }
        return texture;
      })).then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));
      textiles.set(kind, promise); promise.catch(() => textiles.delete(kind));
    }
    return textiles.get(kind);
  }

  async function update(selection) {
    if (disposed) return;
    const current = ++revision;
    const { size, fabric, colour } = selection;
    if (!config.models[size] || !config.fabrics[fabric] || !config.colours[colour]) throw new Error('Unsupported Arc configuration.');
    status.textContent = 'Preparing your sofa…'; status.hidden = false;
    try {
      const gltf = await loadModel(size);
      const maps = await loadTextile(fabric, gltf);
      if (disposed || current !== revision) return;
      selected = selection;
      const sizeChanged = modelSize !== size;
      if (sizeChanged) {
        if (model) scene.remove(model);
        model = gltf.scene;
        model.traverse(child => {
          if (!child.isMesh) return;
          child.castShadow = true; child.receiveShadow = true;
          if (/upholstery/i.test(child.material?.name || '')) child.material = fabricMaterial;
          else if (/piping/i.test(child.material?.name || '')) child.material = pipingMaterial;
          // Walnut's authored maps and UV direction survive the export unchanged.
        });
        scene.add(model); modelSize = size;
        model.updateMatrixWorld(true);
        model.position.y -= new Box3().setFromObject(model).min.y;
        measure(config.dimensions[size]);
      }
      Object.assign(fabricMaterial, maps);
      fabricMaterial.name = 'Arc Upholstery | shared physical-scale maps';
      pipingMaterial.name = 'Arc Piping';
      fabricMaterial.color.set(config.colours[colour]);
      fabricMaterial.sheen = config.fabrics[fabric].sheen;
      fabricMaterial.sheenColor.copy(fabricMaterial.color).lerp(new Color('#ffffff'), .2);
      fabricMaterial.needsUpdate = true;
      pipingMaterial.color.copy(fabricMaterial.color).multiplyScalar(.9);
      resize();
      if (sizeChanged) view(['angle','front','side','detail'].includes(cameraView) ? cameraView : 'angle');
      status.hidden = true;
      host.dataset.model = size; host.dataset.fabric = fabric; host.dataset.colour = colour; host.dataset.ready = 'true';
      invalidate();
    } catch (error) {
      if (!disposed && current === revision) { status.textContent = 'This model could not load. Choose Gallery to keep exploring.'; status.hidden = false; throw error; }
    }
  }

  const keyboard = event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') rotate(event.key === 'ArrowLeft' ? -1 : 1);
    else if (['+','-','='].includes(event.key)) zoom(event.key === '-' ? -1 : 1);
    else {
      const offset = camera.position.clone().sub(controls.target);
      offset.y = Math.max(.25, Math.min(4, offset.y + (event.key === 'ArrowUp' ? .2 : -.2)));
      camera.position.copy(controls.target).add(offset); controls.update(); invalidate();
    }
  };
  const contextLost = event => { event.preventDefault(); contextInterrupted = true; status.textContent = 'The 3D connection was interrupted. The gallery and purchase options remain available.'; status.hidden = false; };
  const contextRestored = () => { contextInterrupted = false; status.hidden = true; resize(); invalidate(); };
  const onVisibility = () => { if (!document.hidden) invalidate(); };
  const observer = new ResizeObserver(resize); observer.observe(host);
  controls.addEventListener('change', invalidate);
  host.addEventListener('keydown', keyboard);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', onVisibility);
  controls.update(); resize();
  return {
    update, view, rotate, zoom,
    setVisible(value) { visible = value; if (visible) resize(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } },
    setDimensions(value) { dimensionsVisible = value; dimensionGroup.visible = value; labelHost.hidden = !value; fit(camera.position.clone().sub(controls.target)); invalidate(); },
    reset() { view('angle'); },
    dispose() {
      if (disposed) return;
      disposed = true; revision++; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      host.removeEventListener('keydown', keyboard); document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      releaseAssets(); clearMeasurements(); textiles.clear(); cache.clear();
      fabricMaterial.dispose(); pipingMaterial.dispose(); floor.geometry.dispose(); floor.material.dispose();
      key.shadow.dispose(); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      delete host.dataset.ready;
    },
  };
}
