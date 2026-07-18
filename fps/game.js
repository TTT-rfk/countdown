// ==================== FPS Arena v3 - 音效引擎 ====================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }
function playTone(f, d, t = 'square', v = 0.06) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + d);
}
function sfxShoot() { initAudio(); playTone(180, 0.06, 'sawtooth', 0.08); playTone(60, 0.04, 'square', 0.12); }
function sfxShotgun() { initAudio(); playTone(80, 0.1, 'sawtooth', 0.14); playTone(40, 0.06, 'triangle', 0.18); }
function sfxSniper() { initAudio(); playTone(350, 0.12, 'square', 0.07); playTone(120, 0.08, 'sawtooth', 0.1); }
function sfxHit() { initAudio(); playTone(280, 0.04, 'square', 0.05); }
function sfxReload() { initAudio(); setTimeout(() => playTone(500, 0.03, 'square', 0.04), 0); setTimeout(() => playTone(700, 0.03, 'square', 0.04), 120); setTimeout(() => playTone(900, 0.05, 'square', 0.04), 240); }
function sfxDeath() { initAudio(); playTone(180, 0.25, 'sawtooth', 0.08); playTone(80, 0.35, 'triangle', 0.06); }
function sfxKill() { initAudio(); playTone(450, 0.05, 'square', 0.05); setTimeout(() => playTone(650, 0.05, 'square', 0.05), 60); }

// ==================== 核心引擎 ====================
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const mCanvas = document.getElementById('minimapCanvas'), mCtx = mCanvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
let W, H, HW, HH;

// 地图
const MS = 64;
const map = [];
for (let y = 0; y < MS; y++) { map[y] = []; for (let x = 0; x < MS; x++) map[y][x] = (y === 0 || y === MS - 1 || x === 0 || x === MS - 1) ? 1 : 0; }
const rooms = [[8, 8, 16, 16], [40, 8, 52, 16], [8, 40, 16, 52], [40, 40, 52, 52], [24, 28, 40, 36]];
for (let [x1, y1, x2, y2] of rooms) for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (y === y1 || y === y2 || x === x1 || x === x2) map[y][x] = 1;
for (let x = 16; x <= 40; x++) map[12][x] = 0;
for (let y = 16; y <= 40; y++) map[y][28] = 0;
for (let i = 0; i < 35; i++) { let x = 5 + Math.floor(Math.random() * (MS - 10)), y = 5 + Math.floor(Math.random() * (MS - 10)); if (map[y][x] === 0 && !(x > 10 && x < 20 && y > 10 && y < 20)) map[y][x] = 1; }

// 玩家
let player = { x: 12, y: 12, angle: 0, hp: 100, maxHp: 100, speed: 3.5, sprintMul: 1.7, score: 0, alive: true, bobPhase: 0, recoilOffset: 0, weaponKick: 0 };
let keys = {}, mouseDown = false, gameRunning = false;

// 武器
const weapons = [
  { name: '手枪', ammo: 12, maxAmmo: 12, damage: 25, fireRate: 380, reloadTime: 1400, spread: 0.015, auto: false, color: '#ddd', sfx: sfxShoot, recoil: 8 },
  { name: '冲锋枪', ammo: 30, maxAmmo: 30, damage: 14, fireRate: 75, reloadTime: 1800, spread: 0.07, auto: true, color: '#555', sfx: sfxShoot, recoil: 3 },
  { name: '霰弹枪', ammo: 8, maxAmmo: 8, damage: 20, fireRate: 550, reloadTime: 2200, spread: 0.14, auto: false, color: '#8B4513', pellets: 6, sfx: sfxShotgun, recoil: 18 },
  { name: '狙击枪', ammo: 5, maxAmmo: 5, damage: 95, fireRate: 1100, reloadTime: 2800, spread: 0.003, auto: false, color: '#222', sfx: sfxSniper, recoil: 25 }
];
let currentWeapon = 0, lastShot = 0, reloading = false, reloadStart = 0;

// 实体
let enemies = [], bullets = [], particles = [], muzzleFlash = 0, shellCasings = [];
const MAX_ENEMIES = 10;

