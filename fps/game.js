// ==================== FPS Arena - 核心引擎 ====================
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const mCanvas=document.getElementById('minimapCanvas'),mCtx=mCanvas.getContext('2d');
canvas.width=window.innerWidth;canvas.height=window.innerHeight;
const W=canvas.width,H=canvas.height,HW=W/2,HH=H/2;

// 地图 (80x80, 0=空地,1=墙)
const MS=80;
const map=[];
for(let y=0;y<MS;y++){map[y]=[];for(let x=0;x<MS;x++){map[y][x]=(y===0||y===MS-1||x===0||x===MS-1)?1:0}}
// 随机障碍物
for(let i=0;i<120;i++){let x=Math.floor(Math.random()*(MS-10))+5,y=Math.floor(Math.random()*(MS-10))+5;if(x>10&&y>10)map[y][x]=1}

// 玩家
let player={x:15,y:15,angle:0,hp:100,maxHp:100,speed:4,sprintMul:1.8,score:0,alive:true};
let keys={},mouseDown=false,gameRunning=false;

// 武器系统
const weapons=[
  {name:'手枪',ammo:12,maxAmmo:12,damage:25,fireRate:400,reloadTime:1500,spread:0.02,auto:false,color:'#ff0'},
  {name:'冲锋枪',ammo:30,maxAmmo:30,damage:12,fireRate:80,reloadTime:2000,spread:0.08,auto:true,color:'#0ff'},
  {name:'霰弹枪',ammo:8,maxAmmo:8,damage:18,fireRate:600,reloadTime:2500,spread:0.15,auto:false,color:'#f80',pellets:6},
  {name:'狙击枪',ammo:5,maxAmmo:5,damage:90,fireRate:1200,reloadTime:3000,spread:0.005,auto:false,color:'#f0f'}
];
let currentWeapon=0,lastShot=0,reloading=false,reloadStart=0;

// 敌人
let enemies=[];
const MAX_ENEMIES=8;
function spawnEnemy(){
  if(enemies.length>=MAX_ENEMIES)return;
  let ex,ey,ok=false;
  while(!ok){ex=5+Math.random()*(MS-10);ey=5+Math.random()*(MS-10);let dx=ex-player.x,dy=ey-player.y;if(Math.sqrt(dx*dx+dy*dy)>8&&map[Math.floor(ey)][Math.floor(ex)]===0)ok=true}
  enemies.push({x:ex,y:ey,hp:50,maxHp:50,speed:1.5+Math.random()*1.5,damage:8,attackRate:800,lastAttack:0,type:Math.random()<.3?'heavy':'normal',color:Math.random()<.3?'#f44':'#f80'});
}

// 子弹/弹道
let bullets=[],particles=[],muzzleFlash=0;

// 射线检测
function raycast(x0,y0,angle,maxDist=50){
  let dx=Math.cos(angle),dy=Math.sin(angle);
  for(let d=0;d<maxDist;d+=0.1){
    let tx=Math.floor(x0+dx*d),ty=Math.floor(y0+dy*d);
    if(tx<0||ty<0||tx>=MS||ty>=MS||map[ty][tx]===1)return d;
  }
  return maxDist;
}

// 碰撞检测
function isWall(x,y){let tx=Math.floor(x),ty=Math.floor(y);return tx<0||ty<0||tx>=MS||ty>=MS||map[ty][tx]===1}

// 输入
document.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='r'&&!reloading)startReload();if(e.key>='1'&&e.key<='4')switchWeapon(parseInt(e.key)-1)});
document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
document.addEventListener('mousedown',e=>{if(e.button===0)mouseDown=true});
document.addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false});
document.addEventListener('mousemove',e=>{if(gameRunning)player.angle+=(e.movementX||0)*0.003});
canvas.addEventListener('click',()=>canvas.requestPointerLock());
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas&&gameRunning)document.exitPointerLock()});

function switchWeapon(i){if(i>=0&&i<weapons.length){currentWeapon=i;reloading=false;document.getElementById('weaponText').textContent=weapons[i].name}}
function startReload(){let w=weapons[currentWeapon];if(w.ammo>=w.maxAmmo)return;reloading=true;reloadStart=Date.now()}

function shoot(){
  if(!gameRunning||!player.alive||reloading)return;
  let w=weapons[currentWeapon];
  if(w.ammo<=0){startReload();return}
  let now=Date.now();
  if(now-lastShot<w.fireRate)return;
  lastShot=now;w.ammo--;muzzleFlash=50;
  let pellets=w.pellets||1;
  for(let i=0;i<pellets;i++){
    let spread=(Math.random()-.5)*w.spread;
    let a=player.angle+spread;
    let dist=raycast(player.x,player.y,a);
    bullets.push({x:player.x,y:player.y,angle:a,dist:dist,damage:w.damage,color:w.color,life:0});
  }
  updateHUD();
}

