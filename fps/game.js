// ==================== FPS Arena Mobile - 音效引擎 ====================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, duration, type = 'square', vol = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

function sfxShoot() {
  initAudio();
  playTone(200, 0.08, 'sawtooth', 0.1);
  playTone(80, 0.05, 'square', 0.15);
}

function sfxShotgun() {
  initAudio();
  playTone(100, 0.12, 'sawtooth', 0.15);
  playTone(50, 0.08, 'triangle', 0.2);
}

function sfxSniper() {
  initAudio();
  playTone(400, 0.15, 'square', 0.08);
  playTone(150, 0.1, 'sawtooth', 0.12);
}

function sfxHit() {
  initAudio();
  playTone(300, 0.05, 'square', 0.06);
}

function sfxReload() {
  initAudio();
  setTimeout(() => playTone(600, 0.04, 'square', 0.05), 0);
  setTimeout(() => playTone(800, 0.04, 'square', 0.05), 150);
  setTimeout(() => playTone(1000, 0.06, 'square', 0.05), 300);
}

function sfxDeath() {
  initAudio();
  playTone(200, 0.3, 'sawtooth', 0.1);
  playTone(100, 0.4, 'triangle', 0.08);
}

function sfxKill() {
  initAudio();
  playTone(500, 0.06, 'square', 0.06);
  setTimeout(() => playTone(700, 0.06, 'square', 0.06), 80);
}

// ==================== 核心引擎 ====================
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const mCanvas = document.getElementById('minimapCanvas'), mCtx = mCanvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

let W = canvas.width, H = canvas.height, HW = W / 2, HH = H / 2;

// 地图 - 更精细的布局
const MS = 64;
const map = [];
for (let y = 0; y < MS; y++) {
  map[y] = [];
  for (let x = 0; x < MS; x++) {
    map[y][x] = (y === 0 || y === MS - 1 || x === 0 || x === MS - 1) ? 1 : 0;
  }
}
// 房间和走廊
const rooms = [
  [8, 8, 16, 16], [40, 8, 52, 16], [8, 40, 16, 52], [40, 40, 52, 52],
  [24, 28, 40, 36]
];
for (let [x1, y1, x2, y2] of rooms) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (y === y1 || y === y2 || x === x1 || x === x2) map[y][x] = 1;
    }
  }
}
// 走廊连接
for (let x = 16; x <= 40; x++) { map[12][x] = 1; map[12][x] = 0; }
for (let y = 16; y <= 40; y++) { map[y][28] = 1; map[y][28] = 0; }
// 随机柱子
for (let i = 0; i < 40; i++) {
  let x = 5 + Math.floor(Math.random() * (MS - 10));
  let y = 5 + Math.floor(Math.random() * (MS - 10));
  if (map[y][x] === 0 && !(x > 10 && x < 20 && y > 10 && y < 20)) map[y][x] = 1;
}

// 玩家
let player = { x: 12, y: 12, angle: 0, hp: 100, maxHp: 100, speed: 3.5, sprintMul: 1.7, score: 0, alive: true };
let keys = {}, mouseDown = false, gameRunning = false;

// 武器
const weapons = [
  { name: '手枪', ammo: 12, maxAmmo: 12, damage: 25, fireRate: 380, reloadTime: 1400, spread: 0.015, auto: false, color: '#ffdd44', sfx: sfxShoot },
  { name: '冲锋枪', ammo: 30, maxAmmo: 30, damage: 14, fireRate: 75, reloadTime: 1800, spread: 0.07, auto: true, color: '#44ddff', sfx: sfxShoot },
  { name: '霰弹枪', ammo: 8, maxAmmo: 8, damage: 20, fireRate: 550, reloadTime: 2200, spread: 0.14, auto: false, color: '#ff8844', pellets: 6, sfx: sfxShotgun },
  { name: '狙击枪', ammo: 5, maxAmmo: 5, damage: 95, fireRate: 1100, reloadTime: 2800, spread: 0.003, auto: false, color: '#ff44ff', sfx: sfxSniper }
];
let currentWeapon = 0, lastShot = 0, reloading = false, reloadStart = 0;

// 实体
let enemies = [], bullets = [], particles = [], muzzleFlash = 0;
const MAX_ENEMIES = 10;