function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  let ex, ey, ok = false, tries = 0;
  while (!ok && tries < 50) { tries++; ex = 4 + Math.random() * (MS - 8); ey = 4 + Math.random() * (MS - 8); let dx = ex - player.x, dy = ey - player.y; if (Math.sqrt(dx * dx + dy * dy) > 6 && map[Math.floor(ey)][Math.floor(ex)] === 0) ok = true; }
  if (!ok) return;
  const types = ['grunt', 'grunt', 'grunt', 'heavy', 'fast'];
  const type = types[Math.floor(Math.random() * types.length)];
  const cf = { grunt: { hp: 50, speed: 1.8, damage: 8, color: '#ff6644', size: 1.0, score: 100 }, heavy: { hp: 120, speed: 1.2, damage: 18, color: '#ff2222', size: 1.4, score: 250 }, fast: { hp: 30, speed: 3.5, damage: 5, color: '#ffaa00', size: 0.7, score: 150 } };
  const c = cf[type];
  enemies.push({ x: ex, y: ey, hp: c.hp, maxHp: c.hp, speed: c.speed, damage: c.damage, attackRate: 700, lastAttack: 0, type, color: c.color, size: c.size, score: c.score });
}

function raycast(x0, y0, angle, maxDist = 40) { let dx = Math.cos(angle), dy = Math.sin(angle); for (let d = 0; d < maxDist; d += 0.05) { let tx = Math.floor(x0 + dx * d), ty = Math.floor(y0 + dy * d); if (tx < 0 || ty < 0 || tx >= MS || ty >= MS || map[ty][tx] === 1) return d; } return maxDist; }
function isWall(x, y) { let tx = Math.floor(x), ty = Math.floor(y); return tx < 0 || ty < 0 || tx >= MS || ty >= MS || map[ty][tx] === 1; }

// 键盘
document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'r' && !reloading) startReload(); if (e.key >= '1' && e.key <= '4') switchWeapon(parseInt(e.key) - 1); });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('mousedown', e => { if (e.button === 0) { mouseDown = true; initAudio(); } });
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
document.addEventListener('mousemove', e => { if (gameRunning && document.pointerLockElement) player.angle += (e.movementX || 0) * 0.0025; });
canvas.addEventListener('click', () => { if (gameRunning) canvas.requestPointerLock(); });

// ==================== 触控系统（修复摇杆反转 + 卡顿） ====================
const joystick = document.getElementById('btn-joystick');
const knob = document.getElementById('joystick-knob');
let joystickActive = false, joystickId = null, joystickBase = { x: 0, y: 0 };
let touchMoveX = 0, touchMoveY = 0;

joystick.addEventListener('touchstart', e => {
  e.preventDefault(); e.stopPropagation();
  const t = e.changedTouches[0];
  joystickActive = true; joystickId = t.identifier;
  const rect = joystick.getBoundingClientRect();
  joystickBase = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}, { passive: false });

joystick.addEventListener('touchmove', e => {
  e.preventDefault(); e.stopPropagation();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === joystickId) {
      let dx = t.clientX - joystickBase.x, dy = t.clientY - joystickBase.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 35;
      if (dist > maxDist) { dx = dx / dist * maxDist; dy = dy / dist * maxDist; dist = maxDist; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      // 修复：摇杆方向映射到世界坐标（上=前=cos(angle),sin(angle)）
      touchMoveX = dx / maxDist;
      touchMoveY = dy / maxDist;
    }
  }
}, { passive: false });

const endJoystick = e => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickId) {
      joystickActive = false; joystickId = null;
      knob.style.transform = 'translate(0,0)';
      touchMoveX = 0; touchMoveY = 0;
    }
  }
};
joystick.addEventListener('touchend', endJoystick, { passive: false });
joystick.addEventListener('touchcancel', endJoystick, { passive: false });

// 开火按钮
const btnFire = document.getElementById('btn-fire');
btnFire.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); mouseDown = true; initAudio(); }, { passive: false });
btnFire.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); mouseDown = false; }, { passive: false });
btnFire.addEventListener('touchcancel', e => { mouseDown = false; }, { passive: false });

// 换弹
const btnReload = document.getElementById('btn-reload');
btnReload.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (!reloading) startReload(); }, { passive: false });

// 切换武器
const btnWeapon = document.getElementById('btn-weapon');
btnWeapon.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); switchWeapon((currentWeapon + 1) % weapons.length); }, { passive: false });

