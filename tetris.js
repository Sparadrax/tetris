/**
 * Tetris game. A standalone rules engine tracks the board, active piece, score, and timers; the page maps input to engine actions.
 */
import * as THREE from 'three';
import { Tetris, SHAPES } from './engine.mjs';

const view=document.getElementById('tetris-view');
const game=new Tetris();let started=false,paused=false;
const palette=getComputedStyle(document.documentElement);
/**
 * Read a named value from the shared CSS palette.
 *
 * @param key - Shared CSS custom-property name to read.
 * @returns CSS palette value as a trimmed string.
 */
const theme=(key)=>palette.getPropertyValue(key).trim();
const colors={I:'#72ddd0',O:'#f0cd6b',T:'#b5a4f4',S:'#83cf8e',Z:'#e77888',J:'#7cacf3',L:'#e8a767'};
const scene=new THREE.Scene();scene.background=new THREE.Color(theme('--site-bg'));
const camera=new THREE.OrthographicCamera(0,10,20,0,.1,100);camera.position.set(0,0,30);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}
catch(error){const message=document.getElementById('scene-error');message.hidden=false;message.textContent='Unable to start Tetris. Please enable WebGL in your browser.';throw error;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.domElement.setAttribute('aria-label','Tetris board, 10 columns by 20 rows');view.prepend(renderer.domElement);
const materials=Object.fromEntries(Object.entries(colors).map(([type,color])=>[type,new THREE.MeshBasicMaterial({color})]));
const blockGeometry=new THREE.BoxGeometry(.92,.92,.2);
const ghostGeometry=new THREE.EdgesGeometry(blockGeometry);
const ghostMaterial=new THREE.LineBasicMaterial({color:theme('--site-accent'),transparent:true,opacity:.6});
const blocks=Array.from({length:204},()=>{const mesh=new THREE.Mesh(blockGeometry,materials.I);mesh.visible=false;scene.add(mesh);return mesh;});
const ghostBlocks=Array.from({length:4},()=>{const mesh=new THREE.LineSegments(ghostGeometry,ghostMaterial);mesh.visible=false;scene.add(mesh);return mesh;});
const points=[];for(let x=0;x<=10;x++)points.push(x,0,-.2,x,20,-.2);for(let y=0;y<=20;y++)points.push(0,y,-.2,10,y,-.2);
const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));scene.add(new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:theme('--site-border'),transparent:true,opacity:.45})));
const overlay=document.getElementById('game-overlay'),status=document.getElementById('game-status'),pauseButton=document.getElementById('pause');
/**
 * Draw held/upcoming piece shapes in their small 2D preview canvases.
 *
 * @param id - DOM element identifier used to find its control or canvas.
 * @param types - Piece type identifiers to display in the preview slots.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function preview(id,types){
    const canvas=document.getElementById(id),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    types.forEach((type,index)=>{
        if(!type)return;const cells=[];SHAPES[type].forEach((row,y)=>row.forEach((cell,x)=>{if(cell)cells.push([x,y]);}));
        const minX=Math.min(...cells.map(p=>p[0])),maxX=Math.max(...cells.map(p=>p[0])),minY=Math.min(...cells.map(p=>p[1]));
        const size=22,offset=(canvas.width-(maxX-minX+1)*size)/2;
        ctx.fillStyle=colors[type];for(const [x,y]of cells)ctx.fillRect(offset+(x-minX)*size,14+index*70+(y-minY)*size,size-2,size-2);
    });
    canvas.setAttribute('aria-label',types.filter(Boolean).join(', ')||'Empty hold slot');
}
/**
 * Reuse board meshes and ghost outlines, then refresh score, previews, and overlays.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function render(){
    let count=0;
    /**
     * Place one occupied board cell using the next reusable block mesh.
     *
     * @param type - Piece type to spawn, or the type of block being drawn.
     * @param x - Zero-based board column.
     * @param y - Zero-based board row; negative rows are not drawn.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    function block(type,x,y){if(y<0)return;const mesh=blocks[count++];mesh.material=materials[type];mesh.position.set(x+.5,19.5-y,0);mesh.visible=true;}
    game.board.forEach((row,y)=>row.forEach((type,x)=>{if(type)block(type,x,y);}));
    ghostBlocks.forEach(mesh=>{mesh.visible=false;});
    if(!game.over){
        let i=0;const ghost=game.ghost();ghost.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell&&ghost.y+y>=0){const mesh=ghostBlocks[i++];mesh.position.set(ghost.x+x+.5,19.5-ghost.y-y,.02);mesh.visible=true;}}));
        game.active.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)block(game.active.type,game.active.x+x,game.active.y+y);}));
    }
    for(let i=count;i<blocks.length;i++)blocks[i].visible=false;
    document.getElementById('score').textContent=game.score.toLocaleString();document.getElementById('level').textContent=game.level;document.getElementById('lines').textContent=game.lines;
    preview('hold-preview',[game.held]);preview('next-preview',game.queue.slice(0,3));
    status.textContent=game.over?'Game over':!started?'Ready':paused?'Paused':'Playing';
    overlay.hidden=started&&!paused&&!game.over;
    document.getElementById('overlay-title').textContent=game.over?'Game over':!started?'Ready to play?':'Paused';
    document.getElementById('overlay-message').textContent=game.over?`Final score: ${game.score.toLocaleString()}`:!started?'Complete rows to score points.':'Your game is waiting.';
    document.getElementById('overlay-action').textContent=game.over?'Play again':!started?'Start game':'Resume';
    pauseButton.disabled=!started||game.over;pauseButton.textContent=paused?'Resume':'Pause';
}
/**
 * Reset engine state and begin active play.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function restart(){game.reset();started=true;paused=false;render();}
/**
 * Toggle playback only after starting and before game over.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function pause(){if(!started||game.over)return;paused=!paused;render();}
/**
 * Translate a named keyboard/touch action into the corresponding engine operation.
 *
 * @param name - Named game action such as left, right, rotate, drop, or hold.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function action(name){
    if(!started||paused||game.over)return;
    if(name==='left')game.move(-1);else if(name==='right')game.move(1);else if(name==='down')game.down(true);else if(name==='rotate')game.rotate();else if(name==='counter')game.rotate(false);else if(name==='drop')game.hardDrop();else if(name==='hold')game.hold();render();
}
document.getElementById('overlay-action').addEventListener('click',()=>{if(!started||game.over)restart();else{paused=false;render();}});
document.getElementById('restart').addEventListener('click',restart);pauseButton.addEventListener('click',pause);
const keys={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'counter',Space:'drop',KeyC:'hold'};
document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,button,a')||event.target.isContentEditable)return;
    if(event.code==='KeyP'||event.code==='Escape'){if(!event.repeat)pause();return;}
    const name=keys[event.code];if(!name)return;event.preventDefault();
    if(event.repeat&&!['left','right','down'].includes(name))return;action(name);
});
let touchTimer=null,touchDelay=null;
/**
 * Cancel delayed/repeating touch movement when the gesture ends.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function stopTouch(){clearInterval(touchTimer);clearTimeout(touchDelay);touchTimer=touchDelay=null;}
document.querySelectorAll('[data-action]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();stopTouch();button.setPointerCapture(event.pointerId);const name=button.dataset.action;action(name);
        if(['left','right','down'].includes(name))touchDelay=setTimeout(()=>{touchTimer=setInterval(()=>action(name),65);},180);
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,stopTouch);
    button.addEventListener('click',event=>{if(event.detail===0)action(button.dataset.action);});
});
/**
 * Stop touch repetition and pause when the page loses focus or visibility.
 *
 * Inputs: None; uses enclosing state where needed.
 * @returns No value is returned; updates the current state, scene, or interface.
 */
function autoPause(){stopTouch();if(started&&!game.over){paused=true;render();}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});window.addEventListener('blur',autoPause);
// Recalculate view dimensions when the surrounding layout changes.
new ResizeObserver(()=>renderer.setSize(Math.max(view.clientWidth,1),Math.max(view.clientHeight,1))).observe(view);
render();let last;
// Keep visual frames separate from the simulation's own update timing.
renderer.setAnimationLoop(time=>{const delta=last===undefined?0:Math.min(time-last,100);last=time;if(started&&!paused&&!game.over){game.tick(delta);render();}renderer.render(scene,camera);});