function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  let ex, ey, ok = false, tries = 0;
  while (!ok && tries < 50) {
    tries++;
    ex = 4 + Math.random() * (MS - 8);
    ey = 4 + Math.random() * (MS - 8);
    let dx = ex - player.x, dy = ey - player.y;
    if (Math.sqrt(dx * dx + dy * dy) > 6 && map[Math.floor(ey)][Math.floor(ex)] === 0) ok = true;
  }
  if (!ok) return;
  const types = ['grunt', 'grunt', 'grunt', 'heavy', 'fast'];
  const type = types[Math.floor(Math.random() * types.length)];
  const configs = {
    grunt: { hp: 50, speed: 1.8, damage: 8, color: '#ff6644', size: 1.0, score: 100 },
    heavy: { hp: 120, speed: 1.2, damage: 18, color: '#ff2222', size: 1.4, score: 250 },
    fast: { hp: 30, speed: 3.5, damage: 5, color: '#ffaa00', size: 0.7, score: 150 }
  };
  const cfg = configs[type];
  enemies.push({ x: ex, y: ey, hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed, damage: cfg.damage, attackRate: 700, lastAttack: 0, type, color: cfg.color, size: cfg.size, score: cfg.score });
}

// 射线检测
function raycast(x0, y0, angle, maxDist = 40) {
  let dx = Math.cos(angle), dy = Math.sin(angle);
  for (let d = 0; d < maxDist; d += 0.05) {
    let tx = Math.floor(x0 + dx * d), ty = Math.floor(y0 + dy * d);
    if (tx < 0 || ty < 0 || tx >= MS || ty >= MS || map[ty][tx] === 1) return d;
  }
  return maxDist;
}

function isWall(x, y) {
  let tx = Math.floor(x), ty = Math.floor(y);
  return tx < 0 || ty < 0 || tx >= MS || ty >= MS || map[ty][tx] === 1;
}

// 输入 - 键盘
document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'r' && !reloading) startReload();
  if (e.key >= '1' && e.key <= '4') switchWeapon(parseInt(e.key) - 1);
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('mousedown', e => { if (e.button === 0) { mouseDown = true; initAudio(); } });
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
document.addEventListener('mousemove', e => {
  if (gameRunning && document.pointerLockElement) player.angle += (e.movementX || 0) * 0.0025;
});
canvas.addEventListener('click', () => { if (gameRunning) canvas.requestPointerLock(); });

// 触控 - 摇杆
const joystick = document.getElementById('btn-joystick');
const knob = document.getElementById('joystick-knob');
let joystickActive = false, joystickId = null, joystickBase = { x: 0, y: 0 };
let touchMoveX = 0, touchMoveY = 0;

joystick.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joystickActive = true;
  joystickId = t.identifier;
  const rect = joystick.getBoundingClientRect();
  joystickBase = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
});

joystick.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === joystickId) {
      let dx = t.clientX - joystickBase.x, dy = t.clientY - joystickBase.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let maxDist = 35;
      if (dist > maxDist) { dx = dx / dist * maxDist; dy = dy / dist * maxDist; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      touchMoveX = dx / maxDist;
      touchMoveY = dy / maxDist;
    }
  }
});

joystick.addEventListener('touchend', e => {
  for (let t of e.changedTouches) {
    if (t.identifier === joystickId) {
      joystickActive = false;
      joystickId = null;
      knob.style.transform = 'translate(0,0)';
      touchMoveX = 0;
      touchMoveY = 0;
    }
  }
});

// 触控 - 开火
const btnFire = document.getElementById('btn-fire');
btnFire.addEventListener('touchstart', e => { e.preventDefault(); mouseDown = true; initAudio(); });
btnFire.addEventListener('touchend', e => { e.preventDefault(); mouseDown = false; });

// 触控 - 换弹
document.getElementById('btn-reload').addEventListener('touchstart', e => {
  e.preventDefault();
  if (!reloading) startReload();
});

// 触控 - 切换武器
document.getElementById('btn-weapon').addEventListener('touchstart', e => {
  e.preventDefault();
  switchWeapon((currentWeapon + 1) % weapons.length);
});

// 触控 - 瞄准（屏幕右侧滑动）
let aimTouchId = null, aimLastX = 0;
canvas.addEventListener('touchstart', e => {
  for (let t of e.changedTouches) {
    if (t.clientX > window.innerWidth / 2 && aimTouchId === null) {
      aimTouchId = t.identifier;
      aimLastX = t.clientX;
    }
  }
});
canvas.addEventListener('touchmove', e => {
  for (let t of e.changedTouches) {
    if (t.identifier === aimTouchId) {
      player.angle += (t.clientX - aimLastX) * 0.004;
      aimLastX = t.clientX;
    }
  }
});
canvas.addEventListener('touchend', e => {
  for (let t of e.changedTouches) {
    if (t.identifier === aimTouchId) aimTouchId = null;
  }
});

