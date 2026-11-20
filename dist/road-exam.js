'use strict';
const T=THREE, $=id=>document.getElementById(id), clamp=T.MathUtils.clamp;
const query=new URLSearchParams(location.search);
const arcade=document.body.classList.contains('arcade');
const exam=query.get('mode')==='exam';
const routes={
  river:{id:'river',name:'Tuyến ven sông',finish:2240,crossing:820,bridge:[665,825],near:'Cầu Bến Lau',turn:'Ngã ba bến chợ',junction:1450,sign:1,
    headings:[[0,0],[140,0],[300,42],[420,54],[650,14],[880,12],[1030,-32],[1230,-47],[1415,-43],[1485,32],[1640,42],[1840,10],[2020,0],[2240,0]]},
  pass:{id:'pass',name:'Đèo trà',finish:2480,crossing:645,bridge:[440,552],near:'Cầu Suối Trà',turn:'Ngã ba nông trường',junction:1030,sign:-1,
    headings:[[0,0],[100,0],[270,-46],[425,-74],[560,-65],[690,-15],[805,42],[995,51],[1065,-31],[1145,-40],[1330,-77],[1450,-54],[1600,22],[1740,61],[1900,35],[2050,-32],[2210,-6],[2350,10],[2480,10]]}
};
if(arcade){
 const group=document.createElement('optgroup');group.label='Đường đèo Việt Nam';
 for(const stage of mountainStages){
   const finish=stage.angles.length*stage.step;
   routes[stage.id]={id:stage.id,name:stage.name,stage,finish,crossing:finish*.55,
     bridge:[Math.round(finish*.27/4)*4,Math.round(finish*.27/4)*4+80],junction:finish*.7,sign:1,near:'Cầu trên chặng',turn:'Ngã rẽ'};
   group.append(new Option(stage.name+' · '+(finish/1000).toLocaleString('vi-VN')+' km',stage.id));
 }
 $('route').append(group);
}
function sampleStage(values,station,spacing){
 const pos=clamp(station/spacing,0,values.length-1),i=Math.floor(pos);
 return values[i]+((values[i+1]??values[i])-values[i])*(pos-i);
}
const route=(Object.hasOwn(routes,query.get('route')) && routes[query.get('route')]) || (exam&&crypto.getRandomValues(new Uint8Array(1))[0]%2?routes.pass:routes.river);
$('route').value=route.id;$('route').disabled=exam;$('routeName').textContent=route.name;
$('route').onchange=e=>{const u=new URL(location.href);u.searchParams.set('route',e.target.value);location.href=u.href;};
const step=4,points=[];
function heading(d){
  if(route.stage)return sampleStage(route.stage.angles,d-route.stage.step/2,route.stage.step)*Math.PI/180;
  const pairs=route.headings;let i=1;while(i<pairs.length-1&&pairs[i][0]<d)i++;
  const [a,b]=[pairs[i-1],pairs[i]], t=clamp((d-a[0])/(b[0]-a[0]),0,1);
  return (a[1]+(b[1]-a[1])*t*t*(3-2*t))*Math.PI/180;
}
function height(d){
  if(route.stage)return sampleStage(route.stage.heights,d,route.stage.step);
  const [a,b]=route.bridge;
  const ramp=Math.max(0,Math.min(1,(d-a+64)/64,(b+64-d)/64));
  const bridge=ramp*ramp*(3-2*ramp)*2.6;
  if(route.id!=='pass')return .7*Math.sin(d/140)+bridge;
  // Sustained ascent, level bridge deck, summit, then a descent into the valley.
  const stops=passProfile;
  for(let i=1;i<stops.length;i++)if(d<=stops[i][0]){
    const [x,y]=stops[i-1],[end,top]=stops[i],t=clamp((d-x)/(end-x),0,1);
    return y+(top-y)*t*t*(3-2*t)+bridge;
  }
  return stops.at(-1)[1]+bridge;
}
function roadGrade(d,yaw){return (height(d+2)-height(d-2))*.25*Math.cos(yaw-heading(d));}
const passProfile=[[0,0],[80,0],[420,24],[560,24],[1120,68],[1370,73],[2060,19],[2480,7]];
let px=0,pz=0;
for(let d=0;d<=route.finish+80;d+=step){
  const h=heading(d);points.push({x:px,z:pz,y:height(d),h});
  const mid=heading(d+step/2);px+=Math.sin(mid)*step;pz-=Math.cos(mid)*step;
}
function at(d,l=0){
  d=clamp(d,0,(points.length-1)*step-.001);
  const i=Math.floor(d/step),f=d/step-i,a=points[i],b=points[i+1],h=a.h+(b.h-a.h)*f;
  return {x:a.x+(b.x-a.x)*f+l*Math.cos(h),z:a.z+(b.z-a.z)*f+l*Math.sin(h),y:a.y+(b.y-a.y)*f,h};
}
function roadCoordinates(x,z,near){
  const base=Math.floor(near/step);let best=Infinity,d=near,offset=0;
  for(let i=Math.max(0,base-5);i<=Math.min(points.length-2,base+5);i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const f=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const ox=x-a.x-f*dx,oz=z-a.z-f*dz,dd=ox*ox+oz*oz;
    if(dd<best){best=dd;d=(i+f)*step;offset=(ox*(-dz)+oz*dx)/step;}
  }
  return {d,offset};
}
const scene=new T.Scene(), renderer=new T.WebGLRenderer({canvas:$('world'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.55));scene.background=new T.Color(0xbcd7de);scene.fog=new T.FogExp2(0xc8dbd4,.00205);
const sky=new T.TextureLoader().load('streetscape/sky.jpg',tex=>{tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;scene.background=tex;if(!scene.environment)scene.environment=tex;});
if(arcade)new T.TextureLoader().load('streetscape/'+(route.stage?'pass':route.id)+'-reflection.jpg',tex=>{
 tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;scene.environment=tex;
});
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
scene.fog=new T.FogExp2(0xb4c6c5,.00135);
scene.add(new T.HemisphereLight(0xcde4ff,0x887d64,1.05));
const sun=new T.DirectionalLight(0xffdfaf,2.8);sun.castShadow=true;sun.position.set(-38,45,22);scene.add(sun,sun.target);
const shadowSize=matchMedia('(pointer:coarse)').matches?1024:2048;
renderer.shadowMap.autoUpdate=false;
sun.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:170});sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias=.025;sun.shadow.bias=-.00022;
const camera=new T.PerspectiveCamera(62,1,.08,3300);
const geom={box:new T.BoxGeometry(1,1,1),leaf:new T.PlaneGeometry(1,1),roof:new T.ConeGeometry(1,1,4),pole:new T.CylinderGeometry(.5,.5,1,8)};
const batches=new Map(),temp=new T.Object3D();
function scatter(kind,color,x,y,z,w,h,l,angle=0,pitch=0){
  const key=kind+color;let batch=batches.get(key);
  if(!batch){batch={kind,color,matrices:[]};batches.set(key,batch);}
  temp.position.set(x,y,z);temp.rotation.set(pitch,angle,0,'YXZ');temp.scale.set(w,h,l);temp.updateMatrix();batch.matrices.push(temp.matrix.clone());
}
function beside(d,l,kind,color,w,h,depth,base=0,angle=0){
  const p=at(d,l);scatter(kind,color,p.x,p.y+base+h/2,p.z,w,h,depth,-p.h+angle,h<.65&&angle===0?Math.atan(roadGrade(d,p.h)):0);
}
let seed=route.id==='pass'?732:351;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
function ribbon(left,right,color,raise,roadMaterial){
  const verts=[],uv=[],indices=[];
  for(let i=0;i<points.length;i++){
    for(const [edge,u] of [[left,0],[right,1]]){const p=at(i*step,edge);verts.push(p.x,p.y+raise,p.z);uv.push(u,i*step/9);}
    if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const material=roadMaterial||new T.MeshLambertMaterial({color,side:T.DoubleSide});
  if(roadMaterial)material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 roadUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n roadUv=uv;');
    shader.fragmentShader='varying vec2 roadUv;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n float lane=fract(roadUv.x*2.);vec2 tracks=(vec2(lane)-vec2(.28,.72))*11.;float tires=exp(-tracks.x*tracks.x)+exp(-tracks.y*tracks.y);diffuseColor.rgb*=1.-tires*(.11+.04*sin(roadUv.y*.7));');
  };
  const surface=new T.Mesh(geo,material);surface.receiveShadow=true;scene.add(surface);
}
const surfaces=createRoadSurfaces(T,renderer),roadSurface=surfaces.scanned('asphalt',0xaeb2b3,.41);
roadSurface.side=T.DoubleSide;surfaces.transform(roadSurface,3,2.25);
// Race.js also uses the road texture for the starting apron.
const asphalt=roadSurface.map;
ribbon(-6.7,6.7,0x8a856e,-.06);ribbon(-6,6,0xb4b8b8,0,roadSurface);ribbon(-5.83,-5.74,0xf1eee0,.015);ribbon(5.74,5.83,0xf1eee0,.015);
const river=route.id==='river', [bridgeStart,bridgeEnd]=route.bridge;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function nearest(x,z){
  let best=Infinity,index=0;
  function test(i){const p=points[i],v=(p.x-x)**2+(p.z-z)**2;if(v<best){best=v;index=i;}}
  for(let i=0;i<points.length;i+=10)test(i);
  const coarse=index;
  for(let i=Math.max(0,coarse-10);i<=Math.min(points.length-1,coarse+10);i++)test(i);
  const p=points[index],side=(x-p.x)*Math.cos(p.h)+(z-p.z)*Math.sin(p.h);
  return {d:index*step,side,dist:Math.sqrt(best),y:p.y};
}
const waterLevel=river?-3:height((bridgeStart+bridgeEnd)/2)-8;
function surface(x,z,n){
  const a=n.dist,d=n.d;
  const rolling=1.1*Math.sin(x/19+z/44)+1.6*Math.cos(z/37)+Math.sin(x/11-z/29)*.35;
  const high=(river?10:45)+(river?7:27)*Math.sin(x/65+z/117)+(river?5:13)*Math.cos(z/53);
  let y=n.y-.45+smooth(9,50,a)*rolling+smooth(31,155,a)*high;
  const center=(bridgeStart+bridgeEnd)/2+clamp(n.side,-90,90)*.15;
  const channel=1-smooth((bridgeEnd-bridgeStart)*.30,(bridgeEnd-bridgeStart)*.52,Math.abs(d-center));
  const stream=river?smooth(12,23,-n.side)*(1-smooth(64,81,-n.side))*(1-smooth(bridgeEnd,bridgeEnd+76,d)):0;
  return T.MathUtils.lerp(y,waterLevel-2,Math.max(channel,stream));
}
function besideWater(d){return river||Math.abs(d-(bridgeStart+bridgeEnd)*.5)<(bridgeEnd-bridgeStart)*.8;}
function ground(x,z){return surface(x,z,nearest(x,z));}
const box=new T.Box3().setFromPoints(points.map(p=>new T.Vector3(p.x,0,p.z)));
function groundMap(path){
  const map=new T.TextureLoader().load('streetscape/'+path);map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return map;
}
const meadow=groundMap('verge-grass.webp'),earth=groundMap('verge-earth.webp');
const courseWater=createDrivingWater(T,false);
function terrain(){
  const grid=6,margin=235,nx=Math.ceil((box.max.x-box.min.x+2*margin)/grid)+1,nz=Math.ceil((box.max.z-box.min.z+2*margin)/grid)+1;
  const verts=[],colors=[],uv=[],soil=[],indices=[],base=new T.Color(),tea=new T.Color(0xcbd3b0),sand=new T.Color(0xe5d6bb);
  const waterVerts=[],profiles=[],waterIndices=[];
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=box.min.x-margin+i*grid,z=box.min.z-margin+j*grid,n=nearest(x,z),y=surface(x,z,n);
    const heading=points[Math.min(points.length-1,Math.round(n.d/step))].h;
    const crossChannel=Math.abs(n.d-(bridgeStart+bridgeEnd)*.5)<(bridgeEnd-bridgeStart)*.55;
    const angle=heading+(crossChannel?Math.PI/2:0),current=river?.6:.93;
    const level=besideWater(n.d)?waterLevel:-1e4;
    waterVerts.push(x,waterLevel,z);profiles.push(Math.sin(angle)*current,-Math.cos(angle)*current,(level-y)*2.6);
    const patch=.45+.21*Math.sin(x/33+z/75)+.22*Math.cos(x/85-z/24);
    base.set(river?0xa4b89b:0x94aca0).lerp(tea,patch).lerp(sand,1-smooth(level,level+1.8,y));
    uv.push(x/3.6,z/3.6);soil.push(Math.max(1-smooth(6,11,n.dist),1-smooth(level+.5,level+2.3,y)));
    base.multiplyScalar(.96+.03*Math.sin(x*.67+z*.22));verts.push(x,y,z);colors.push(base.r,base.g,base.b);
    if(j&&i){const k=j*nx+i;indices.push(k-nx-1,k-1,k-nx,k-1,k,k-nx);}
  }
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    if(Math.max(profiles[a*3+2],profiles[b*3+2],profiles[c*3+2])>=0)waterIndices.push(a,b,c);
  }
  const waterGeometry=new T.BufferGeometry();
  waterGeometry.setAttribute('position',new T.Float32BufferAttribute(waterVerts,3));
  waterGeometry.setAttribute('riverProfile',new T.Float32BufferAttribute(profiles,3));
  waterGeometry.setIndex(waterIndices);waterGeometry.computeVertexNormals();
  const water=new T.Mesh(waterGeometry,courseWater.material);water.receiveShadow=true;scene.add(water);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('soil',new T.Float32BufferAttribute(soil,1));
  const land=new T.MeshLambertMaterial({vertexColors:true,map:meadow});
  land.onBeforeCompile=shader=>{
    shader.uniforms.earthMap={value:earth};
    shader.vertexShader='attribute float soil; varying float soilWeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n soilWeight=soil;');
    shader.fragmentShader='uniform sampler2D earthMap; varying float soilWeight;\n'+shader.fragmentShader.replace('#include <map_fragment>','diffuseColor *= mix(texture2D(map,vMapUv),texture2D(earthMap,vMapUv*1.6),smoothstep(.12,.9,soilWeight));');
  };
  const field=new T.Mesh(g,land);field.receiveShadow=true;scene.add(field);
}
terrain();
const hills=distantHills();
const foliage={};
for(const kind of ['tree','palm']){
 const texture=new T.TextureLoader().load('streetscape/roadside-'+kind+'.webp');texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=4;
 foliage[kind]=new T.MeshLambertMaterial({map:texture,side:T.DoubleSide,alphaTest:.5,color:0xc6d0bd,emissive:0x292f25});
 geom[kind]=new T.PlaneGeometry(1,1);
}
function tree(d,l){
 const p=at(d,l),n=nearest(p.x,p.z),y=surface(p.x,p.z,n);
 if(n.dist<10||besideWater(n.d)&&y<waterLevel+.6||Math.abs(n.d-route.junction)<22)return;
 const palm=river&&random()<.42,kind=palm?'palm':'tree';
 const h=(palm?8:6.8)+random()*(palm?7:5.8),w=h*(palm?.588:.923)*(.9+random()*.2);
 const angle=random()*Math.PI;
 for(let k=0;k<2;k++){
   const a=angle+k*Math.PI/2,off=w*(palm?.07:.12);
   scatter(kind,0xffffff,p.x+off*Math.cos(a),y+h*.49,p.z-off*Math.sin(a),w,h,1,a);
 }
}
function teaRows(d0,end,side){
  const verts=[],indices=[],colors=[],col=new T.Color();
  for(let row=0;row<13;row++){
    const l=side*(14+row*2.2);let prev=-1;
    for(let d=d0;d<=end;d+=3){
      const p=at(d,l),n=nearest(p.x,p.z),y=surface(p.x,p.z,n);
      if(n.dist<12||besideWater(n.d)&&y<waterLevel+2){prev=-1;continue;}
      const k=verts.length/3;
      for(const [delta,raise,tone] of [[-.78,.08,0x304a32],[-.48,.66,0x597d3b],[.42,.84,0x779642],[.78,.09,0x436335]]){
        const q=at(d,l+delta);verts.push(q.x,y+raise,q.z);col.set(tone).multiplyScalar(.93+.12*Math.sin(d*1.34+row));colors.push(col.r,col.g,col.b);
      }
      if(prev>=0)for(let t=0;t<3;t++)indices.push(prev+t,prev+t+1,k+t,prev+t+1,k+t+1,k+t);
      prev=k;
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  scene.add(new T.Mesh(g,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));
}
if(!river)for(const [d,end,side] of [[8,230,-1],[60,395,1],[580,950,-1],[1150,1450,1],[1580,1890,-1],[2010,2380,1]])teaRows(d,end,side);
for(let d=3;d<route.finish+60;d+=9)beside(d,0,'box',0xecc45c,.12,.025,4);
for(let d=bridgeStart;d<=bridgeEnd;d+=4){
  beside(d,0,'box',0x857e6d,13.5,.6,4.2,-.62);
  for(const side of [-1,1]){
    beside(d,side*6.28,'box',0x97988d,.35,.26,4.15);
    beside(d,side*6.42,'box',0xc4c9b8,.18,.16,4.18,1.04);
    beside(d,side*6.42,'pole',0x88948c,.13,.9,.13,.24);
    beside(d,side*6.42,'box',0x87928c,.08,.08,4.18,.6);
  }
  if((d-bridgeStart)%24===0)for(const side of [-1,1])beside(d,side*4,'pole',0x827e71,1.2,12,1.2,-12);
}
for(let d=15;d<route.finish+50;d+=13){
  if(d>bridgeStart-10&&d<bridgeEnd+10)continue;
  for(const side of [-1,1]){
    const deep=river&&side<0?75:river?12:33;
    if(random()>.2)tree(d+random()*6,side*(deep+random()*15));
    if(random()>.35)tree(d+random()*10,side*(deep+18+random()*24));
  }
  if(d%65<14&&d>70&&Math.abs(d-route.junction)>65){
    const side=river?1:(random()>.45?1:-1),l=side*(river?20+random()*7:49+random()*8),h=3.5+random()*2,w=5+random()*4;
    const p=at(d,l),base=ground(p.x,p.z)-p.y-.45;
    beside(d,l,'box',random()>.5?0xc6b699:0xa4ae99,w,h,8,base);
    beside(d,l,'roof',0x955e45,w*.83,2,7.7,h+base,Math.PI/4);
    beside(d,l-side*(w/2+.06),'box',0x414e4b,.08,2.3,1.2,base);
    for(const dz of [-2.5,2.5])beside(d+dz,l-side*(w/2+.07),'box',0x648185,.09,1.15,1.3,1.5+base);
  }
}
const junction=at(route.junction);
for(const side of [-1,1]){
  const angle=junction.h+side*Math.PI/2;
  scatter('box',0x757670,junction.x+Math.sin(angle)*29,junction.y-.09,junction.z-Math.cos(angle)*29,8,.16,64,-angle);
}
function board(d,l,text,bg='#235642',w=5,mount=3){
  const p=at(d,l),c=document.createElement('canvas');c.width=768;c.height=192;const g=c.getContext('2d');
  g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);g.strokeStyle='#fff5cb';g.lineWidth=7;g.strokeRect(7,7,754,178);
  g.fillStyle='#fff';g.font='bold 76px Arial';g.textAlign='center';g.fillText(text,384,124,725);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const face=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));face.position.set(p.x,p.y+mount,p.z);face.rotation.y=-p.h;scene.add(face);
  if(mount===3)beside(d,l,'pole',0x797c74,.12,3,.12);
}
board(36,7,route.name.toLocaleUpperCase('vi'));board(route.bridge[0]-17,7.9,route.near);board(route.junction-42,8,route.sign>0?'BẾN CHỢ  →':'←  NÔNG TRƯỜNG');
if(arcade){
 for(let d=3;d<route.finish;d+=3){
   if(Math.abs(heading(d+10)-heading(d))<.027 && d>65 && d<route.finish-36)continue;
   const paint=Math.floor(d/3)%2?0xf5dfbe:0xd94e30;
   for(const side of [-1,1])beside(d,side*5.94,'box',paint,.48,.075,3.04);
 }
 for(const [d,label] of [[36,'XUẤT PHÁT'],[route.finish/2,'NỬA CHẶNG'],[route.finish,'VỀ ĐÍCH']]){
   for(const side of [-1,1])beside(d,side*6.5,'box',0xff4e24,.5,6,.6);
   beside(d,0,'box',0x252a36,13.4,1.15,.65,5.45);
   board(d-.4,0,label,'#bc381c',5.1,6);
   for(let n=0;n<14;n++)for(let row=0;row<2;row++)beside(d+row*.73,n*.84-5.46,'box',(n+row)%2?0x252630:0xf0efdc,.84,.025,.73,.018);
 }
}else{board(route.finish-35,8,'ĐIỂM DỪNG XE','#365c70');board(115,7,'TỐI ĐA 50 km/h','#625b46');}
buildRoadside();
for(const b of batches.values()){
 const m=new T.InstancedMesh(geom[b.kind],foliage[b.kind]||new T.MeshLambertMaterial({color:b.color}),b.matrices.length);b.matrices.forEach((mat,i)=>m.setMatrixAt(i,mat));m.castShadow=true;m.receiveShadow=true;scene.add(m);
}
const rig=new T.Group();scene.add(rig);
const cabin=buildDriverCabin(T,rig), outer=new T.Group();rig.add(outer);
const fallback=new T.Mesh(new T.BoxGeometry(1.8,1.1,4),new T.MeshStandardMaterial({color:0xcda05e}));fallback.position.y=.75;outer.add(fallback);
async function loadSedan(){
 const res=await fetch('streetscape/sedan.json.gz');const bytes=new Uint8Array(await res.arrayBuffer());
 const json=bytes[0]===31?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(bytes));
 const model=new T.ObjectLoader().parse(json),bounds=new T.Box3().setFromObject(model),scale=4.18/(bounds.max.z-bounds.min.z);
 model.scale.setScalar(scale);model.rotation.y=Math.PI;model.position.y=-bounds.min.y*scale;model.traverse(n=>{if(n.isMesh)n.castShadow=true;});outer.clear();outer.add(model);
}
if(!arcade)loadSedan().catch(()=>{});
const traffic=[];
for(const [name,first,velocity] of arcade?[]:[['hatchback',140,-8],['kei-van',350,-7],['motor-scooter',570,-5]]){
 TrafficModels.load.loadAsync('traffic/'+name+'.glb').then(({scene:model})=>{
   const bounds=new T.Box3().setFromObject(model);model.scale.setScalar((name==='motor-scooter'?1.85:3.8)/(bounds.max.z-bounds.min.z));
   scene.add(model);traffic.push({model,first,velocity,d:first});
 }).catch(()=>{});
}
const keys=createDriveInput(),gearCaps=[0,25,42,62,80,96];
let state,inside=true,sound=driveAudio.enabled,lastFrame=performance.now(),message='',feedbackUntil=0;
function reset(){
 const p=at(0,3.7);
 state={x:p.x,z:p.z,h:p.h,d:0,offset:3.7,v:0,steer:0,gear:0,signal:0,hand:true,belt:false,
   mode:'ready',time:0,score:100,errors:[],seen:new Set(),command:null,nextCommand:0,leftLane:false,wrongGear:0,overSpeed:0,rpmHigh:false,posted:false};
 message='Trước khi nhận lệnh, hãy thắt dây và chuẩn bị số 1.';feedbackUntil=99;
 $('route').disabled=exam;$('start').textContent='Nhận lệnh xuất phát';$('start').disabled=false;$('result').close();$('submit').hidden=true;hud();
}
const changes=[{at:230,up:true},{at:566,up:false},{at:route.junction+150,up:true},{at:route.finish-310,up:false}];
function feedback(line){message=line;feedbackUntil=state.time+5;}
function announce(line){
 if(!sound)return;
 const speech=window.speechSynthesis;
 const voice=speech?.getVoices().find(v=>v.lang.toLowerCase().startsWith('vi'));
 if(!voice){driveAudio.cue(true);return;}
 speech.cancel();
 const cue=new SpeechSynthesisUtterance(line);cue.voice=voice;cue.lang='vi-VN';cue.rate=1.06;speech.speak(cue);
}
function fail(reason){
 state.score=Math.min(79,state.score);state.errors.push(reason);finish(false);
}
function fault(key,line,penalty){
 if(state.seen.has(key))return;
 state.seen.add(key);state.score=Math.max(0,state.score-penalty);state.errors.push(line+' (−'+penalty+')');feedback(line+' · −'+penalty+' điểm');
 if(state.score<80&&exam)finish(false);
}
function finish(passed){
 if(state.mode==='done')return;
 state.mode='done';state.v=0;keys.clear();$('start').disabled=true;$('submit').hidden=true;
 $('resultTitle').textContent=(passed?'Đạt':'Chưa đạt')+' · '+state.score+'/100';
 $('resultText').textContent=route.name+' · '+Math.round(state.d)+' m\n'+(state.errors.join('\n')||'Đã hoàn thành các hiệu lệnh.');
 if(exam&&parent!==window)$('again').hidden=true;
 $('result').showModal();
 if(!state.posted&&exam){state.posted=true;parent.postMessage({type:'drive-exam-result',part:'road',passed,score:state.score},location.origin);}
}
function action(name){
 if(state.mode==='done'||state.mode==='paused')return;
 if(name==='belt')state.belt=!state.belt;
 if(name==='hand'){if(state.v>1){feedback('Dừng xe trước khi kéo phanh tay.');return;}state.hand=!state.hand;}
 if(name==='leftSignal')state.signal=state.signal===-1?0:-1;
 if(name==='rightSignal')state.signal=state.signal===1?0:1;
 if(name==='upGear'||name==='downGear'){
   state.gear=clamp(state.gear+(name==='upGear'?1:-1),0,5);
   if(state.mode==='drive'&&state.v>1&&state.offset<.92)return fail('Chuyển số khi xe lấn sang làn ngược chiều.');
 }
 hud();
}
function start(){
 if(state.mode==='done')return;
 state.mode=state.mode==='drive'?'paused':'drive';keys.clear();$('route').disabled=true;
 $('start').textContent=state.mode==='drive'?'Tạm dừng':'Tiếp tục';
 if(!state.time){announce('Bắt đầu bài sát hạch. Xuất phát.');feedback('Xuất phát. Báo trái, nhả phanh tay và lên số 3 trong 15 m.');feedbackUntil=10;}
}
function submit(){
 if(state.mode!=='drive'||state.d<route.finish||state.v>.01)return;
 if(state.offset<4.7||state.offset>5.3)fault('curb','Dừng xe chưa sát lề phải',5);
 if(state.mode==='done')return;
 if(state.gear!==0)fault('neutral','Chưa về số N sau khi dừng',5);
 if(state.mode==='done')return;
 if(!state.hand)fault('handEnd','Chưa kéo phanh tay sau khi dừng',5);
 if(state.mode!=='done')finish(state.score>=80);
}
function update(dt){
 if(state.mode!=='drive')return;
 const s=state,prev=s.d; s.time+=dt;
 const gas=keys.has('arrowup')||keys.has('w'),brake=keys.has('arrowdown')||keys.has('s')||keys.has(' ');
 const target=Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a'));
 s.steer+=(target-s.steer)*(1-Math.exp(-dt*8));
 if(s.hand&&gas&&s.gear>0)fault('handStart','Đạp ga khi còn phanh tay',5);
 if(s.mode!=='drive')return;
 const accel=gas&&s.gear>0&&s.v*3.6<gearCaps[s.gear]?2.7:0;
 s.v=s.hand?0:clamp(s.v+dt*(accel-9.81*roadGrade(s.d,s.h)-.22-s.v*.014-(brake?5.3:0)),0,22);
 const turnLimit=.36/(1+s.v*.13);
 s.h+=s.v/2.65*Math.tan(s.steer*turnLimit)*dt;
 s.x+=Math.sin(s.h)*s.v*dt;s.z-=Math.cos(s.h)*s.v*dt;
 Object.assign(s,roadCoordinates(s.x,s.z,s.d));
 if(s.d<.8&&s.time>30)return fail('Quá 30 giây sau lệnh xuất phát.');
 if(s.d>.8&&!s.seen.has('depart')){s.seen.add('depart');if(!s.belt)fault('belt','Khởi hành khi chưa thắt dây',5);if(s.signal!==-1)fault('left','Thiếu xi nhan trái khi khởi hành',5);}
 if(prev<15&&s.d>=15&&s.gear<3)fault('gear3','Chưa lên số 3 trong 15 m đầu',5);
 if(s.d>25&&s.d<35&&s.signal===-1)s.signal=0;
 if(Math.abs(s.offset)>6.65)return fail('Xe ra ngoài nền đường.');
 if(s.offset<.91&&!s.leftLane){fault('lane'+s.time,'Lấn làn ngược chiều',10);s.leftLane=true;}
 if(s.offset>1.05)s.leftLane=false;
 if(s.mode!=='drive')return;
 for(const car of traffic){
   const span=route.finish+38;
   car.d=((car.first+car.velocity*s.time)%span+span)%span;
   if(Math.abs(s.d-car.d)<3.7&&Math.abs(s.offset+2.8)<1.75)return fail('Xảy ra va chạm với xe ngược chiều.');
 }
 if(s.gear>=3&&s.v*3.6<20&&s.v>.02){s.wrongGear+=dt;if(s.wrongGear>=3){fault('gear'+s.time,'Số cao khi tốc độ dưới 20 km/h',2);s.wrongGear=0;}}else s.wrongGear=0;
 if(s.v*3.6>50.5){s.overSpeed+=dt;if(s.overSpeed>=2){fault('limit','Vượt biển tốc độ 50 km/h',10);}}else s.overSpeed=0;
 if(s.mode!=='drive')return;
 const task=changes[s.nextCommand];
 if(task&&!s.command&&s.d>=task.at){
    s.command={...task,baseGear:s.gear,baseSpeed:s.v*3.6,complete:false};
    announce(task.up?'Tăng một số, tăng tốc độ.':'Giảm một số, giảm tốc độ.');
 }
 const c=s.command;
 if(c){
   const direction=c.up?1:-1;
   if(direction*(s.gear-c.baseGear)>=1&&direction*(s.v*3.6-c.baseSpeed)>=5&&!c.complete){c.complete=true;feedback('Đạt hiệu lệnh đổi số và tốc độ.');}
   if(s.d>=c.at+100){
     if(!c.complete)fault('shift'+s.nextCommand,'Thiếu thao tác '+(c.up?'tăng':'giảm')+' số hoặc tốc độ trong 100 m',5);
     s.command=null;s.nextCommand++;
   }
 }
 if(prev<route.junction-70&&s.d>=route.junction-70)announce(route.sign>0?'Chuẩn bị rẽ phải tại ngã ba.':'Chuẩn bị rẽ trái tại ngã ba.');
 if(prev<route.finish-35&&s.d>=route.finish-35)announce('Kết thúc. Báo phải, tấp sát lề và dừng xe.');
 if(prev<route.junction&&s.d>=route.junction&&s.signal!==route.sign)fault('turn','Thiếu tín hiệu khi chuyển hướng ở ngã ba',10);
 if(s.d>route.junction+45&&s.d<route.junction+60)s.signal=0;
 if(s.d>=route.finish-35&&s.signal===1&&s.d<=route.finish-30)s.seen.add('finishSignal');
 if(s.d>=route.finish-30&&!s.seen.has('finishSignal'))fault('right','Chậm hoặc thiếu xi nhan phải khi có lệnh kết thúc',5);
 if(s.d>route.finish+34)return fail('Đi quá điểm kết thúc khi chưa dừng xe.');
 $('submit').hidden=!(s.d>=route.finish&&s.v<.01&&s.mode==='drive');
}
function instruction(){
 const s=state;if(s.mode==='done')return 'Kết thúc lượt sát hạch';
 if(s.mode==='ready')return 'Chuẩn bị xe tại mép đường bên phải.';
 if(s.d<15)return 'Báo trái, khởi hành từ số 1 và lên số 3 trong 15 m.';
 if(s.d>=route.finish-35)return 'Báo phải, dừng tại lề phải từ mốc '+route.finish+' m, về N rồi kéo phanh tay.';
 if(s.d>route.finish-115)return 'Chuẩn bị kết thúc · còn '+Math.ceil(route.finish-35-s.d)+' m đến lệnh báo phải.';
 if(s.command&&!s.command.complete){const c=s.command,sign=c.up?1:-1;return (c.up?'Tăng':'Giảm')+' đến số '+clamp(c.baseGear+sign,0,5)+', đạt '+Math.max(0,Math.round(c.baseSpeed+sign*5))+' km/h · còn '+Math.ceil(c.at+100-s.d)+' m.';}
 if(Math.abs(s.d-route.junction)<75)return (route.sign>0?'Báo phải, rẽ phải':'Báo trái, rẽ trái')+' theo tuyến tại '+route.turn.toLowerCase()+'.';
 const upcoming=changes[s.nextCommand];if(upcoming&&!s.command&&upcoming.at-s.d<65)return 'Chuẩn bị nhận lệnh '+(upcoming.up?'tăng':'giảm')+' số và tốc độ.';
 return 'Đi đúng làn, theo đường trên bản đồ · giới hạn 50 km/h.';
}
function hud(){
 const s=state;$('command').textContent=instruction();$('stage').textContent=(exam?'THI THỬ':'LUYỆN TẬP')+' · '+(s.mode==='paused'?'ĐANG TẠM DỪNG':'HIỆU LỆNH');
 $('distance').textContent=Math.round(s.d)+' / '+route.finish+' m';$('progress').max=route.finish;$('progress').value=s.d;
 $('speed').textContent=Math.round(s.v*3.6);$('gear').textContent=s.gear||'N';$('signals').textContent=s.signal<0?'◀':s.signal>0?'▶':'';
 $('score').textContent=s.score+' điểm';$('feedback').textContent=s.time<feedbackUntil?message:'';
 for(const [name,on] of [['belt',s.belt],['hand',s.hand],['leftSignal',s.signal<0],['rightSignal',s.signal>0]])document.querySelector('[data-action='+name+']').setAttribute('aria-pressed',on);
}
const map=$('map').getContext('2d');
const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),mapScale=Math.min(153/(maxX-minX||1),101/(maxZ-minZ||1));
function mapPoint(x,z){return [87+(x-(minX+maxX)/2)*mapScale,60+(z-(minZ+maxZ)/2)*mapScale];}
function mapDraw(){
 map.clearRect(0,0,175,121);map.lineWidth=3;map.strokeStyle='#acc58c';map.beginPath();
 for(let i=0;i<points.length;i+=4){const p=mapPoint(points[i].x,points[i].z);if(i)map.lineTo(...p);else map.moveTo(...p);}map.stroke();
 if(arcade){
   map.fillStyle='#ff7959';
   for(const r of rivals){const [x,y]=mapPoint(r.car.position.x,r.car.position.z);map.beginPath();map.arc(x,y,2.5,0,Math.PI*2);map.fill();}
 }
 const [x,y]=mapPoint(state.x,state.z);map.fillStyle='#ffcc65';map.beginPath();map.arc(x,y,4,0,Math.PI*2);map.fill();
}
const yawQ=new T.Quaternion(),axisY=new T.Vector3(0,1,0),eye=new T.Vector3(),look=new T.Vector3();
const mirrorAdapter={
 getRenderTarget:()=>renderer.getRenderTarget(),setRenderTarget:t=>renderer.setRenderTarget(t),
 render(scene,cam){
   cam.position.z-=2.13;cam.position.applyQuaternion(yawQ).add(rig.position);
   cam.quaternion.premultiply(yawQ);renderer.render(scene,cam);
 }
};
let w=0,h=0,lastHud=0,lastShadow=-1000,slowFrames=0;
function render(now){
 const elapsed=now-lastFrame,dt=clamp(elapsed/1000,0,.1);lastFrame=now;
 slowFrames=elapsed>52?slowFrames+1:Math.max(0,slowFrames-1);
 if(slowFrames>=18&&renderer.getPixelRatio()>.75){
   renderer.setPixelRatio(Math.max(.75,renderer.getPixelRatio()*.83));slowFrames=0;
 }
 if(arcade){const steps=Math.max(1,Math.ceil(dt*90));for(let i=0;i<steps;i++)raceUpdate(dt/steps);}else update(dt);
 const s=state,ground=at(s.d),canvas=$('world'),width=canvas.clientWidth,heightPx=canvas.clientHeight;
 if(width!==w||heightPx!==h){w=width;h=heightPx;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}
 rig.position.set(s.x,ground.y,s.z);rig.rotation.set(Math.atan(roadGrade(s.d,s.h)),-s.h,0,'YXZ');yawQ.copy(rig.quaternion);
 hills.position.set(s.x,0,s.z);
 const focus=at(s.d+20);sun.target.position.set(Math.round(focus.x),Math.round(focus.y),Math.round(focus.z));sun.position.copy(sun.target.position);sun.position.x-=38;sun.position.y+=45;sun.position.z+=22;
 if(now-lastShadow>(s.mode==='drive'?42:300)){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
 outer.visible=!inside;cabin.update(inside,s.v*3.6,s.steer,s.d,route);
 eye.set(inside?-.31:0,inside?1.10:3.4,inside?.53:7.6).applyQuaternion(yawQ).add(rig.position);
 look.set(inside?-.31:0,inside?.02:.6,inside?-12:-6).applyQuaternion(yawQ).add(rig.position);camera.position.copy(eye);camera.lookAt(look);
 if(arcade)raceCamera(dt,now);
 for(const c of traffic){const p=at(c.d,-2.8);c.model.position.set(p.x,p.y,p.z);c.model.rotation.set(Math.atan(roadGrade(c.d,p.h)),-p.h,0,'YXZ');}
 courseWater.update(now*.001);
 if(inside)cabin.reflect(mirrorAdapter,scene,rig,0,0);
 courseWater.reflect(renderer,scene,camera,waterLevel,now,Math.abs(s.d-(bridgeStart+bridgeEnd)*.5)<220||(river&&s.d<bridgeEnd+150));
 renderer.render(scene,camera);
 driveAudio.update({boost:arcade&&cupBody.driving&&cupBody.boost,slip:arcade?cupBody.slip:0,speed:Math.abs(s.v)*3.6,throttle:keys.has('arrowup')||keys.has('w'),braking:keys.has('arrowdown')||keys.has('s'),signal:!!s.signal,mode:s.mode==='drive'?'driving':arcade&&['grid','countdown'].includes(s.mode)?'idling':'ready'});
 if(now-lastHud>90){if(arcade)raceHud();else hud();mapDraw();lastHud=now;}requestAnimationFrame(render);
}
$('sound').textContent=sound?'Tắt âm':'Bật âm';
if(!arcade){
$('start').onclick=start;$('again').onclick=reset;$('submit').onclick=submit;
$('camera').onclick=()=>{inside=!inside;$('camera').textContent=inside?'Góc tài xế':'Góc sau xe';};
$('sound').onclick=()=>{sound=driveAudio.toggle();if(!sound)window.speechSynthesis?.cancel();$('sound').textContent=sound?'Tắt âm':'Bật âm';};
const actions={b:'belt',h:'hand',q:'leftSignal',e:'rightSignal',z:'downGear',x:'upGear'};
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();if(e.target.tagName==='SELECT'||$('result').open)return;
 if(k in actions&&!e.repeat){action(actions[k]);e.preventDefault();}
 if(['arrowleft','arrowright','arrowdown','arrowup',' ','w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}
 if(k==='p'&&!e.repeat&&state.mode!=='ready')start();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(state.mode==='drive')start();});
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
reset();requestAnimationFrame(render);
}