function updateHUD(){
  let w=weapons[currentWeapon];
  document.getElementById('hpText').textContent=Math.max(0,Math.floor(player.hp));
  document.getElementById('hpBar').style.width=(player.hp/player.maxHp*100)+'%';
  document.getElementById('ammoText').textContent=w.ammo;
  document.getElementById('ammoMax').textContent=w.maxAmmo;
  document.getElementById('ammoBar').style.width=(w.ammo/w.maxAmmo*100)+'%';
  document.getElementById('scoreText').textContent=player.score;
}

function addKillMsg(msg){
  let d=document.getElementById('killfeed');
  let el=document.createElement('div');el.className='kill-msg';el.textContent=msg;
  d.appendChild(el);
  setTimeout(()=>el.remove(),3000);
  if(d.children.length>5)d.firstChild.remove();
}

function showDamage(dmg){
  let el=document.getElementById('dmg');
  el.textContent='-'+dmg;el.style.opacity='1';
  setTimeout(()=>el.style.opacity='0',150);
}

// 主循环
function update(dt){
  if(!gameRunning||!player.alive)return;
  dt=Math.min(dt,50);
  // 移动
  let spd=player.speed*(keys['shift']?player.sprintMul:1);
  let mx=0,my=0;
  if(keys['w']||keys['arrowup']){mx+=Math.cos(player.angle)*spd;my+=Math.sin(player.angle)*spd}
  if(keys['s']||keys['arrowdown']){mx-=Math.cos(player.angle)*spd;my-=Math.sin(player.angle)*spd}
  if(keys['a']||keys['arrowleft']){mx+=Math.cos(player.angle-Math.PI/2)*spd*0.7;my+=Math.sin(player.angle-Math.PI/2)*spd*0.7}
  if(keys['d']||keys['arrowright']){mx+=Math.cos(player.angle+Math.PI/2)*spd*0.7;my+=Math.sin(player.angle+Math.PI/2)*spd*0.7}
  let nx=player.x+mx*dt/1000,ny=player.y+my*dt/1000;
  if(!isWall(nx,player.y))player.x=nx;
  if(!isWall(player.x,ny))player.y=ny;

  // 射击
  if(mouseDown){let w=weapons[currentWeapon];if(w.auto)shoot();else if(Date.now()-lastShot>=w.fireRate)shoot()}
  if(!mouseDown&&!weapons[currentWeapon].auto){/* 单发模式不自动射击 */}

  // 换弹
  if(reloading){let w=weapons[currentWeapon];if(Date.now()-reloadStart>=w.reloadTime){w.ammo=w.maxAmmo;reloading=false;updateHUD()}}

  // 子弹
  for(let b of bullets){b.life+=dt;b.x=b.x+Math.cos(b.angle)*80*dt/1000;b.y=b.y+Math.sin(b.angle)*80*dt/1000}
  bullets=bullets.filter(b=>b.life<500);

  // 子弹命中敌人
  for(let i=bullets.length-1;i>=0;i--){
    let b=bullets[i];
    for(let e of enemies){
      let dx=b.x-e.x,dy=b.y-e.y;
      if(Math.sqrt(dx*dx+dy*dy)<0.5){
        e.hp-=b.damage;
        for(let p=0;p<5;p++)particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,life:300,color:'#f00'});
        bullets.splice(i,1);
        if(e.hp<=0){player.score+=e.type==='heavy'?200:100;addKillMsg('击杀 '+ (e.type==='heavy'?'重型兵':'士兵') +' +'+(e.type==='heavy'?200:100));enemies.splice(enemies.indexOf(e),1)}
        break;
      }
    }
  }

  // 敌人AI
  for(let e of enemies){
    let dx=player.x-e.x,dy=player.y-e.y,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>0.5){let nx=e.x+dx/dist*e.speed*dt/1000,ny=e.y+dy/dist*e.speed*dt/1000;if(!isWall(nx,e.y))e.x=nx;if(!isWall(e.x,ny))e.y=ny}
    if(dist<1.5&&Date.now()-e.lastAttack>e.attackRate){player.hp-=e.damage;e.lastAttack=Date.now();showDamage(e.damage);updateHUD();if(player.hp<=0)gameOver()}
  }

  // 粒子
  for(let p of particles){p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.life-=dt}
  particles=particles.filter(p=>p.life>0);

  // 枪口火焰
  if(muzzleFlash>0)muzzleFlash-=dt;

  // 生成敌人
  if(enemies.length<MAX_ENEMIES&&Math.random()<0.02)spawnEnemy();
}