// 瞄准（右侧屏幕滑动）
let aimTouchId = null, aimLastX = 0;
canvas.addEventListener('touchstart', e => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.clientX > window.innerWidth / 2 && aimTouchId === null) {
      aimTouchId = t.identifier; aimLastX = t.clientX;
    }
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === aimTouchId) {
      player.angle += (t.clientX - aimLastX) * 0.004;
      aimLastX = t.clientX;
    }
  }
}, { passive: true });
canvas.addEventListener('touchend', e => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === aimTouchId) aimTouchId = null;
  }
}, { passive: true });
canvas.addEventListener('touchcancel', () => { aimTouchId = null; }, { passive: true });

function switchWeapon(i) { if (i >= 0 && i < weapons.length) { currentWeapon = i; reloading = false; document.getElementById('weaponText').textContent = weapons[i].name; } }
function startReload() { let w = weapons[currentWeapon]; if (w.ammo >= w.maxAmmo) return; reloading = true; reloadStart = Date.now(); sfxReload(); }

function shoot() {
  if (!gameRunning || !player.alive || reloading) return;
  let w = weapons[currentWeapon];
  if (w.ammo <= 0) { startReload(); return; }
  let now = Date.now();
  if (now - lastShot < w.fireRate) return;
  lastShot = now; w.ammo--; muzzleFlash = 35;
  player.recoilOffset = w.recoil;
  player.weaponKick = 12;
  w.sfx();
  let pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    let spread = (Math.random() - 0.5) * w.spread;
    let a = player.angle + spread;
    let dist = raycast(player.x, player.y, a);
    bullets.push({ x: player.x, y: player.y, angle: a, dist: dist, damage: w.damage, color: w.color, life: 0 });
  }
  // 弹壳
  shellCasings.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 3 + 2, vy: -3 - Math.random() * 4, life: 600, rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 10 });
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
  let d = document.getElementById('killfeed'), el = document.createElement('div');
  el.className = 'kill-msg'; el.textContent = msg; d.appendChild(el);
  setTimeout(() => el.remove(), 3000);
  if (d.children.length > 5) d.firstChild.remove();
}

function showDamage(dmg) {
  let el = document.getElementById('dmg'); el.textContent = '-' + dmg; el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 150);
}

// 纹理
const wallTex = [];
for (let i = 0; i < 64; i++) { wallTex[i] = []; for (let j = 0; j < 64; j++) wallTex[i][j] = Math.random() * 20 + (i % 8 === 0 || j % 8 === 0 ? 30 : 0); }

