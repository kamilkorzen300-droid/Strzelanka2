
import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ZAPIS GRY
let coins = Number(localStorage.getItem("spmCoins") || 0);
let bestWave = Number(localStorage.getItem("spmBest") || 0);
let owned = JSON.parse(localStorage.getItem("spmOwned") || '["blue"]');
let skin = localStorage.getItem("spmSkin") || "blue";
let selectedMap = "warehouse";

const items = [
  { id: "blue", name: "Niebieska broń", price: 0, color: 0x168cff },
  { id: "red", name: "Czerwona broń", price: 100, color: 0xff3344 },
  { id: "gold", name: "Złota broń", price: 250, color: 0xffcc22 },
  { id: "purple", name: "Fioletowa broń", price: 400, color: 0xaa55ff },
  { id: "health", name: "Więcej zdrowia (+25)", price: 150 }
];

let scene, camera, renderer, player;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let wave = 1;
let hp = 100;
let ammo = 30;
let maxAmmo = 30;
let reloading = false;
let playing = false;
let lastShot = 0;
let lastEnemyAttack = 0;
let moveX = 0, moveY = 0;
let lookX = 0, lookY = 0;
let yaw = 0, pitch = 0;
let gameClock = new THREE.Clock();
let messageTimer = null;
let healthBonus = 0;

const $ = id => document.getElementById(id);

function save() {
  localStorage.setItem("spmCoins", coins);
  localStorage.setItem("spmBest", bestWave);
  localStorage.setItem("spmOwned", JSON.stringify(owned));
  localStorage.setItem("spmSkin", skin);
}

function updateCoins() {
  $("coins").textContent = coins;
  $("menuCoins").textContent = coins;
  $("shopCoins").textContent = coins;
  save();
}

function hideScreens() {
  ["menu", "maps", "shop", "gameOver"].forEach(id =>
    $(id).classList.add("hidden")
  );
}

function backMenu() {
  playing = false;
  hideScreens();
  $("menu").classList.remove("hidden");
  $("hud").classList.add("hidden");
  $("bestWave").textContent = bestWave;
  updateCoins();
}

function showMaps() {
  hideScreens();
  $("maps").classList.remove("hidden");
}

function selectMap(map) {
  selectedMap = map;
  startGame();
}

function showShop() {
  hideScreens();
  $("shop").classList.remove("hidden");
  renderShop();
}

function renderShop() {
  $("shopItems").innerHTML = "";

  items.forEach(item => {
    const bought = owned.includes(item.id);
    const div = document.createElement("div");
    div.className = "shopItem";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const info = document.createElement("p");
    info.textContent = bought ? "Kupione" : "Cena: " + item.price + " 🪙";

    const button = document.createElement("button");
    button.textContent = bought ? "WYBIERZ" : "KUP";

    button.onclick = () => {
      if (bought) {
        if (item.id !== "health") {
          skin = item.id;
          localStorage.setItem("spmSkin", skin);
          renderShop();
        }
      } else if (coins >= item.price) {
        coins -= item.price;
        owned.push(item.id);

        if (item.id === "health") {
          healthBonus += 25;
        }

        save();
        updateCoins();
        renderShop();
      } else {
        alert("Masz za mało monet!");
      }
    };

    div.append(title, info, button);
    $("shopItems").appendChild(div);
  });
}

function showMessage(text) {
  $("message").textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    $("message").textContent = "";
  }, 2500);
}

// MAPY
function createMap() {
  const colors = {
    warehouse: 0x68717c,
    city: 0x596779,
    desert: 0xc49a58,
    base: 0x485b50
  };

  scene.background = new THREE.Color(
    selectedMap === "desert" ? 0xd7ad75 :
    selectedMap === "city" ? 0x9aa9b9 :
    selectedMap === "base" ? 0x687b70 : 0x8193a3
  );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: colors[selectedMap] })
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: selectedMap === "desert" ? 0xb28b56 :
           selectedMap === "city" ? 0x596477 :
           selectedMap === "base" ? 0x425b4a : 0x536273
  });

  for (let i = 0; i < 22; i++) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        3 + Math.random() * 5,
        2 + Math.random() * 5,
        2 + Math.random() * 5
      ),
      wallMaterial
    );

    const angle = Math.random() * Math.PI * 2;
    const distance = 12 + Math.random() * 30;

    wall.position.set(
      Math.cos(angle) * distance,
      wall.geometry.parameters.height / 2,
      Math.sin(angle) * distance
    );

    scene.add(wall);
  }

  const light = new THREE.HemisphereLight(0xffffff, 0x444455, 2);
  scene.add(light);

  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 10);
  scene.add(sun);
}