// 渲染 (伪3D射线投射)
function render(){
  ctx.fillStyle='#222';ctx.fillRect(0,0,W,HH);
  ctx.fillStyle='#333';ctx.fillRect(0,HH,W,HH);

  // 射线投射渲染墙壁
  const FOV=Math.PI/3,NUM_RAYS=W/2;
  for(let i=0;i<NUM_RAYS;i++){
    let rayAngle=player.angle-FOV/2+FOV*i/NUM_RAYS;
    let dist=raycast(player.x,player.y,rayAngle,40);
    // 鱼眼修正
    dist*=Math.cos(rayAngle-player.angle);
    let wallH=H/(dist+0.1)*2;
    let shade=1-Math.min(dist/40,1);
    let r=Math.floor(180*shade),g=Math.floor(160*shade),b=Math.floor(140*shade);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.fillRect(i*2,HH-wallH/2,2,wallH);
    // 地板
    ctx.fillStyle=`rgb(${Math.floor(40*shade)},${Math.floor(35*shade)},${Math.floor(30*shade)})`;
    ctx.fillRect(i*2,HH+wallH/2,2,HH);
  }

  // 敌人渲染
  for(let e of enemies){
    let dx=e.x-player.x,dy=e.y-player.y;
    let dist=Math.sqrt(dx*dx+dy*dy);
    let angleToEnemy=Math.atan2(dy,dx);
    let angleDiff=angleToEnemy-player.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;
    if(Math.abs(angleDiff)<FOV/2&&dist>0.3){
      let projX=HW+angleDiff/FOV*W;
      let size=H/(dist+0.1)*1.5;
      let shade=1-Math.min(dist/40,1);
      ctx.fillStyle=e.color;
      ctx.fillRect(projX-size/2,HH-size/2,size,size);
      // 血条
      if(e.hp<e.maxHp){
        ctx.fillStyle='#f00';ctx.fillRect(projX-size/2,HH-size/2-8,size,4);
        ctx.fillStyle='#0f0';ctx.fillRect(projX-size/2,HH-size/2-8,size*(e.hp/e.maxHp),4);
      }
    }
  }

  // 枪口火焰
  if(muzzleFlash>0){
    ctx.fillStyle='rgba(255,200,50,0.6)';
    ctx.beginPath();ctx.arc(HW,HH+40,15+Math.random()*10,0,Math.PI*2);ctx.fill();
  }

  // 武器模型
  let w=weapons[currentWeapon];
  ctx.fillStyle='#444';
  ctx.fillRect(HW-15,HH+30,30,80);
  ctx.fillStyle='#333';
  ctx.fillRect(HW-5,HH+20,10,30);
  ctx.fillStyle=w.color;
  ctx.fillRect(HW-3,HH+15,6,15);

  // 粒子
  for(let p of particles){
    let dx=p.x-player.x,dy=p.y-player.y,dist=Math.sqrt(dx*dx+dy*dy);
    let angleToP=Math.atan2(dy,dx),angleDiff=angleToP-player.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;
    if(Math.abs(angleDiff)<FOV/2&&dist>0.1){
      let sx=HW+angleDiff/FOV*W,sy=HH-(p.y-player.y)/(dist+0.1)*H;
      ctx.fillStyle=p.color;ctx.globalAlpha=p.life/300;
      ctx.fillRect(sx-2,sy-2,4,4);
      ctx.globalAlpha=1;
    }
  }

  // 小地图
  mCtx.fillStyle='rgba(0,0,0,.7)';mCtx.fillRect(0,0,100,100);
  let scale=100/MS;
  for(let y=0;y<MS;y++)for(let x=0;x<MS;x++)if(map[y][x]===1){mCtx.fillStyle='#555';mCtx.fillRect(x*scale,y*scale,scale,scale)}
  mCtx.fillStyle='#0f0';mCtx.beginPath();mCtx.arc(player.x*scale,player.y*scale,3,0,Math.PI*2);mCtx.fill();
  mCtx.strokeStyle='#0f0';mCtx.beginPath();mCtx.moveTo(player.x*scale,player.y*scale);mCtx.lineTo((player.x+Math.cos(player.angle)*3)*scale,(player.y+Math.sin(player.angle)*3)*scale);mCtx.stroke();
  for(let e of enemies){mCtx.fillStyle='#f00';mCtx.beginPath();mCtx.arc(e.x*scale,e.y*scale,2,0,Math.PI*2);mCtx.fill()}

  // 换弹提示
  if(reloading){
    let progress=(Date.now()-reloadStart)/weapons[currentWeapon].reloadTime;
    ctx.fillStyle='#fff';ctx.font='16px monospace';
    ctx.fillText('换弹中... '+Math.floor(progress*100)+'%',HW-50,HH+100);
  }
}

function gameOver(){
  player.alive=false;gameRunning=false;
  document.exitPointerLock();
  document.getElementById('msg').classList.remove('hidden');
  document.getElementById('msg').innerHTML='<h1>💀 阵亡</h1><p>击杀: '+player.score+' 分</p><button onclick="startGame()">再来一局</button>';
}

function gameLoop(ts){
  if(!lastTS)lastTS=ts;
  let dt=ts-lastTS;lastTS=ts;
  update(dt);render();
  requestAnimationFrame(gameLoop);
}
let lastTS=0;

function startGame(){
  player={x:15,y:15,angle:0,hp:100,maxHp:100,speed:4,sprintMul:1.8,score:0,alive:true};
  enemies=[];bullets=[];particles=[];currentWeapon=0;reloading=false;muzzleFlash=0;
  for(let i=0;i<3;i++)spawnEnemy();
  document.getElementById('msg').classList.add('hidden');
  document.getElementById('weaponText').textContent='手枪';
  updateHUD();
  gameRunning=true;
  canvas.requestPointerLock();
}

// 初始渲染
render();
requestAnimationFrame(gameLoop);
updateHUD();