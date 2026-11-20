'use strict';
const vietnamPlaceTypes={
  market:{label:'Chợ',colour:'#904f32'},school:{label:'Trường học',colour:'#39597a'},
  fuel:{label:'Trạm xăng',colour:'#285c61'},cafe:{label:'Cà phê',colour:'#654536'},
  hospital:{label:'Bệnh viện',colour:'#307168'}
};

function createWorldStreetLife(T,scene,small,environment,amenities){
  const signGroup=new T.Group(),walkGroup=new T.Group();
  signGroup.name='Biển địa điểm OSM';walkGroup.name='Người đi bộ';
  scene.add(signGroup,walkGroup);
  const board=new T.PlaneGeometry(3.6,1.2),post=new T.CylinderGeometry(.065,.085,2.6,6);
  const metal=new T.MeshLambertMaterial({color:0x858a81});
  const signs=new Map(),walkers=[],models=new Map(),bins=new Map();
  let graph,places=[],paths=[],originX=0,originZ=0,walkTime=0;
  function localHour(){return (new Date().getUTCHours()+7)%24;}
  function interest(kind,h){
    if(kind==='school')return ((h>=6&&h<=8)||(h>=15&&h<=17)) ? .85 : .17;
    if(kind==='market')return (h>=5&&h<=11) ? .85 : .39;
    if(kind==='hospital')return .36;
    if(kind==='cafe')return (h>=6&&h<=21) ? .28 : .08;
    return .15;
  }
  function activity(g,x,z,kind,h=localHour()){
    const {population,cover}=environment.sample(g,x,z),dark=h<5||h>=22;
    const fast=kind?.startsWith('motorway');
    let attraction=0;
    if(graph===g)for(let i=Math.floor((x-115)/128);i<=Math.floor((x+115)/128);i++){
      for(let j=Math.floor((z-115)/128);j<=Math.floor((z+115)/128);j++){
        for(const p of bins.get(i+','+j)||[]){
          const proximity=1-Math.hypot(p.x-x,p.z-z)/115;
          if(proximity>0)attraction=Math.max(attraction,proximity*interest(p.kind,h));
        }
      }
    }
    const residential=kind==='living_street'||kind==='residential';
    const fallback=cover===50 ? .48 : residential ? .34 : .16;
    const density=population==null?fallback:Math.min(1,Math.log1p(Math.max(0,population))/5);
    const walkers=fast?0:Math.min(1,density*.76+attraction)*(dark ? .32 : 1);
    const main=/^(motorway|trunk|primary)/.test(kind);
    return {walkers,vehicles:Math.round((3+11*density+attraction*4+(main?3:0))*(dark ? .67 : 1)),
      scooter:fast?0:Math.min(.72,.18+density*.37+attraction*.22)};
  }
  function makeSign(place){
    const {label,colour}=vietnamPlaceTypes[place.kind],canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=168;
    const ctx=canvas.getContext('2d');ctx.fillStyle=colour;ctx.fillRect(0,0,512,168);
    ctx.strokeStyle='#eee9d5';ctx.lineWidth=4;ctx.strokeRect(7,7,498,154);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff9e8';
    const name=place.name||label,named=name.toLocaleLowerCase('vi')!==label.toLocaleLowerCase('vi');
    if(named){ctx.font='600 29px "Segoe UI",sans-serif';ctx.fillText(label.toLocaleUpperCase('vi'),256,43);}
    let size=54;while(size>24){ctx.font='bold '+size+'px "Segoe UI",sans-serif';if(ctx.measureText(name).width<=466)break;size-=2;}
    ctx.fillText(name,256,named?105:84,466);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    const mat=new T.MeshLambertMaterial({map,side:T.DoubleSide});
    const group=new T.Group(),panel=new T.Mesh(board,mat),support=new T.Mesh(post,metal);
    support.position.y=1.3;panel.position.set(0,2.85,.08);group.add(panel,support);
    group.name=name;signGroup.add(group);
    return {group,mat};
  }
  function removeSign(id,item){
    signGroup.remove(item.group);item.mat.map.dispose();item.mat.dispose();signs.delete(id);
  }
  function updateSigns(g,clear,ground){
    const keep=new Set(),positions=[],nearestByKind=new Map();
    for(const p of places){
      if(Math.hypot(p.x-originX,p.z-originZ)>280)break;
      if(!nearestByKind.has(p.kind))nearestByKind.set(p.kind,p);
    }
    const candidates=new Set([...nearestByKind.values(),...places]);
    for(const p of candidates){
      if(keep.size>=(small?8:14))break;
      const near=g.nearest(p.x,p.z,g.nearby(p.x,p.z,105));
      if(!near||near.error>95**2||near.edge.kind.startsWith('motorway'))continue;
      const road=g.sample(near),nx=Math.cos(road.yaw),nz=Math.sin(road.yaw);
      const side=(p.x-road.x)*nx+(p.z-road.z)*nz>=0?1:-1;
      const w=worldRoadHalfWidth(near.edge);
      // Keep the mapped pin on the minimap. Place its name board on the same
      // side of the street in a free patch of verge near the entrance.
      let position;
      for(const along of [0,3,-3,6,-6]){
        const x=road.x+side*nx*(w+2.25)+along*nz,z=road.z+side*nz*(w+2.25)-along*nx;
        if(clear(x,z,.45)&&!positions.some(q=>Math.hypot(x-q.x,z-q.z)<5)){position={x,z};break;}
      }
      if(!position)continue;
      let item=signs.get(p.id);if(!item){item=makeSign(p);signs.set(p.id,item);}
      item.group.position.set(position.x-originX,ground(position.x,position.z),position.z-originZ);
      item.group.rotation.y=Math.atan2(-side*nx,-side*nz);keep.add(p.id);positions.push(position);
    }
    for(const [id,item] of signs)if(!keep.has(id))removeSign(id,item);
  }
  function updatePaths(g,segments,clear){
    const candidates=[],hour=localHour();
    for(const s of segments){
      if(s.rank>310||s.len<10||s.graded||s.kind.startsWith('motorway'))continue;
      // Anchor each walking path to a station on the original road segment so
      // a rebase or a clipped long road cannot slide its pedestrians around.
      const span=Math.min(13,s.len*.35),step=42;
      const project=-s.ax*s.fx-s.az*s.fz;
      const first=span+1+s.seed%12;
      const start=Math.max(0,Math.ceil((project-310-first)/step));
      for(let k=start;first+k*step<s.len-span-1&&first+k*step<project+310;k++){
        const station=first+k*step,side=(s.seed+k)%2?1:-1;
        const x=originX+s.ax+s.fx*station+side*s.nx*(s.w+1);
        const z=originZ+s.az+s.fz*station+side*s.nz*(s.w+1);
        const distance=Math.hypot(x-originX,z-originZ);if(distance>310)continue;
        const score=activity(g,x,z,s.kind,hour).walkers;
        const hash=(Math.imul(s.seed^k,2654435761)>>>0)/4294967296;
        if(hash>score*.88)continue;
        candidates.push({x,z,fx:s.fx,fz:s.fz,span,phase:hash*53,rank:distance/(.45+score),key:s.seed+':'+k});
      }
    }
    candidates.sort((a,b)=>a.rank-b.rank);
    paths=[];
    for(const p of candidates){
      if(paths.length>=(small?6:11))break;
      if(paths.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<5))continue;
      let valid=true;
      for(let d=-p.span;d<=p.span+.01;d+=p.span/Math.ceil(p.span)){
        if(!clear(p.x+d*p.fx,p.z+d*p.fz,.3)){valid=false;break;}
      }
      if(valid)paths.push(p);
    }
  }
  function rebuild(g,x,z,segments,clear,ground){
    graph=g;originX=x;originZ=z;
    places=amenities.nearby(g,x,z,500).filter(p=>vietnamPlaceTypes[p.kind]).sort((a,b)=>
      Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
    bins.clear();
    for(const p of places){
      const key=Math.floor(p.x/128)+','+Math.floor(p.z/128);
      if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);
    }
    updateSigns(g,clear,ground);updatePaths(g,segments,clear);
  }
  function walker(i){
    if(walkers[i])return walkers[i];
    const group=new T.Group();walkGroup.add(group);
    const item={group};walkers[i]=item;
    const asset=i%3===1?'hiker':'casual-walker';
    if(!models.has(asset))models.set(asset,TrafficModels.load.loadAsync('traffic/'+asset+'.glb'));
    models.get(asset).then(data=>{
      const rig=TrafficModels.clone(data.scene);group.add(rig);
      const clip=data.animations.find(c=>c.name==='walk');
      if(clip){item.mixer=new T.AnimationMixer(rig);item.mixer.clipAction(clip).play();item.mixer.setTime(i*.31);}
    }).catch(()=>{});
    return item;
  }
  function render(dt,x,z,ground){
    walkTime+=dt;
    for(let i=0;i<Math.max(paths.length,walkers.length);i++){
      const p=paths[i],visible=p&&Math.hypot(p.x-x,p.z-z)<175;
      if(!visible){if(walkers[i])walkers[i].group.visible=false;continue;}
      const actor=walker(i),t=(p.phase+walkTime*(.9+(i%3)*.12))%(4*p.span);
      const along=p.span-Math.abs(t-2*p.span),sign=t<2*p.span?1:-1;
      const wx=p.x+p.fx*along,wz=p.z+p.fz*along;
      actor.group.position.set(wx-originX,ground(wx,wz)+.015,wz-originZ);
      actor.group.rotation.y=Math.atan2(sign*p.fx,sign*p.fz);actor.group.visible=true;
      actor.mixer?.update(dt);
    }
  }
  return {activity,rebuild,render,get places(){return places;}};
}
