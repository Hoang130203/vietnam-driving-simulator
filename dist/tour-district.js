'use strict';
function createTourDistrict(T,scene,plaster){
  const group=new T.Group();group.name='OSM building footprints';scene.add(group);
  const wall=plaster.clone();wall.vertexColors=true;wall.side=T.DoubleSide;
  const roof=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.9});
  // Window bays follow the measured edge length and the floor count. Shade them
  // in the wall pass, so a dense city block costs the same two draws on a phone.
  wall.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 bays; varying vec2 vBays;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vBays=bays;');
    shader.fragmentShader='varying vec2 vBays;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      if(vBays.x>=0.){
        vec2 p=fract(vBays),aa=clamp(fwidth(vBays),vec2(.008),vec2(.18));
        vec2 pane=smoothstep(vec2(.2,.25)-aa,vec2(.2,.25)+aa,p)*(1.-smoothstep(vec2(.8,.78)-aa,vec2(.8,.78)+aa,p));
        float frame=1.-smoothstep(.013,.013+aa.x,abs(p.x-.5));
        float light=.77+.22*sin(dot(floor(vBays),vec2(7.2,3.9)));
        vec3 glazing=mix(vec3(.056,.084,.088),vec3(.25,.36,.38),p.y)*light;
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(glazing,vec3(.18,.17,.15),frame),pane.x*pane.y);
      }`);
  };
  const palette=[0xf3e1c6,0xd3d9cc,0xe9d0bb,0xf0d9a7,0xb9c6c9,0xeae6db].map(v=>new T.Color(v));
  const roofs=[0x9f6757,0xa09a8e,0x798d92,0xaca69c].map(v=>new T.Color(v));
  const concrete=new T.Color(0x989186);
  let indexPromise,available,grid,scale,loadedGraph,signature,loaded=[],cells=new Map(),serial=0;
  const cache=new Map(),blocks=new Map(),cell=32;
  async function load(graph,x,z){
    const seq=++serial;
    try{
      indexPromise??=fetch('tour-buildings/index.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();})
        .then(data=>{available=new Set(data.tiles);grid=data.grid;scale=data.scale;}).catch(e=>{indexPromise=null;throw e;});
      await indexPromise;
      const [lon,lat]=graph.geo(x,z),keys=[],reach=1100;
      for(let i=Math.floor((lon-reach/graph.mx)*grid);i<=Math.floor((lon+reach/graph.mx)*grid);i++)
        for(let j=Math.floor((lat-reach/graph.my)*grid);j<=Math.floor((lat+reach/graph.my)*grid);j++){
          const key=i+'_'+j;if(available.has(key))keys.push(key);
        }
      const next=keys.join('/');if(graph===loadedGraph&&next===signature)return false;
      const data=await Promise.all(keys.map(k=>{
        if(!cache.has(k))cache.set(k,fetchMapTile('tour-buildings/'+k+'.gz').catch(e=>{cache.delete(k);throw e;}));
        return cache.get(k);
      }));
      if(seq!==serial)return false;
      for(const k of cache.keys())if(!keys.includes(k))cache.delete(k);
      loaded=data.flat();loadedGraph=graph;signature=next;return true;
    }catch{return false;}
  }
  function decode(raw,graph){
    let lon=0,lat=0;
    const ring=[];
    for(let i=0;i<raw.length;i+=2){lon+=raw[i];lat+=raw[i+1];const p=graph.point(lon/scale,lat/scale);ring.push(new T.Vector2(p.x,p.z));}
    return ring;
  }
  function contact(x,z,r){
    let hit;
    for(const b of cells.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[]){
      if(x<b.minX-r||z<b.minZ-r||x>b.maxX+r||z>b.maxZ+r)continue;
      let inside=false,min=Infinity,px,pz;
      for(const ring of b.rings){
        for(let j=0,k=ring.length-1;j<ring.length;k=j++){
          const a=ring[k],c=ring[j],dx=c.x-a.x,dz=c.y-a.y;
          if((a.y>z)!==(c.y>z)&&x<a.x+(z-a.y)*dx/dz)inside=!inside;
          const f=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1)));
          const xx=a.x+f*dx,zz=a.y+f*dz,d=(x-xx)**2+(z-zz)**2;
          if(d<min){min=d;px=xx;pz=zz;}
        }
      }
      const d=Math.sqrt(min),depth=r+(inside?d:-d);
      if(depth<=0||hit&&hit.depth>=depth)continue;
      const dir=inside?-1:1;
      hit={nx:d?dir*(x-px)/d:1,nz:d?dir*(z-pz)/d:0,depth,pointX:px,pointZ:pz,height:b.h,kind:'building',id:b.id};
    }
    return hit;
  }
  function build(graph,cx,cz,landmarks,ground=()=>0){
    for(const mesh of [...group.children]){group.remove(mesh);mesh.geometry.dispose();}
    cells.clear();blocks.clear();if(graph!==loadedGraph)return;
    const batches=[wall,roof].map(mat=>({mat,pos:[],uv:[],cols:[],bays:[]}));
    let baseY=0;
    function vertex(b,x,y,z,u,v,tint){b.pos.push(x-cx,baseY+y,z-cz);b.uv.push(u,v);b.cols.push(tint.r,tint.g,tint.b);}
    function quad(b,a,c,lo,hi,tint,count,floors){
      const span=a.distanceTo(c);
      for(const [p,y,u] of [[a,lo,0],[c,lo,span],[a,hi,0],[c,lo,span],[c,hi,span],[a,hi,0]]){
        vertex(b,p.x,y,p.y,u/5,y/4,tint);b.bays.push(count?u/span*count:-1,Math.max(0,y)/hi*floors);
      }
    }
    for(const [id,kind,tagH,levels,raw,shape] of loaded){
      const first=graph.point(raw[0][0]/scale,raw[0][1]/scale);
      if(Math.abs(first.x-cx)>850||Math.abs(first.z-cz)>850)continue;
      const rings=raw.map(r=>decode(r,graph)).filter(r=>r.length>=3);
      if(!rings.length)continue;
      const outer=rings[0];let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
      for(const p of outer){minX=Math.min(minX,p.x);minZ=Math.min(minZ,p.y);maxX=Math.max(maxX,p.x);maxZ=Math.max(maxZ,p.y);}
      const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
      if(Math.hypot(x-cx,z-cz)>620+Math.hypot(maxX-minX,maxZ-minZ)/2||landmarks?.reserved(x,z,1))continue;
      // Keep floors level, and seat the plinth against the terrain around the
      // entire footprint, including courtyard edges and long downhill walls.
      baseY=ground(x,z);
      const profiles=rings.map(ring=>ring.map((a,j)=>{
        const c=ring[(j+1)%ring.length],steps=Math.max(1,Math.ceil(a.distanceTo(c)/12)),samples=[];
        for(let k=0;k<steps;k++){
          const t=k/steps,px=a.x+(c.x-a.x)*t,pz=a.y+(c.y-a.y)*t,h=ground(px,pz);
          baseY=Math.max(baseY,h);samples.push({x:px,z:pz,h});
        }
        return samples;
      }));
      const seed=Math.abs(parseInt(id.slice(1),10)||0),warehouse=/warehouse|industrial|shed|garage|roof|barn/.test(kind);
      const h=Math.min(460,Math.max(2,tagH||levels*3.3||(warehouse?5.4:3.7+seed%3*3))),b={id,h,rings,minX,minZ,maxX,maxZ};
      const block=Math.floor(x/70)+','+Math.floor(z/70);blocks.set(block,(blocks.get(block)||0)+1);
      for(let i=Math.floor((minX-12)/cell);i<=Math.floor((maxX+12)/cell);i++)for(let j=Math.floor((minZ-12)/cell);j<=Math.floor((maxZ+12)/cell);j++){
        const key=i+','+j;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b);
      }
      const flat=rings.flat(),roofColor=roofs[seed%roofs.length],base=palette[seed%palette.length];
      let eave=h;
      if(rings.length===1&&outer.length===4&&['hipped','gabled','pyramidal','hipped-and-gabled'].includes(shape)){
        const start=outer[0].distanceTo(outer[1])>=outer[1].distanceTo(outer[2])?0:1;
        const [a,c,d,f]=Array.from({length:4},(_,i)=>outer[(start+i)%4]);
        eave=h-Math.min(h*.25,3,a.distanceTo(f)*.25);
        const l=a.clone().lerp(f,.5),r=c.clone().lerp(d,.5);
        const inset=shape==='gabled'?0:shape==='pyramidal'?.5:.2;
        const highL=l.clone().lerp(r,inset),highR=r.clone().lerp(l,inset);
        for(const tri of [[a,c,highR],[a,highR,highL],[f,highL,highR],[f,highR,d],[f,a,highL],[c,d,highR]]){
          for(const p of tri)vertex(batches[1],p.x,p===highL||p===highR?h:eave,p.y,0,0,roofColor);
        }
      }else{
        for(const tri of T.ShapeUtils.triangulateShape(outer,rings.slice(1)))for(const index of [tri[0],tri[2],tri[1]]){
          const p=flat[index];vertex(batches[1],p.x,h,p.y,0,0,roofColor);
        }
      }
      for(let ri=0;ri<rings.length;ri++)for(let j=0;j<rings[ri].length;j++){
        const ring=rings[ri],profile=profiles[ri];
        const a=ring[j],c=ring[(j+1)%ring.length],length=a.distanceTo(c);
        if(length<.2)continue;
        const count=warehouse?0:Math.floor(length/2.85),floors=Math.max(1,Math.round(h/3.3));
        const samples=profile[j],next=profile[(j+1)%ring.length][0],wallBatch=batches[0];
        // On nearly level blocks the wall itself can reach beneath the grass.
        if(samples.every(p=>baseY-p.h<.16)&&baseY-next.h<.16){
          quad(wallBatch,a,c,-.39,eave,base,count,floors);continue;
        }
        quad(wallBatch,a,c,0,eave,base,count,floors);
        for(let k=0;k<samples.length;k++){
          const l=samples[k],r=samples[k+1]||profile[(j+1)%ring.length][0];
          // The grass mesh sits 17 cm below the nominal ground.
          const lowL=l.h-baseY-.22,lowR=r.h-baseY-.22;
          for(const [p,y] of [[l,lowL],[r,lowR],[l,0],[r,lowR],[r,0],[l,0]]){
            vertex(wallBatch,p.x,y,p.z,Math.hypot(p.x-a.x,p.z-a.y)/5,y/4,concrete);
            wallBatch.bays.push(-1,0);
          }
        }
      }
    }
    for(const b of batches){
      if(!b.pos.length)continue;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(b.cols,3));if(b.bays.length)g.setAttribute('bays',new T.Float32BufferAttribute(b.bays,2));g.computeVertexNormals();
      const mesh=new T.Mesh(g,b.mat);mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
    }
  }
  return {load,build,contact,builtUp:(x,z)=>cells.has(Math.floor(x/cell)+','+Math.floor(z/cell)),
    mappedBlock:(x,z)=>(blocks.get(Math.floor(x/70)+','+Math.floor(z/70))||0)>=3};
}
