(function(root){
'use strict';
const ROSTERS={};
const GROUPS={};
const FORMAT='one-turn-v4';
const MAX_PLAYERS=10;
const isRoom=id=>typeof id==='string'&&/^play-[a-f0-9]{32}$/.test(id);
const validClass=id=>Object.hasOwn(ROSTERS,id)||isRoom(id);
const ITEMS={spring:{label:'Spring',photo:'spring',icon:'🌸'},summer:{label:'Summer',photo:'summer',icon:'🎆'},autumn:{label:'Autumn',photo:'autumn',icon:'🍁'},winter:{label:'Winter',photo:'winter',icon:'❄️'},islands:{label:'Islands',photo:'islands',icon:'🏝️'},asia:{label:'Asia',map:'asia'},africa:{label:'Africa',map:'africa'},america:{label:'North America',map:'north-america'},sun:{label:'Sun',icon:'☀️'},moon:{label:'Moon',icon:'🌙'},star:{label:'Star',icon:'⭐'},flag:{label:'Japan',icon:'🇯🇵'},blueflag:{label:'Blue',icon:'🔵'},greenflag:{label:'Green',icon:'🟩'},red:{label:'Red',color:'#dc6354',icon:'🔴'},white:{label:'White',color:'#fffdf7',icon:'⚪'},blue:{label:'Blue',color:'#77acd3',icon:'🔵'},yellow:{label:'Yellow',color:'#f3c755',icon:'🟡'},green:{label:'Green',color:'#7dac75',icon:'🟢'},pink:{label:'Pink',color:'#efadc8',icon:'🌸'},blossom:{label:'Cherry blossoms',icon:'🌸'},fireworks:{label:'Fireworks',icon:'🎆'},goldfirework:{label:'Gold fireworks',icon:'🎇'},redleaf:{label:'Red leaves',icon:'🍁'},yellowleaf:{label:'Yellow leaves',icon:'🍂'},snow:{label:'Snow',icon:'❄️'},ski:{label:'Ski',icon:'⛷️'},swim:{label:'Swim',icon:'🏊'},bike:{label:'Bike',icon:'🚲'},circle:{label:'Circle',icon:'🔴'},triangle:{label:'Triangle',icon:'🔺'},square:{label:'Square',icon:'🟥'}};
const FACTS={spring:'In spring, we can see pink cherry blossoms.',summer:'In summer, we can watch fireworks.',autumn:'In autumn, we can see red and yellow leaves.',winter:'In winter, we can ski. Snow, snow, snow!',islands:'Japan has many islands. Japan is in Asia.',flag:'The flag is white and red. The red circle is the sun.'};
const MISSIONS=[];
function quiz(id,title,prompt,answer,options,topic,fact){MISSIONS.push({id,family:'quiz',type:'quiz',title,prompt,answer,options,topic,fact:fact||FACTS[topic]})}
quiz('q-islands','Find the islands.','Japan has many islands. Can you find the islands?','islands',['islands','spring','winter'],'islands');
quiz('q-asia','Where is Japan?','Where is Japan? Japan is in Asia. Find Asia.','asia',['asia','africa','america'],'islands','Japan is in Asia. Taiwan is in Asia, too.');
quiz('q-sun','What is the red circle?','Look at the flag. The red circle is the sun. Find the sun.','sun',['sun','moon','star'],'flag');
quiz('q-white','Find the background color.','Look at the flag. What color is the background?','white',['white','blue','yellow'],'flag');
quiz('q-red','Find the circle color.','Look at the flag. What color is the circle?','red',['red','blue','green'],'flag');
quiz('q-flag','Find Japan’s flag.','Which flag is white with a red circle? Find the flag of Japan.','flag',['flag','blueflag','greenflag'],'flag');
quiz('q-spring','Which season has blossoms?','Pink cherry blossoms! Which season is it?','spring',['spring','summer','winter'],'spring');
quiz('q-summer','Which season has fireworks?','Boom, boom! We can watch fireworks. Which season is it?','summer',['summer','spring','autumn'],'summer');
quiz('q-autumn','Which season has red leaves?','Red and yellow leaves! Which season is it?','autumn',['autumn','summer','winter'],'autumn');
quiz('q-winter','Which season has snow?','It is cold. Snow, snow, snow! Which season is it?','winter',['winter','spring','summer'],'winter');
quiz('q-ski','What can we do in winter?','In winter, what can we do? Can we ski? Find skiing.','ski',['ski','swim','bike'],'winter');
quiz('q-pink','What color are the blossoms?','Look at the cherry blossoms. Find pink.','pink',['pink','blue','green'],'spring');
quiz('q-yellow','Find a yellow leaf.','Help Maru find a yellow leaf for autumn.','yellowleaf',['yellowleaf','blossom','snow'],'autumn');
quiz('q-fireworks','What can we watch?','In summer, we can watch something in the sky. Find fireworks.','fireworks',['fireworks','snow','redleaf'],'summer');
quiz('q-circle','Find the shape.','Look at the red shape on the flag. Find a circle.','circle',['circle','triangle','square'],'flag');
const mazeTargets=['spring','summer','autumn','winter','sun','islands','blossom','fireworks'];
mazeTargets.forEach((target,i)=>{let topic=['spring','summer','autumn','winter','flag','islands','spring','summer'][i];let options=target==='sun'?['sun','moon','star']:target==='islands'?['islands','sun','winter']:target==='blossom'?['blossom','snow','redleaf']:target==='fireworks'?['fireworks','snow','blossom']:['spring','summer','autumn','winter'].filter(x=>x!==target).slice(0,2).concat(target);MISSIONS.push({id:'maze-'+target,family:'maze',type:'maze',topic,target,options,title:'Help Maru find '+ITEMS[target].label.toLowerCase()+'.',prompt:'Let’s help Maru! Use the arrows to walk through the maze. Find '+ITEMS[target].label.toLowerCase()+'.',fact:FACTS[topic]})});
const combinations=[['spring','summer','autumn'],['spring','summer','winter'],['spring','autumn','winter'],['summer','autumn','winter'],['spring','flag','winter'],['summer','flag','islands'],['autumn','islands','spring'],['winter','islands','summer'],['flag','autumn','winter'],['islands','flag','spring'],['summer','flag','autumn'],['winter','flag','islands']];
const FEATURES={spring:'blossom',summer:'fireworks',autumn:'redleaf',winter:'ski',flag:'sun',islands:'asia'};
combinations.forEach((keys,i)=>MISSIONS.push({id:'match-'+i,family:'match',type:'match',topic:'mixed',keys,title:'Make three pairs.',prompt:'Match '+keys.map(k=>ITEMS[k].label.toLowerCase()).join(', ')+'. Tap a picture on the left. Then tap its partner on the right.',fact:'Well done! You matched all three pairs.'}));
const crafts=[['spring',Array(3).fill('blossom'),'Add three cherry blossoms.'],['spring',Array(4).fill('blossom'),'Make a pink spring garden.'],['summer',Array(3).fill('fireworks'),'Light up the summer sky.'],['summer',['goldfirework','fireworks','goldfirework'],'Add gold and colorful fireworks.'],['autumn',['redleaf','yellowleaf','redleaf'],'Add two red leaves and one yellow leaf.'],['autumn',['yellowleaf','redleaf','yellowleaf'],'Add two yellow leaves and one red leaf.'],['winter',Array(3).fill('snow'),'Make a snowy winter.'],['winter',['snow','ski','snow'],'Add snow and skis.']];
crafts.forEach(([season,recipe,title],i)=>MISSIONS.push({id:'decorate-'+i,family:'craft',type:'decorate',topic:season,season,recipe,title,prompt:title+' Tap a decoration, then tap a glowing spot. You can also drag it to the spot.',fact:FACTS[season]}));
['whole','circle','background'].forEach((part,i)=>MISSIONS.push({id:'flag-'+part,family:'craft',type:'flag',topic:'flag',part,title:['Build Japan’s flag.','Paint the red circle.','Paint the white background.'][i],prompt:['Let’s make Japan’s flag! Choose white for the background. Then choose red for the circle.','The flag needs a circle. Choose red, then tap the circle.','The flag needs a background. Choose white, then tap the background.'][i],fact:FACTS.flag}));
['spring','summer','autumn','winter'].forEach(season=>MISSIONS.push({id:'spot-'+season,family:'quiz',type:'spot',topic:season,season,title:'Find Maru’s red circle.',prompt:'Maru is in '+season+'. Look carefully. Tap the red circle on Maru’s back.',fact:'You found Maru! A white cat with a red circle.'}));
// Short, naturally spoken instructions; full explanations stay on screen.
for(const m of MISSIONS){
 m.prompt=m.title;
 if(m.type==='match')m.prompt='Match the pictures.';
 if(m.type==='maze')m.title=m.prompt='Help Maru find '+({sun:'the sun',islands:'the islands',blossom:'cherry blossoms',fireworks:'fireworks'}[m.target]||m.target)+'.';
 if(m.type==='spot')m.prompt="Find Maru’s red circle.";
}
const BY_ID=Object.fromEntries(MISSIONS.map(m=>[m.id,m]));
function shuffle(list,rng=Math.random){let a=[...list];for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const MAZE_EXITS=[{x:9,y:1},{x:9,y:3},{x:9,y:5}];
function makeMaze(rng=Math.random){
 const grid=Array.from({length:7},()=>Array(11).fill(1));
 const walk=(x,y)=>{grid[y][x]=0;for(const[dx,dy]of shuffle([[2,0],[-2,0],[0,2],[0,-2]],rng)){let nx=x+dx,ny=y+dy;if(nx>0&&nx<8&&ny>0&&ny<6&&grid[ny][nx]){grid[y+dy/2][x+dx/2]=0;walk(nx,ny)}}};
 walk(1,3);
 // A fork at the start and a loop give children real route choices.
 for(let y=1;y<=5;y++)grid[y][1]=0;
 for(let x=1;x<=3;x++){grid[1][x]=0;grid[3][x]=0;grid[5][x]=0;}
 for(let y=1;y<=5;y++)grid[y][3]=0;
 // Every answer is a leaf, never a corridor on the way to another answer.
 for(const {x,y}of MAZE_EXITS){grid[y][x-1]=0;grid[y][x]=0;}
 return grid;
}
function makeSchedule(players,rng=Math.random){
 if(players.length<1||players.length>MAX_PLAYERS)throw Error('Choose 1–10 players.');
 let used=new Set(),turns=[],families=shuffle(['quiz','maze','match','craft'],rng),order=shuffle(players.map((_,i)=>i),rng);
 for(let i=0;i<order.length;i++){
  let family=families[i%families.length],prev=turns.length?BY_ID[turns.at(-1).mission]:null;
  let candidates=MISSIONS.filter(m=>m.family===family&&!used.has(m.id));
  let varied=candidates.filter(m=>!prev||m.topic!==prev.topic);
  let m=shuffle(varied.length?varied:candidates,rng)[0];used.add(m.id);
  turns.push({player:order[i],mission:m.id,done:false,mistakes:0,points:0,data:makeTaskData(m,rng)});
 }
 return turns;
}
function makeTaskData(m,rng=Math.random){if(m.type==='quiz')return{order:shuffle(m.options,rng),wrong:[]};if(m.type==='maze')return{grid:makeMaze(rng),x:1,y:3,exits:shuffle(m.options,rng),visitedWrong:[]};if(m.type==='match')return{left:shuffle(m.keys,rng),right:shuffle(m.keys,rng),pairs:[],selected:null};if(m.type==='decorate')return{placed:[],selected:null};if(m.type==='flag')return{background:m.part==='circle'?'white':null,circle:m.part==='background'?'red':null,selected:null};return{mirror:rng()>.5}}
function freshClass(id){if(!validClass(id))throw Error('Unknown game');const names=isRoom(id)?['Player 1','Player 2']:ROSTERS[id];return{roster:[...names],attendance:[...names],session:null,history:[]}}
function classKey(id){if(!validClass(id))throw Error('Unknown class');return 'maru-classroom-v3:'+id}
function loadClass(storage,id){try{
 let raw=JSON.parse(storage.getItem(classKey(id)));
 if(raw&&Array.isArray(raw.roster)&&raw.roster.every(n=>typeof n==='string')&&Array.isArray(raw.attendance)&&Array.isArray(raw.history)){
  if(raw.session&&raw.session.format!==FORMAT){
   // Retain old results/unfinished work without resuming the old four-round format.
   if(raw.session.finished&&!raw.history.some(h=>h.id===raw.session.id))raw.history.unshift(raw.session);
   if(!raw.session.finished)raw.previousSession=raw.session;
   raw.session=null;
  }
  raw.attendance=raw.attendance.filter(n=>raw.roster.includes(n)).slice(0,MAX_PLAYERS);
  return raw;
 }
}catch{}return freshClass(id)}
function groupForClass(id){return Object.keys(GROUPS).find(k=>GROUPS[k].classes.includes(id))||null;}
function rankings(records,group){
 if(!GROUPS[group])return [];
 const rows=[];
 for(const id of GROUPS[group].classes){
  const r=records[id];if(!r)continue;
  const games=[...(r.history||[]),...(r.session?.finished?[r.session]:[])].sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0));
  const seen=new Set();
  for(const game of games)for(const p of game.players||[]){
   if(seen.has(p.name)||!Number.isFinite(p.score)||p.completed<1)continue;
   seen.add(p.name);
   const score=Math.round(Math.min(10,p.score/(game.format===FORMAT?1:p.completed))*10)/10;
   rows.push({name:p.name,classId:id,score,legacy:game.format!==FORMAT,finishedAt:game.finishedAt||0});
  }
 }
 rows.sort((a,b)=>b.score-a.score||a.classId.localeCompare(b.classId)||a.name.localeCompare(b.name));
 let rank=0;rows.forEach((row,i)=>{if(i===0||row.score!==rows[i-1].score)rank=i+1;row.rank=rank;});
 return rows;
}
function saveClass(storage,id,record){storage.setItem(classKey(id),JSON.stringify(record))}
function resetClass(storage,id){let r=loadClass(storage,id);r.session=null;r.history=[];delete r.previousSession;saveClass(storage,id,r);return r}
const Core={GROUPS,FORMAT,MAX_PLAYERS,isRoom,validClass,MAZE_EXITS,groupForClass,rankings,ROSTERS,ITEMS,FACTS,MISSIONS,BY_ID,FEATURES,shuffle,makeMaze,makeSchedule,makeTaskData,freshClass,classKey,loadClass,saveClass,resetClass};root.MaruCore=Core;if(typeof module!=='undefined')module.exports=Core;
})(typeof window==='undefined'?globalThis:window);