// ==================== 主循环 ====================
function update(dt) {
  if (!gameRunning || !player.alive) return;
  dt = Math.min(dt, 50);

  // 移动 - 摇杆方向映射到世界坐标
  let spd = player.speed * (keys['shift'] ? player.sprintMul : 1);
  let mx = 0, my = 0;
  // 触控摇杆：touchMoveY(上/下) -> 前后移动, touchMoveX(左/右) -> 左右平移
  if (Math.abs(touchMoveX) > 0.05 || Math.abs(touchMoveY) > 0.05) {
    // 摇杆Y轴 = 前后（沿视角方向），X轴 = 左右（垂直视角方向）
    mx += Math.cos(player.angle) * (-touchMoveY) * spd;
    my += Math.sin(player.angle) * (-touchMoveY) * spd;
    mx += Math.cos(player.angle - Math.PI / 2) * touchMoveX * spd;
    my += Math.sin(player.angle - Math.PI / 2) * touchMoveX * spd;
  }
  if (keys['w'] || keys['arrowup']) { mx += Math.cos(player.angle) * spd; my += Math.sin(player.angle) * spd; }
  if (keys['s'] || keys['arrowdown']) { mx -= Math.cos(player.angle) * spd; my -= Math.sin(player.angle) * spd; }
  if (keys['a'] || keys['arrowleft']) { mx += Math.cos(player.angle - Math.PI / 2) * spd * 0.7; my += Math.sin(player.angle - Math.PI / 2) * spd * 0.7; }
  if (keys['d'] || keys['arrowright']) { mx += Math.cos(player.angle + Math.PI / 2) * spd * 0.7; my += Math.sin(player.angle + Math.PI / 2) * spd * 0.7; }
  let nx = player.x + mx * dt / 1000, ny = player.y + my * dt / 1000;
  if (!isWall(nx, player.y)) player.x = nx;
  if (!isWall(player.x, ny)) player.y = ny;

  // 呼吸晃动
  player.bobPhase += dt * 0.005;

  // 后坐力衰减
  player.recoilOffset *= 0.85;
  player.weaponKick *= 0.8;

  // 射击
  if (mouseDown) { let w = weapons[currentWeapon]; if (w.auto) shoot(); else if (Date.now() - lastShot >= w.fireRate) shoot(); }

  // 换弹
  if (reloading) { let w = weapons[currentWeapon]; if (Date.now() - reloadStart >= w.reloadTime) { w.ammo = w.maxAmmo; reloading = false; updateHUD(); } }

  // 子弹
  for (let b of bullets) { b.life += dt; b.x = b.x + Math.cos(b.angle) * 120 * dt / 1000; b.y = b.y + Math.sin(b.angle) * 120 * dt / 1000; }
  bullets = bullets.filter(b => b.life < 350);

  // 命中
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    for (let e of enemies) {
      let dx = b.x - e.x, dy = b.y - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.4) {
        e.hp -= b.damage; sfxHit();
        for (let p = 0; p < 6; p++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 250, color: '#f33', size: Math.random() * 3 + 1 });
        bullets.splice(i, 1);
        if (e.hp <= 0) { player.score += e.score; sfxKill(); addKillMsg('击杀 ' + (e.type === 'heavy' ? '重型兵' : e.type === 'fast' ? '疾速兵' : '士兵') + ' +' + e.score); for (let p = 0; p < 15; p++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 400, color: '#f60', size: Math.random() * 4 + 2 }); enemies.splice(enemies.indexOf(e), 1); }
        break;
      }
    }
  }

  // 弹壳
  for (let s of shellCasings) { s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000; s.vy += 15 * dt / 1000; s.life -= dt; s.rot += s.rotV * dt / 1000; }
  shellCasings = shellCasings.filter(s => s.life > 0);

  // 敌人AI
  for (let e of enemies) {
    let dx = player.x - e.x, dy = player.y - e.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.3) { let nx = e.x + dx / dist * e.speed * dt / 1000, ny = e.y + dy / dist * e.speed * dt / 1000; if (!isWall(nx, e.y)) e.x = nx; if (!isWall(e.x, ny)) e.y = ny; }
    if (dist < 1.8 && Date.now() - e.lastAttack > e.attackRate) { player.hp -= e.damage; e.lastAttack = Date.now(); showDamage(e.damage); sfxHit(); updateHUD(); if (player.hp <= 0) gameOver(); }
  }

  // 粒子
  for (let p of particles) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  if (muzzleFlash > 0) muzzleFlash -= dt;
  if (enemies.length < MAX_ENEMIES && Math.random() < 0.025) spawnEnemy();
}

// ==================== 渲染 ====================
function drawPistol(bx, by, kick) {
  const s = 0.7;
  ctx.save(); ctx.translate(bx, by);
  // 后坐力旋转
  ctx.rotate(-kick * 0.03);
  // 枪身
  ctx.fillStyle = '#444'; ctx.fillRect(-10 * s, -30 * s, 20 * s, 55 * s);
  // 滑套
  ctx.fillStyle = '#555'; ctx.fillRect(-9 * s, -28 * s, 18 * s, 40 * s);
  // 枪管
  ctx.fillStyle = '#333'; ctx.fillRect(-4 * s, -45 * s, 8 * s, 20 * s);
  // 扳机护圈
  ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(0, 5 * s, 8 * s, 0, Math.PI); ctx.fill();
  // 握把
  ctx.fillStyle = '#3a2010'; ctx.fillRect(-8 * s, 15 * s, 16 * s, 25 * s);
  // 握把纹理
  ctx.fillStyle = '#4a3020';
  for (let i = 0; i < 5; i++) ctx.fillRect(-7 * s, (17 + i * 5) * s, 14 * s, 2 * s);
  // 准星
  ctx.fillStyle = '#fff'; ctx.fillRect(-1 * s, -48 * s, 2 * s, 5 * s);
  // 照门
  ctx.fillStyle = '#333'; ctx.fillRect(-6 * s, -25 * s, 12 * s, 3 * s);
  ctx.fillStyle = '#222'; ctx.fillRect(-2 * s, -28 * s, 4 * s, 3 * s);
  ctx.restore();
}

