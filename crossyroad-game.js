import * as THREE from "https://esm.sh/three@0.173.0";
import { OBJLoader } from "https://esm.sh/three@0.173.0/examples/jsm/loaders/OBJLoader.js";

const MODEL_ROOT = "/assets/models";
const vehicleNames = [
  "blue_car",
  "green_car",
  "taxi",
  "purple_car",
  "red_truck",
  "orange_car",
  "blue_truck",
];

function loadModel(modelPath, texturePath) {
  const loader = new OBJLoader();
  const textures = new THREE.TextureLoader();
  return Promise.all([
    loader.loadAsync(`${MODEL_ROOT}/${modelPath}`),
    textures.loadAsync(`${MODEL_ROOT}/${texturePath}`),
  ]).then(([model, texture]) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.map = texture;
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return model;
  });
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function startCrossyRoads(mount, onGameOver) {
  const canvas = mount.querySelector("#hopper-canvas");
  const controls = [...mount.querySelectorAll("[data-hopper-move]")];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c6dd);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(12, 20, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -10;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  camera.position.set(-4, 6.5, -15);
  camera.lookAt(4, -1, 0);

  const [chicken, grass, river, road, ...decor] = await Promise.all([
    loadModel("characters/chicken/0.obj", "characters/chicken/0.png"),
    loadModel("environment/grass/model.obj", "environment/grass/light-grass.png"),
    loadModel("environment/river/0.obj", "environment/river/0.png"),
    loadModel("environment/road/model.obj", "environment/road/stripes-texture.png"),
    ...[0, 1, 2].flatMap((index) => [
      loadModel(`environment/tree/${index}/0.obj`, `environment/tree/${index}/0.png`),
      loadModel(`environment/log/${index}/0.obj`, `environment/log/${index}/0.png`),
    ]),
    ...vehicleNames.map((name) =>
      loadModel(`vehicles/${name}/0.obj`, `vehicles/${name}/0.png`),
    ),
  ]);

  const trees = [decor[0], decor[2], decor[4]];
  const logs = [decor[1], decor[3], decor[5]];
  const vehicles = decor.slice(6);
  const rows = [];
  const woods = [];
  const cars = [];
  const treePositions = [];
  const queue = [];
  const state = {
    x: 0,
    z: 0,
    score: 0,
    moving: false,
    ended: false,
    frame: 0,
  };
  const chickenModel = chicken.clone();
  scene.add(chickenModel);
  chickenModel.position.set(0, 0, 0);

  const isTreeOccupied = (x, z, direction) => {
    const tolerance = 0.3;
    const target = {
      up: { x, z: z + 1 },
      down: { x, z: z - 1 },
      left: { x: x + 1, z },
      right: { x: x - 1, z },
    }[direction] || { x, z };
    return treePositions.some(
      (position) =>
        Math.abs(position.x - target.x) < tolerance &&
        Math.abs(position.z - target.z) < tolerance,
    );
  };

  const onLog = () =>
    woods.some((wood) => {
      const position = new THREE.Vector3();
      wood.getWorldPosition(position);
      return (
        Math.abs(position.z - chickenModel.position.z) < 0.6 &&
        Math.abs(position.x - chickenModel.position.x) < wood.userData.size
      );
    });
  const riverUnderChicken = () =>
    rows.some(
      (row) =>
        row.type === "river" &&
        Math.abs(row.z - chickenModel.position.z) < 0.4,
    ) && !onLog();
  const hitByCar = () =>
    cars.some((car) => {
      const position = new THREE.Vector3();
      car.getWorldPosition(position);
      return (
        Math.abs(position.z - chickenModel.position.z) < 0.5 &&
        Math.abs(position.x - chickenModel.position.x) < 0.65
      );
    });

  function addRow(z) {
    if (rows.some((row) => row.z === z)) return;
    let type = z === 0 ? "grass" : null;
    const previous = rows.find((row) => row.z === z - 1);
    if (!type && previous?.type === "river") {
      type = Math.random() < 0.65 ? "grass" : "river";
    }
    if (!type) {
      const value = Math.random();
      type = value < 0.4 ? "grass" : value < 0.7 ? "river" : "road";
    }
    const row = {
      z,
      type,
      group: (type === "grass" ? grass : type === "river" ? river : road).clone(),
    };
    row.group.position.set(0, -0.4, z);
    scene.add(row.group);
    rows.push(row);

    if (type === "grass") {
      for (let i = 0; i < randomInteger(1, 4); i += 1) {
        const x = randomInteger(-8, 7);
        if (z === 0 && x === 0) continue;
        const tree = trees[randomInteger(0, trees.length - 1)].clone();
        tree.position.set(x, 0.4, z);
        row.group.add(tree);
        treePositions.push({ x, z });
      }
    } else if (type === "river") {
      for (let i = 0; i < randomInteger(1, 3); i += 1) {
        const wood = logs[i % logs.length].clone();
        const x = randomInteger(-7, 7);
        wood.position.set(x, -0.1, z);
        wood.userData.size = 1.5;
        row.group.add(wood);
        woods.push(wood);
      }
    } else {
      for (let i = 0; i < randomInteger(1, 2); i += 1) {
        const car = vehicles[randomInteger(0, vehicles.length - 1)].clone();
        car.position.set(randomInteger(-7, 7), 0, 0);
        car.userData.rowZ = z;
        car.rotation.y = Math.PI / 2;
        row.group.add(car);
        cars.push(car);
      }
    }
  }

  function removeOldRows() {
    rows.filter((row) => row.z < state.z - 10).forEach((row) => {
      scene.remove(row.group);
      rows.splice(rows.indexOf(row), 1);
    });
    woods.splice(0, woods.length, ...woods.filter((wood) => scene.getObjectById(wood.id)));
    cars.splice(0, cars.length, ...cars.filter((car) => scene.getObjectById(car.id)));
  }

  for (let z = 0; z < 24; z += 1) addRow(z);

  function finish(reason) {
    if (state.ended) return;
    state.ended = true;
    cancelAnimationFrame(state.frame);
    onGameOver(state.score, reason);
  }

  function processMove(direction) {
    if (state.ended || state.moving || queue.length > 2) return;
    queue.push(direction);
    if (queue.length === 1) animateMove();
  }

  function animateMove() {
    const direction = queue.shift();
    if (!direction || state.ended) {
      state.moving = false;
      return;
    }
    state.moving = true;
    if (direction === "forward") {
      addRow(state.z + 24);
      if (!isTreeOccupied(state.x, state.z, "up")) state.z += 1;
      chickenModel.rotation.y = 0;
    } else if (direction === "left" && state.x < 4 && !isTreeOccupied(state.x, state.z, "left")) {
      state.x += 1;
      chickenModel.rotation.y = Math.PI / 2;
    } else if (direction === "right" && state.x > -4 && !isTreeOccupied(state.x, state.z, "right")) {
      state.x -= 1;
      chickenModel.rotation.y = -Math.PI / 2;
    }
    const from = chickenModel.position.clone();
    const to = new THREE.Vector3(state.x, 0, state.z);
    const started = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - started) / 360);
      chickenModel.position.lerpVectors(from, to, progress);
      chickenModel.position.y = Math.sin(progress * Math.PI) * 0.5;
      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }
      chickenModel.position.set(state.x, 0, state.z);
      state.score = Math.max(state.score, state.z * 10);
      if (riverUnderChicken()) finish("🌊 Splash!");
      else if (hitByCar()) finish("💥 Ouch!");
      else {
        mount.querySelector("#hopper-score").textContent = String(state.score);
        removeOldRows();
      }
      state.moving = false;
      if (queue.length) animateMove();
    };
    requestAnimationFrame(animate);
  }

  const keyHandler = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const moves = {
      ArrowUp: "forward",
      w: "forward",
      W: "forward",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    if (moves[event.key]) {
      event.preventDefault();
      processMove(moves[event.key]);
    }
  };
  window.addEventListener("keydown", keyHandler);
  controls.forEach((button) =>
    button.addEventListener("click", () => processMove(button.dataset.hopperMove)),
  );

  const resize = () => {
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();
  let lastTime = performance.now();
  const render = (now) => {
    if (state.ended) return;
    state.frame = requestAnimationFrame(render);
    const delta = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    woods.forEach((wood) => {
      wood.position.x += 0.02 * delta * 60;
      if (wood.position.x > 10) wood.position.x = -10;
    });
    cars.forEach((car) => {
      car.position.x += 0.05 * delta * 60;
      if (car.position.x > 10) car.position.x = -10;
    });
    camera.position.z += (state.z - 5 - camera.position.z) * 0.08;
    camera.lookAt(4, -1, state.z);
    renderer.render(scene, camera);
  };
  state.frame = requestAnimationFrame(render);

  return () => {
    state.ended = true;
    cancelAnimationFrame(state.frame);
    window.removeEventListener("keydown", keyHandler);
    window.removeEventListener("resize", resize);
    renderer.dispose();
    scene.clear();
  };
}