function switchWeapon(i) {
  if (i >= 0 && i < weapons.length) {
    currentWeapon = i;
    reloading = false;
    document.getElementById('weaponText').textContent = weapons[i].name;
  }
}

function startReload() {
  let w = weapons[currentWeapon];
  if (w.ammo >= w.maxAmmo) return;
  reloading = true;
  reloadStart = Date.now();
  sfxReload();
}

function shoot() {
  if (!gameRunning || !player.alive || reloading) return;
  let w = weapons[currentWeapon];
  if (w.ammo <= 0) { startReload(); return; }
  let now = Date.now();
  if (now - lastShot < w.fireRate) return;
  lastShot = now;
  w.ammo--;
  muzzleFlash = 40;
  w.sfx();
  let pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    let spread = (Math.random() - 0.5) * w.spread;
    let a = player.angle + spread;
    let dist = raycast(player.x, player.y, a);
    bullets.push({ x: player.x, y: player.y, angle: a, dist: dist, damage: w.damage, color: w.color, life: 0 });
  }
  updateHUD();
}

function updateHUD() {
  let w = weapons[currentWeapon];
  document.getElementById('hpText').textContent = Math.max(0, Math.floor(player.hp));
  document.getElementById('hpBar').style.width = (player.hp / player.maxHp * 100) + '%';
  document.getElementById('ammoText').textContent = w.ammo;
  document.getElementById('ammoMax').textContent = w.maxAmmo;
  document.getElementById('ammoBar').style.width = (w.ammo / w.maxAmmo * 100) + '%';
  document.getElementById('scoreText').textContent = player.score;
}

function addKillMsg(msg) {
  let d = document.getElementById('killfeed');
  let el = document.createElement('div');
  el.className = 'kill-msg';
  el.textContent = msg;
  d.appendChild(el);
  setTimeout(() => el.remove(), 3000);
  if (d.children.length > 5) d.firstChild.remove();
}

function showDamage(dmg) {
  let el = document.getElementById('dmg');
  el.textContent = '-' + dmg;
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 150);
}

// 纹理生成
const wallTex = [];
for (let i = 0; i < 64; i++) {
  wallTex[i] = [];
  for (let j = 0; j < 64; j++) {
    let v = Math.random() * 20 + (i % 8 === 0 || j % 8 === 0 ? 30 : 0);
    wallTex[i][j] = v;
  }
}

// 主循环
function update(dt) {
  if (!gameRunning || !player.alive) return;
  dt = Math.min(dt, 50);

  // 移动
  let spd = player.speed * (keys['shift'] ? player.sprintMul : 1);
  let mx = touchMoveX * spd, my = touchMoveY * spd;
  if (keys['w'] || keys['arrowup']) { mx += Math.cos(player.angle) * spd; my += Math.sin(player.angle) * spd; }
  if (keys['s'] || keys['arrowdown']) { mx -= Math.cos(player.angle) * spd; my -= Math.sin(player.angle) * spd; }
  if (keys['a'] || keys['arrowleft']) { mx += Math.cos(player.angle - Math.PI / 2) * spd * 0.7; my += Math.sin(player.angle - Math.PI / 2) * spd * 0.7; }
  if (keys['d'] || keys['arrowright']) { mx += Math.cos(player.angle + Math.PI / 2) * spd * 0.7; my += Math.sin(player.angle + Math.PI / 2) * spd * 0.7; }
  let nx = player.x + mx * dt / 1000, ny = player.y + my * dt / 1000;
  if (!isWall(nx, player.y)) player.x = nx;
  if (!isWall(player.x, ny)) player.y = ny;

  // 射击
  if (mouseDown) {
    let w = weapons[currentWeapon];
    if (w.auto) shoot();
    else if (Date.now() - lastShot >= w.fireRate) shoot();
  }

  // 换弹
  if (reloading) {
    let w = weapons[currentWeapon];
    if (Date.now() - reloadStart >= w.reloadTime) { w.ammo = w.maxAmmo; reloading = false; updateHUD(); }
  }

  // 子弹
  for (let b of bullets) {
    b.life += dt;
    b.x = b.x + Math.cos(b.angle) * 100 * dt / 1000;
    b.y = b.y + Math.sin(b.angle) * 100 * dt / 1000;
  }
  bullets = bullets.filter(b => b.life < 400);

  // 命中检测
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    for (let e of enemies) {
      let dx = b.x - e.x, dy = b.y - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.4) {
        e.hp -= b.damage;
        sfxHit();
        for (let p = 0; p < 6; p++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 250, color: '#ff3333', size: Math.random() * 3 + 1 });
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          player.score += e.score;
          sfxKill();
          addKillMsg('击杀 ' + (e.type === 'heavy' ? '重型兵' : e.type === 'fast' ? '疾速兵' : '士兵') + ' +' + e.score);
          for (let p = 0; p < 15; p++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 400, color: '#ff6600', size: Math.random() * 4 + 2 });
          enemies.splice(enemies.indexOf(e), 1);
        }
        break;
      }
    }
  }

  // 敌人AI
  for (let e of enemies) {
    let dx = player.x - e.x, dy = player.y - e.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.3) {
      let nx = e.x + dx / dist * e.speed * dt / 1000;
      let ny = e.y + dy / dist * e.speed * dt / 1000;
      if (!isWall(nx, e.y)) e.x = nx;
      if (!isWall(e.x, ny)) e.y = ny;
    }
    if (dist < 1.8 && Date.now() - e.lastAttack > e.attackRate) {
      player.hp -= e.damage;
      e.lastAttack = Date.now();
      showDamage(e.damage);
      sfxHit();
      updateHUD();
      if (player.hp <= 0) gameOver();
    }
  }

  // 粒子
  for (let p of particles) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  if (muzzleFlash > 0) muzzleFlash -= dt;
  if (enemies.length < MAX_ENEMIES && Math.random() < 0.025) spawnEnemy();
}