function drawSMG(bx, by, kick) {
  const s = 0.7;
  ctx.save(); ctx.translate(bx, by);
  ctx.rotate(-kick * 0.02);
  // 机匣
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-12 * s, -25 * s, 24 * s, 40 * s);
  // 枪管
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-5 * s, -50 * s, 10 * s, 28 * s);
  // 弹匣
  ctx.fillStyle = '#333'; ctx.fillRect(-4 * s, 5 * s, 8 * s, 22 * s);
  // 握把
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6 * s, 15 * s, 12 * s, 18 * s);
  // 枪托
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(8 * s, -10 * s, 20 * s, 8 * s);
  ctx.fillStyle = '#444'; ctx.fillRect(24 * s, -12 * s, 6 * s, 20 * s);
  // 准星
  ctx.fillStyle = '#ff0'; ctx.fillRect(-1 * s, -52 * s, 2 * s, 4 * s);
  // 散热孔
  ctx.fillStyle = '#222';
  for (let i = 0; i < 4; i++) ctx.fillRect(-3 * s, (-38 + i * 6) * s, 6 * s, 2 * s);
  ctx.restore();
}

function drawShotgun(bx, by, kick) {
  const s = 0.7;
  ctx.save(); ctx.translate(bx, by);
  ctx.rotate(-kick * 0.04);
  // 枪身
  ctx.fillStyle = '#5c3a1e'; ctx.fillRect(-10 * s, -20 * s, 20 * s, 50 * s);
  // 双管
  ctx.fillStyle = '#333'; ctx.fillRect(-4 * s, -55 * s, 3 * s, 38 * s);
  ctx.fillStyle = '#333'; ctx.fillRect(1 * s, -55 * s, 3 * s, 38 * s);
  // 护木
  ctx.fillStyle = '#6b4423'; ctx.fillRect(-9 * s, -15 * s, 18 * s, 20 * s);
  // 握把
  ctx.fillStyle = '#4a3020'; ctx.fillRect(-7 * s, 20 * s, 14 * s, 20 * s);
  // 枪托
  ctx.fillStyle = '#5c3a1e'; ctx.fillRect(-8 * s, 35 * s, 16 * s, 15 * s);
  ctx.fillStyle = '#3a2010'; ctx.fillRect(-6 * s, 48 * s, 12 * s, 8 * s);
  // 准星
  ctx.fillStyle = '#ff0'; ctx.fillRect(-1 * s, -58 * s, 2 * s, 5 * s);
  ctx.restore();
}

function drawSniper(bx, by, kick) {
  const s = 0.7;
  ctx.save(); ctx.translate(bx, by);
  ctx.rotate(-kick * 0.05);
  // 枪身
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-8 * s, -15 * s, 16 * s, 60 * s);
  // 枪管
  ctx.fillStyle = '#111'; ctx.fillRect(-3 * s, -65 * s, 6 * s, 55 * s);
  // 瞄准镜
  ctx.fillStyle = '#222'; ctx.fillRect(-6 * s, -20 * s, 12 * s, 15 * s);
  ctx.fillStyle = '#4488ff'; ctx.fillRect(-4 * s, -18 * s, 8 * s, 10 * s);
  ctx.fillStyle = '#88bbff'; ctx.fillRect(-2 * s, -16 * s, 4 * s, 6 * s);
  // 镜座
  ctx.fillStyle = '#333'; ctx.fillRect(-5 * s, -8 * s, 10 * s, 4 * s);
  // 握把
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6 * s, 25 * s, 12 * s, 20 * s);
  // 枪托
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-7 * s, 40 * s, 14 * s, 18 * s);
  ctx.fillStyle = '#111'; ctx.fillRect(-5 * s, 55 * s, 10 * s, 6 * s);
  // 双脚架
  ctx.fillStyle = '#333'; ctx.fillRect(-8 * s, -5 * s, 2 * s, 10 * s);
  ctx.fillRect(6 * s, -5 * s, 2 * s, 10 * s);
  // 准星
  ctx.fillStyle = '#f00'; ctx.fillRect(-0.5 * s, -68 * s, 1 * s, 5 * s);
  ctx.restore();
}

