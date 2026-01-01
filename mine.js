// ---------------- SCENE & CAMERA ----------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true, precision:'low'});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---------------- LIGHT ----------------
scene.add(new THREE.AmbientLight(0xffffff,0.6));
const sun = new THREE.DirectionalLight(0xffffff,0.8);
sun.position.set(50,100,50);
scene.add(sun);

// ---------------- BLOCKS ----------------
const blocks = [];
const BLOCK = 1;
const colors = { grass:0x00ff00, dirt:0x8b4513, stone:0x808080 };

// Nutze MeshBasicMaterial für alte Geräte
function addBlock(x,y,z,type){
  const geo = new THREE.BoxGeometry(BLOCK,BLOCK,BLOCK);
  const mat = new THREE.MeshBasicMaterial({color:colors[type]});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x+0.5, y+0.5, z+0.5);
  scene.add(mesh);
  blocks.push({mesh, x,y,z, type});
}

// ---------------- WORLD (klein für alte Geräte) ----------------
for(let x=-5;x<=5;x++){
  for(let z=-5;z<=5;z++){
    addBlock(x,0,z,'grass');
  }
}

// Testwürfel in der Mitte zur Kontrolle
addBlock(0,1,0,'stone');

// ---------------- INVENTORY & HOTBAR ----------------
const inventory = { grass:10, dirt:10, stone:10 };
let selected='grass';
const hotbar = document.getElementById('hotbar');
function updateHotbar(){
  hotbar.innerHTML='';
  for(const k in inventory){
    const b = document.createElement('button');
    b.textContent=`${k} (${inventory[k]})`;
    if(k===selected) b.classList.add('active');
    b.onclick=()=>{selected=k; updateHotbar();};
    hotbar.appendChild(b);
  }
}
updateHotbar();

// ---------------- RAYCAST ----------------
const raycaster = new THREE.Raycaster();
function getTarget(){
  raycaster.setFromCamera({x:0,y:0},camera);
  const hits = raycaster.intersectObjects(blocks.map(b=>b.mesh));
  if(hits.length) return blocks.find(b=>b.mesh===hits[0].object);
  return null;
}

// ---------------- BUILD & MINE ----------------
function build(){
  const t = getTarget();
  if(!t || inventory[selected]<=0) return;

  let x=t.x, z=t.z;
  let y=t.y+1;
  while(blocks.find(b=>b.x===x && b.y===y && b.z===z)) y++;

  addBlock(x,y,z,selected);
  inventory[selected]--;
  updateHotbar();
}

function mine(){
  const t = getTarget();
  if(!t) return;
  scene.remove(t.mesh);
  blocks.splice(blocks.indexOf(t),1);
  inventory[t.type]++;
  updateHotbar();
}

// ---------------- ACTION BUTTONS ----------------
const actionContainer = document.getElementById('action-buttons');
function createActionButton(text, callback){
  const btn = document.createElement('div');
  btn.className='action-btn';
  btn.innerText=text;
  actionContainer.appendChild(btn);
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); callback(); });
}
createActionButton('MINE', mine);
createActionButton('BUILD', build);

// ---------------- PLAYER ----------------
let player = { x:0, y:2, z:5, velocity:new THREE.Vector3(), canJump:true };

// ---------------- COLLISION ----------------
function checkCollisions(pos){
  for(const b of blocks){
    if(pos.x+0.3>b.x && pos.x-0.3<b.x+1 &&
       pos.y < b.y+1 && pos.y+1.8 > b.y &&
       pos.z+0.3>b.z && pos.z-0.3<b.z+1){
         return true;
    }
  }
  return false;
}

// ---------------- JOYSTICK ----------------
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
let joystickActive = false;
let joystickPos = {x:0,y:0};

joystickKnob.addEventListener('touchstart', e=>{ e.preventDefault(); joystickActive=true; });
joystickKnob.addEventListener('touchend', e=>{ e.preventDefault(); joystickActive=false; joystickPos={x:0,y:0}; joystickKnob.style.left='30px'; joystickKnob.style.top='30px'; });
joystickKnob.addEventListener('touchmove', e=>{
  if(!joystickActive) return;
  const touch = e.touches[0];
  const rect = joystickBase.getBoundingClientRect();
  let x = touch.clientX - rect.left - rect.width/2;
  let y = touch.clientY - rect.top - rect.height/2;
  const max = rect.width/2 - 30;
  const len = Math.sqrt(x*x+y*y);
  if(len>max){ x=x/max*max; y=y/max*max; }
  joystickPos = {x: x/max, y: -y/max};
  joystickKnob.style.left=`${30+x}px`;
  joystickKnob.style.top=`${30+y}px`;
});

// ---------------- JUMP BUTTON ----------------
const jumpBtn = document.getElementById('jump-btn');
jumpBtn.addEventListener('touchstart', e=>{
  e.preventDefault();
  if(player.canJump){ player.velocity.y=7; player.canJump=false; }
});

// ---------------- ANIMATION ----------------
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const speed = 5;

  // Joystick movement
  const forward = joystickPos.y;
  const right = joystickPos.x;

  const dir = new THREE.Vector3(0,0,-1);
  const side = new THREE.Vector3(1,0,0);

  player.velocity.x += (dir.x*forward + side.x*right)*speed*delta;
  player.velocity.z += (dir.z*forward + side.z*right)*speed*delta;

  // Gravity
  player.velocity.y -= 9.8*delta;

  const pos = new THREE.Vector3(player.x, player.y, player.z);
  pos.addScaledVector(player.velocity, delta);

  if(checkCollisions(pos)){
    player.velocity.x=0; player.velocity.z=0;
    player.velocity.y=Math.min(0,player.velocity.y);
  } else {
    player.x=pos.x; player.y=pos.y; player.z=pos.z;
  }

  if(player.y<2){ player.velocity.y=0; player.y=2; player.canJump=true; }

  camera.position.set(player.x, player.y, player.z);
  camera.lookAt(player.x, player.y, player.z-1);

  player.velocity.multiplyScalar(0.9);
  renderer.render(scene,camera);
}
animate();