// 渲染
function render() {
  W = canvas.width; H = canvas.height; HW = W / 2; HH = H / 2;
  // 天空渐变
  let skyGrad = ctx.createLinearGradient(0, 0, 0, HH);
  skyGrad.addColorStop(0, '#1a1a2e');
  skyGrad.addColorStop(0.5, '#16213e');
  skyGrad.addColorStop(1, '#0f3460');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, HH);
  // 地面
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, HH, W, HH);

  const FOV = Math.PI / 3, NUM_RAYS = Math.floor(W / 3);

  // 深度缓冲
  const zBuffer = new Array(W).fill(Infinity);

  // 墙壁渲染
  for (let i = 0; i < NUM_RAYS; i++) {
    let rayAngle = player.angle - FOV / 2 + FOV * i / NUM_RAYS;
    let dist = raycast(player.x, player.y, rayAngle, 40);
    dist *= Math.cos(rayAngle - player.angle);
    let wallH = H / (dist + 0.1) * 1.8;
    let shade = Math.max(0, 1 - dist / 40);
    // 纹理坐标
    let hitX = (player.x + Math.cos(rayAngle) * dist) % 1;
    let hitY = (player.y + Math.sin(rayAngle) * dist) % 1;
    let texX = Math.floor(Math.abs(hitX > 0.001 ? hitY : hitX) * 64) % 64;
    let colX = i * 3;
    for (let j = 0; j < wallH && j < H; j++) {
      let texY = Math.floor(j / wallH * 64) % 64;
      let texVal = wallTex[texY] ? wallTex[texY][texX] || 50 : 50;
      let r = Math.floor((180 + texVal * 0.5) * shade);
      let g = Math.floor((150 + texVal * 0.3) * shade);
      let b = Math.floor((120 + texVal * 0.2) * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(colX, HH - wallH / 2 + j, 3, 1);
    }
    // 地板
    for (let j = HH + wallH / 2; j < H; j++) {
      let floorDist = H / (2 * (j - HH) - H) * 2;
      let fs = Math.max(0, 1 - floorDist / 40);
      ctx.fillStyle = `rgb(${Math.floor(35*fs)},${Math.floor(30*fs)},${Math.floor(25*fs)})`;
      ctx.fillRect(colX, j, 3, 1);
    }
    zBuffer[colX] = dist;
  }

  // 敌人渲染（排序）
  let visibleEnemies = enemies.map(e => {
    let dx = e.x - player.x, dy = e.y - player.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let angleTo = Math.atan2(dy, dx);
    let diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return { e, dist, diff };
  }).filter(v => Math.abs(v.diff) < FOV / 2 && v.dist > 0.2)
    .sort((a, b) => b.dist - a.dist);

  for (let { e, dist, diff } of visibleEnemies) {
    let projX = HW + diff / FOV * W;
    let size = H / (dist + 0.1) * e.size;
    let shade = Math.max(0.3, 1 - dist / 40);
    let sx = projX - size / 2, sy = HH - size / 2;

    // 身体
    ctx.fillStyle = e.color;
    ctx.fillRect(sx + size * 0.2, sy + size * 0.3, size * 0.6, size * 0.7);
    // 头
    ctx.fillStyle = e.type === 'heavy' ? '#cc0000' : '#dd6644';
    ctx.beginPath();
    ctx.arc(projX, sy + size * 0.25, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.fillRect(projX - size * 0.06, sy + size * 0.2, size * 0.04, size * 0.04);
    ctx.fillRect(projX + size * 0.02, sy + size * 0.2, size * 0.04, size * 0.04);
    // 腿
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + size * 0.25, sy + size * 0.9, size * 0.15, size * 0.1);
    ctx.fillRect(sx + size * 0.6, sy + size * 0.9, size * 0.15, size * 0.1);

    // 血条
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#400';
      ctx.fillRect(sx, sy - 6, size, 3);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(sx, sy - 6, size * (e.hp / e.maxHp), 3);
    }
  }

  // 枪口火焰
  if (muzzleFlash > 0) {
    let alpha = muzzleFlash / 40;
    ctx.fillStyle = `rgba(255,200,50,${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(HW, HH + 50, 18 + Math.random() * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(HW, HH + 50, 8 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 武器模型
  let w = weapons[currentWeapon];
  let bobX = Math.sin(Date.now() * 0.01) * 3;
  let bobY = Math.abs(Math.cos(Date.now() * 0.01)) * 2;
  // 枪身
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(HW - 18 + bobX, HH + 35 + bobY, 36, 70);
  // 枪管
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(HW - 6 + bobX, HH + 22 + bobY, 12, 25);
  // 握把
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(HW - 10 + bobX, HH + 80 + bobY, 20, 30);
  // 准星
  ctx.fillStyle = w.color;
  ctx.fillRect(HW - 2 + bobX, HH + 18 + bobY, 4, 8);

  // 粒子
  for (let p of particles) {
    let dx = p.x - player.x, dy = p.y - player.y, dist = Math.sqrt(dx * dx + dy * dy);
    let angleTo = Math.atan2(dy, dx), diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < FOV / 2 && dist > 0.05) {
      let sx = HW + diff / FOV * W, sy = HH - (p.y - player.y) / (dist + 0.1) * H;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 400;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  // 小地图
  mCtx.fillStyle = 'rgba(0,0,0,.7)';
  mCtx.fillRect(0, 0, 80, 80);
  let scale = 80 / MS;
  for (let y = 0; y < MS; y++)
    for (let x = 0; x < MS; x++)
      if (map[y][x] === 1) { mCtx.fillStyle = '#444'; mCtx.fillRect(x * scale, y * scale, scale, scale); }
  mCtx.fillStyle = '#0f0';
  mCtx.beginPath();
  mCtx.arc(player.x * scale, player.y * scale, 2.5, 0, Math.PI * 2);
  mCtx.fill();
  mCtx.strokeStyle = '#0f0';
  mCtx.lineWidth = 1;
  mCtx.beginPath();
  mCtx.moveTo(player.x * scale, player.y * scale);
  mCtx.lineTo((player.x + Math.cos(player.angle) * 2.5) * scale, (player.y + Math.sin(player.angle) * 2.5) * scale);
  mCtx.stroke();
  for (let e of enemies) {
    mCtx.fillStyle = e.color;
    mCtx.beginPath();
    mCtx.arc(e.x * scale, e.y * scale, 1.5, 0, Math.PI * 2);
    mCtx.fill();
  }

  // 换弹进度
  if (reloading) {
    let progress = (Date.now() - reloadStart) / weapons[currentWeapon].reloadTime;
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('换弹中... ' + Math.floor(progress * 100) + '%', HW, HH + 120);
    ctx.textAlign = 'start';
  }
}

function gameOver() {
  player.alive = false;
  gameRunning = false;
  sfxDeath();
  document.exitPointerLock();
  document.getElementById('msg').classList.remove('hidden');
  document.getElementById('msg').innerHTML = '<h1>💀 阵亡</h1><p>击杀: ' + player.score + ' 分</p><button onclick="startGame()">再来一局</button>';
}

let lastTS = 0;

function gameLoop(ts) {
  if (!lastTS) lastTS = ts;
  let dt = ts - lastTS;
  lastTS = ts;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  initAudio();
  player = { x: 12, y: 12, angle: 0, hp: 100, maxHp: 100, speed: 3.5, sprintMul: 1.7, score: 0, alive: true };
  enemies = [];
  bullets = [];
  particles = [];
  currentWeapon = 0;
  reloading = false;
  muzzleFlash = 0;
  for (let i = 0; i < 4; i++) spawnEnemy();
  document.getElementById('msg').classList.add('hidden');
  document.getElementById('weaponText').textContent = '手枪';
  updateHUD();
  gameRunning = true;
  try { canvas.requestPointerLock(); } catch (e) { }
}

render();
requestAnimationFrame(gameLoop);
updateHUD();