function drawWeapon() {
  let w = weapons[currentWeapon];
  let bobX = Math.sin(player.bobPhase * 2) * 3;
  let bobY = Math.abs(Math.cos(player.bobPhase * 2)) * 4;
  let kickY = player.weaponKick;
  let bx = HW + bobX, by = HH + 45 + bobY + kickY;

  switch (currentWeapon) {
    case 0: drawPistol(bx, by, player.recoilOffset); break;
    case 1: drawSMG(bx, by, player.recoilOffset); break;
    case 2: drawShotgun(bx, by, player.recoilOffset); break;
    case 3: drawSniper(bx, by, player.recoilOffset); break;
  }

  // 弹壳渲染
  for (let s of shellCasings) {
    ctx.save();
    ctx.translate(bx + s.x, by + s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = '#ccaa00';
    ctx.fillRect(-2, -5, 4, 10);
    ctx.fillStyle = '#aa8800';
    ctx.fillRect(-1, -4, 2, 8);
    ctx.restore();
  }
}

function render() {
  W = canvas.width; H = canvas.height; HW = W / 2; HH = H / 2;

  // 天空
  let skyGrad = ctx.createLinearGradient(0, 0, 0, HH);
  skyGrad.addColorStop(0, '#0a0a1a'); skyGrad.addColorStop(0.5, '#111133'); skyGrad.addColorStop(1, '#1a3355');
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, HH);
  ctx.fillStyle = '#111'; ctx.fillRect(0, HH, W, HH);

  const FOV = Math.PI / 3, NUM_RAYS = Math.floor(W / 3);

  // 墙壁
  for (let i = 0; i < NUM_RAYS; i++) {
    let rayAngle = player.angle - FOV / 2 + FOV * i / NUM_RAYS;
    let dist = raycast(player.x, player.y, rayAngle, 40);
    dist *= Math.cos(rayAngle - player.angle);
    let wallH = H / (dist + 0.1) * 1.8;
    let shade = Math.max(0, 1 - dist / 40);
    let hitX = (player.x + Math.cos(rayAngle) * dist) % 1;
    let hitY = (player.y + Math.sin(rayAngle) * dist) % 1;
    let texX = Math.floor(Math.abs(hitX > 0.001 ? hitY : hitX) * 64) % 64;
    let colX = i * 3;
    for (let j = 0; j < wallH && j < H; j++) {
      let texY = Math.floor(j / wallH * 64) % 64;
      let tv = wallTex[texY] ? wallTex[texY][texX] || 50 : 50;
      let r = Math.floor((180 + tv * 0.5) * shade), g = Math.floor((150 + tv * 0.3) * shade), b = Math.floor((120 + tv * 0.2) * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(colX, HH - wallH / 2 + j, 3, 1);
    }
    for (let j = HH + wallH / 2; j < H; j++) {
      let fd = H / (2 * (j - HH) - H) * 2, fs = Math.max(0, 1 - fd / 40);
      ctx.fillStyle = `rgb(${Math.floor(35*fs)},${Math.floor(30*fs)},${Math.floor(25*fs)})`; ctx.fillRect(colX, j, 3, 1);
    }
  }

  // 敌人
  let visibleEnemies = enemies.map(e => {
    let dx = e.x - player.x, dy = e.y - player.y, dist = Math.sqrt(dx * dx + dy * dy);
    let angleTo = Math.atan2(dy, dx), diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    return { e, dist, diff };
  }).filter(v => Math.abs(v.diff) < FOV / 2 && v.dist > 0.2).sort((a, b) => b.dist - a.dist);

  for (let { e, dist, diff } of visibleEnemies) {
    let projX = HW + diff / FOV * W, size = H / (dist + 0.1) * e.size;
    let shade = Math.max(0.3, 1 - dist / 40), sx = projX - size / 2, sy = HH - size / 2;
    // 身体
    ctx.fillStyle = e.color; ctx.fillRect(sx + size * 0.2, sy + size * 0.3, size * 0.6, size * 0.7);
    // 头
    ctx.fillStyle = e.type === 'heavy' ? '#a00' : '#d64';
    ctx.beginPath(); ctx.arc(projX, sy + size * 0.25, size * 0.22, 0, Math.PI * 2); ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff'; ctx.fillRect(projX - size * 0.06, sy + size * 0.2, size * 0.04, size * 0.04);
    ctx.fillRect(projX + size * 0.02, sy + size * 0.2, size * 0.04, size * 0.04);
    // 腿
    ctx.fillStyle = '#333'; ctx.fillRect(sx + size * 0.25, sy + size * 0.9, size * 0.15, size * 0.1);
    ctx.fillRect(sx + size * 0.6, sy + size * 0.9, size * 0.15, size * 0.1);
    // 血条
    if (e.hp < e.maxHp) { ctx.fillStyle = '#400'; ctx.fillRect(sx, sy - 6, size, 3); ctx.fillStyle = '#0f0'; ctx.fillRect(sx, sy - 6, size * (e.hp / e.maxHp), 3); }
  }

  // 枪口火焰
  if (muzzleFlash > 0) {
    let a = muzzleFlash / 35;
    ctx.fillStyle = `rgba(255,200,50,${a * 0.7})`; ctx.beginPath(); ctx.arc(HW, HH + 40, 16 + Math.random() * 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${a * 0.5})`; ctx.beginPath(); ctx.arc(HW, HH + 38, 6 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
  }

  // 武器
  drawWeapon();

  // 粒子
  for (let p of particles) {
    let dx = p.x - player.x, dy = p.y - player.y, dist = Math.sqrt(dx * dx + dy * dy);
    let angleTo = Math.atan2(dy, dx), diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < FOV / 2 && dist > 0.05) {
      let sx = HW + diff / FOV * W, sy = HH - (p.y - player.y) / (dist + 0.1) * H;
      ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 400;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  // 小地图
  mCtx.fillStyle = 'rgba(0,0,0,.7)'; mCtx.fillRect(0, 0, 80, 80);
  let scale = 80 / MS;
  for (let y = 0; y < MS; y++) for (let x = 0; x < MS; x++) if (map[y][x] === 1) { mCtx.fillStyle = '#444'; mCtx.fillRect(x * scale, y * scale, scale, scale); }
  mCtx.fillStyle = '#0f0'; mCtx.beginPath(); mCtx.arc(player.x * scale, player.y * scale, 2.5, 0, Math.PI * 2); mCtx.fill();
  mCtx.strokeStyle = '#0f0'; mCtx.lineWidth = 1; mCtx.beginPath();
  mCtx.moveTo(player.x * scale, player.y * scale); mCtx.lineTo((player.x + Math.cos(player.angle) * 2.5) * scale, (player.y + Math.sin(player.angle) * 2.5) * scale); mCtx.stroke();
  for (let e of enemies) { mCtx.fillStyle = e.color; mCtx.beginPath(); mCtx.arc(e.x * scale, e.y * scale, 1.5, 0, Math.PI * 2); mCtx.fill(); }

  // 换弹
  if (reloading) {
    let progress = (Date.now() - reloadStart) / weapons[currentWeapon].reloadTime;
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('换弹中... ' + Math.floor(progress * 100) + '%', HW, HH + 130);
    ctx.textAlign = 'start';
  }
}

function gameOver() {
  player.alive = false; gameRunning = false; sfxDeath();
  document.exitPointerLock();
  document.getElementById('msg').classList.remove('hidden');
  document.getElementById('msg').innerHTML = '<h1>💀 阵亡</h1><p>击杀: ' + player.score + ' 分</p><button onclick="startGame()">再来一局</button>';
}

let lastTS = 0;
function gameLoop(ts) {
  if (!lastTS) lastTS = ts;
  let dt = ts - lastTS; lastTS = ts;
  update(dt); render();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  initAudio();
  player = { x: 12, y: 12, angle: 0, hp: 100, maxHp: 100, speed: 3.5, sprintMul: 1.7, score: 0, alive: true, bobPhase: 0, recoilOffset: 0, weaponKick: 0 };
  enemies = []; bullets = []; particles = []; shellCasings = [];
  currentWeapon = 0; reloading = false; muzzleFlash = 0;
  for (let i = 0; i < 4; i++) spawnEnemy();
  document.getElementById('msg').classList.add('hidden');
  document.getElementById('weaponText').textContent = '手枪';
  updateHUD(); gameRunning = true;
  try { canvas.requestPointerLock(); } catch (e) { }
}

render(); requestAnimationFrame(gameLoop); updateHUD();