// PRZECIWNICY
function createEnemy(boss = false) {
  const color = boss ? 0x9c36ff : 0xe84b4b;
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      boss ? 1.7 : 0.9,
      boss ? 2.5 : 1.5,
      boss ? 1.1 : 0.7
    ),
    new THREE.MeshStandardMaterial({ color })
  );

  body.position.y = boss ? 1.25 : 0.75;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(boss ? 0.55 : 0.35, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffc49c })
  );

  head.position.y = boss ? 2.9 : 1.8;
  group.add(head);

  const angle = Math.random() * Math.PI * 2;
  const distance = 14 + Math.random() * 12;

  group.position.set(
    player.position.x + Math.cos(angle) * distance,
    0,
    player.position.z + Math.sin(angle) * distance
  );

  scene.add(group);

  enemies.push({
    mesh: group,
    hp: boss ? 15 + wave * 3 : 2 + Math.floor(wave / 4),
    boss,
    speed: boss ? 1.5 : 2 + wave * 0.035
  });
}

function spawnWave() {
  let count = 3 + wave * 2;
  const boss = wave % 5 === 0;

  if (wave > 25) count += (wave - 25) * 2;

  for (let i = 0; i < count; i++) {
    createEnemy(false);
  }

  if (boss) createEnemy(true);

  showMessage(
    wave > 25 ? "TRYB NIESKOŃCZONY – FALA " + wave :
    boss ? "BOSS! FALA " + wave :
    "FALA " + wave
  );

  $("wave").textContent = wave;
}

// BROŃ
function shoot() {
  if (!playing || ammo <= 0 || reloading) return;

  const now = performance.now();
  if (now - lastShot < 220) return;
  lastShot = now;

  ammo--;
  $("ammo").textContent = ammo;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffee66 })
  );

  bullet.position.copy(camera.position);
  bullet.userData.velocity = direction.multiplyScalar(45);
  bullet.userData.life = 1.5;
  scene.add(bullet);
  bullets.push(bullet);
}

function reload() {
  if (reloading || ammo === maxAmmo || !playing) return;

  reloading = true;
  showMessage("PRZEŁADOWANIE...");

  setTimeout(() => {
    if (!playing) return;
    ammo = maxAmmo;
    $("ammo").textContent = ammo;
    reloading = false;
    showMessage("GOTOWY!");
  }, 1300);
}

// GŁÓWNA GRA
function startGame() {
  hideScreens();

  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  enemies = [];
  bullets = [];
  enemyBullets = [];

  wave = 1;
  hp = 100 + healthBonus;
  ammo = maxAmmo;
  reloading = false;
  yaw = 0;
  pitch = 0;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 200
  );

  camera.position.set(0, 1.7, 0);
  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  player = new THREE.Object3D();
  player.position.set(0, 0, 0);
  scene.add(player);

  createMap();

  camera.position.set(0, 1.7, 0);
  scene.add(camera);

  $("hud").classList.remove("hidden");
  $("hp").textContent = hp;
  $("ammo").textContent = ammo;

  playing = true;
  gameClock.start();
  spawnWave();
  animate();
}

function animate() {
  if (!playing) return;
  requestAnimationFrame(animate);

  const delta = Math.min(gameClock.getDelta(), 0.05);

  // RUCH GRACZA
  const forward = new THREE.Vector3(
    -Math.sin(yaw), 0, -Math.cos(yaw)
  );

  const right = new THREE.Vector3(
    Math.cos(yaw), 0, -Math.sin(yaw)
  );

  player.position.addScaledVector(forward, -moveY * 8 * delta);
  player.position.addScaledVector(right, moveX * 8 * delta);

  player.position.x = THREE.MathUtils.clamp(player.position.x, -47, 47);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -47, 47);

  camera.position.set(
    player.position.x,
    1.7,
    player.position.z
  );

  yaw -= lookX * 0.003;
  pitch -= lookY * 0.003;
  pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);

  camera.rotation.set(pitch, yaw, 0);
  lookX = 0;
  lookY = 0;

  // POCISKI GRACZA
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.userData.velocity, delta);
    b.userData.life -= delta;

    let hit = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];

      if (b.position.distanceTo(e.mesh.position.clone().add(
        new THREE.Vector3(0, 1, 0)
      )) < (e.boss ? 1.6 : 1.1)) {
        e.hp--;
        hit = true;

        if (e.hp <= 0) {
          scene.remove(e.mesh);
          enemies.splice(j, 1);
          coins += e.boss ? 100 : 10;
          updateCoins();
        }
        break;
      }
    }

    if (hit || b.userData.life <= 0) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }

  // PRZECIWNICY
  enemies.forEach(e => {
    const direction = new THREE.Vector3()
      .subVectors(player.position, e.mesh.position);

    const distance = direction.length();

    if (distance > 2.2) {
      direction.normalize();
      e.mesh.position.addScaledVector(direction, e.speed * delta);
    }

    e.mesh.lookAt(player.position.x, 0, player.position.z);
  });

  // PRZECIWNICY ZADAJĄ OBRAŻENIA
  const now = performance.now();

  if (now - lastEnemyAttack > 900) {
    lastEnemyAttack = now;

    enemies.forEach(e => {
      const d = e.mesh.position.distanceTo(player.position);
      if (d < 3.5) {
        hp -= e.boss ? 8 : 4;
      }
    });

    $("hp").textContent = Math.max(0, hp);

    if (hp <= 0) {
      endGame();
      return;
    }
  }

  // NASTĘPNA FALA
  if (enemies.length === 0) {
    coins += 20 + wave * 3;
    updateCoins();

    if (wave < 25) {
      wave++;
    } else {
      wave++;
    }

    spawnWave();
  }

  renderer.render(scene, camera);
}

function endGame() {
  playing = false;
  bestWave = Math.max(bestWave, wave);
  save();

  $("finalWave").textContent = wave;
  $("bestWave").textContent = bestWave;
  $("hud").classList.add("hidden");
  $("gameOver").classList.remove("hidden");
}

// STEROWANIE KOMPUTEREM
const keys = {};

window.addEventListener("keydown", e => {
  keys[e.code] = true;

  if (e.code === "KeyR") reload();
  if (e.code === "Space") e.preventDefault();
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

window.addEventListener("mousedown", e => {
  if (playing && e.button === 0) shoot();
});

window.addEventListener("mousemove", e => {
  if (playing && document.pointerLockElement === renderer?.domElement) {
    lookX += e.movementX;
    lookY += e.movementY;
  }
});

window.addEventListener("click", () => {
  if (playing && !isTouchDevice()) {
    renderer.domElement.requestPointerLock?.();
  }
});

function isTouchDevice() {
  return navigator.maxTouchPoints > 0;
}

// STEROWANIE TELEFONEM
const joystick = $("joystick");
const stick = $("stick");

joystick.addEventListener("pointerdown", e => {
  joystick.setPointerCapture(e.pointerId);
  updateJoystick(e);
});

joystick.addEventListener("pointermove", e => {
  if (e.buttons) updateJoystick(e);
});

function updateJoystick(e) {
  const rect = joystick.getBoundingClientRect();
  let x = e.clientX - rect.left - rect.width / 2;
  let y = e.clientY - rect.top - rect.height / 2;

  const length = Math.hypot(x, y);
  const max = 38;

  if (length > max) {
    x = x / length * max;
    y = y / length * max;
  }

  stick.style.left = (33 + x) + "px";
  stick.style.top = (33 + y) + "px";

  moveX = x / max;
  moveY = y / max;
}

function resetJoystick() {
  moveX = 0;
  moveY = 0;
  stick.style.left = "33px";
  stick.style.top = "33px";
}

joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

let lookPointer = null;
let previousTouch = { x: 0, y: 0 };

rendererTouchSetup();

function rendererTouchSetup() {
  document.addEventListener("pointerdown", e => {
    if (!playing || !e.isPrimary) return;
    if (e.target.closest("#mobileControls")) return;
    if (e.target.closest("button")) return;

    if (isTouchDevice()) {
      lookPointer = e.pointerId;
      previousTouch = { x: e.clientX, y: e.clientY };
    }
  });

  document.addEventListener("pointermove", e => {
    if (e.pointerId !== lookPointer) return;

    lookX += e.clientX - previousTouch.x;
    lookY += e.clientY - previousTouch.y;

    previousTouch = { x: e.clientX, y: e.clientY };
  });

  document.addEventListener("pointerup", e => {
    if (e.pointerId === lookPointer) lookPointer = null;
  });
}

$("fire").addEventListener("pointerdown", e => {
  e.preventDefault();
  shoot();
});

$("reload").addEventListener("pointerdown", e => {
  e.preventDefault();
  reload();
});

$("jump").addEventListener("pointerdown", e => {
  e.preventDefault();
  if (playing) {
    camera.position.y = 2.8;
    setTimeout(() => {
      if (playing) camera.position.y = 1.7;
    }, 350);
  }
});

// RUCH Z KLAWIATURY
function keyboardMovement() {
  if (!playing) return;

  moveX = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
  moveY = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);
}

setInterval(() => {
  if (playing && !isTouchDevice()) keyboardMovement();
}, 30);

// ZMIANA ROZMIARU
window.addEventListener("resize", () => {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// START
updateCoins();
$("bestWave").textContent = bestWave;
