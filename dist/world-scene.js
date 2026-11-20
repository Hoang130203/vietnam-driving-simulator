'use strict';
(() => {
  const widths={motorway:7.3,trunk:6.9,primary:6.1,secondary:5.2,tertiary:4.6,residential:3.4,unclassified:3.4,service:2.8};
  const namedPass=e=>e&&typeof e==='object'&&e.name?.startsWith('Đèo ')&&!e.oneway;
  window.worldRoadHalfWidth=edge=>{
    const kind=typeof edge==='string'?edge:edge?.kind;
    const w=String(kind).endsWith('_link')?3.8:widths[kind]||4.2;
    return namedPass(edge)?Math.min(w,3.85):w;
  };

  window.createWorldScene=function(canvas){
    const T=window.THREE,scene=new T.Scene();
    const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    const small=matchMedia('(pointer:coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio,small?1.25:1.65));
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
    scene.background=new T.Color(0xaec5d2);scene.fog=new T.FogExp2(0xc2d1d0,.00072);
    const camera=new T.PerspectiveCamera(61,1,.14,28000);
    const skyLoader=new T.TextureLoader();
    function texture(file,tile=false){
      const t=skyLoader.load('streetscape/'+file);
      t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(tile)t.wrapS=t.wrapT=T.RepeatWrapping;
      return t;
    }
    skyLoader.load('streetscape/sky.jpg',t=>{t.colorSpace=T.SRGBColorSpace;t.mapping=T.EquirectangularReflectionMapping;scene.background=t;});
    skyLoader.load('streetscape/river-reflection.jpg',t=>{t.colorSpace=T.SRGBColorSpace;t.mapping=T.EquirectangularReflectionMapping;scene.environment=t;});
    scene.add(new T.HemisphereLight(0xd9ebff,0x888574,1.15));
    const sun=new T.DirectionalLight(0xffefcf,2.30);
    sun.castShadow=true;sun.shadow.mapSize.setScalar(small?1024:2048);
    Object.assign(sun.shadow.camera,{left:-43,right:43,bottom:-43,top:43,near:1,far:175});
    sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.025;sun.shadow.bias=-.00025;scene.add(sun,sun.target);
    const basic=c=>new T.MeshLambertMaterial({color:c});
    const surfaces=createRoadSurfaces(T,renderer);
    const material={
      asphalt:surfaces.scanned('asphalt',0xaeb2b3,.41),
      earth:surfaces.scanned('verge',0xd7d1bc,.65),
      white:basic(0xe8e8d7),yellow:basic(0xf0ca63),wall:surfaces.scanned('plaster',0xfff9e9,.6),roof:basic(0x748585),
      gable:new T.MeshStandardMaterial({color:0xf6e2c6,roughness:.84}),
      pavement:basic(0xc2b8a3),steel:basic(0x687877),concrete:basic(0xb0afa3),glass:new T.MeshStandardMaterial({color:0x5c7979,roughness:.19,metalness:.53,envMapIntensity:.86}),
      awning:basic(0x9c9f92),tree:new T.MeshLambertMaterial({map:texture('roadside-tree.webp'),alphaTest:.46,side:T.DoubleSide,color:0xd4dbcc,emissive:0x262b23}),
      palm:new T.MeshLambertMaterial({map:texture('roadside-palm.webp'),alphaTest:.46,side:T.DoubleSide,color:0xd6dccb,emissive:0x262b23})
    };
    const weather=createDrivingWeather(T,scene,sun,material.asphalt);
    const stoneNormal=skyLoader.load('streetscape/surfaces/cut-rock-normal.webp');
    stoneNormal.wrapS=stoneNormal.wrapT=T.RepeatWrapping;
    material.cut=new T.MeshStandardMaterial({map:texture('surfaces/cut-rock-color.webp',true),normalMap:stoneNormal,
      normalScale:new T.Vector2(.62,.62),roughness:.96,side:T.DoubleSide,color:0xbcb5a6});
    material.pine=new T.MeshLambertMaterial({map:texture('surfaces/mountain-pine.webp'),alphaTest:.34,side:T.DoubleSide,color:0xe7ede4});
    material.fern=new T.MeshLambertMaterial({map:texture('surfaces/bank-fern.webp'),alphaTest:.38,side:T.DoubleSide,color:0xd6dfd1});
    // A photographed crown already contains branch and leaf shading. Shared
    // upward normals avoid black panels when a crossed sheet faces away from the sun.
    for(const canopy of [material.tree,material.pine,material.palm,material.fern]){
      canopy.customProgramCacheKey=()=>canopy===material.pine||canopy===material.fern?'understory':'canopy';
      canopy.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\n objectNormal=vec3(0.,1.,0.);');
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
          '#include <normal_fragment_begin>\n normal*=faceDirection;');
        if(canopy===material.pine||canopy===material.fern)shader.fragmentShader=shader.fragmentShader.replace(
          '#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=2.25;');
      };
    }
    material.rail=new T.MeshStandardMaterial({color:0xaab2af,metalness:.55,roughness:.49,side:T.DoubleSide});
    material.asphalt.side=material.earth.side=T.DoubleSide;
    material.pavers=new T.MeshStandardMaterial({color:0xb5ada4,roughness:.91,side:T.DoubleSide});
    const gardenLawn=new T.MeshLambertMaterial({color:0x73915b,side:T.DoubleSide});
    const woodlandFloor=new T.MeshLambertMaterial({color:0x455d3c,side:T.DoubleSide});
    material.pavers.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 paving;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\n paving=(instanceMatrix*vec4(position,1.)).xz;\n#else\n paving=position.xz;\n#endif');
      shader.uniforms.paverOrigin={value:landOrigin};
      shader.fragmentShader='uniform vec2 paverOrigin; varying vec2 paving;\n'+shader.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
         vec2 p=(paving+paverOrigin)/vec2(.49,.25);p.x+=.5*mod(floor(p.y),2.);
         vec2 edge=min(fract(p),1.-fract(p)),aa=max(fwidth(p),vec2(.01));
         vec2 face=smoothstep(vec2(.01)-aa*.5,vec2(.044)+aa*.5,edge);
         float detail=1.-smoothstep(.35,1.6,max(aa.x,aa.y));
         diffuseColor.rgb*=mix(.94,mix(.57,1.,face.x*face.y),detail);`);
    };
    surfaces.transform(material.wall,2,2);
    const shopTypes=['cafe','bakery','grocer','pho','garage','pharmacy'];
    const upstairs=new Set(['cafe','grocer','pharmacy']);
    for(const [i,name] of shopTypes.entries()){
      material['front'+i]=new T.MeshStandardMaterial({
        name:'Shopfront '+name,map:texture('surfaces/front-'+name+'.webp'),roughness:.91,metalness:0
      });
    }
    const meadow=surfaces.scanned('meadow',0xafbd9d,.56);
    const upland=surfaces.scanned('grass',0x8ea68d,.67);
    const landWidth=2048;
    const land=new T.Mesh(new T.PlaneGeometry(landWidth,landWidth,32,32),meadow);
    const landIndex=land.geometry.index;
    land.geometry.setAttribute('shoreSediment',new T.Float32BufferAttribute(new Float32Array(land.geometry.attributes.position.count),1));
    let shorePatch=null;
    const shoreEarth=texture('verge-earth.webp',true);
    const landOrigin=new T.Vector2();
    // Low-frequency variation is fixed in geographic space. Close-up grain stays sharp.
    for(const mat of [meadow,upland]){
      mat.onBeforeCompile=shader=>{
        shader.uniforms.landOrigin={value:landOrigin};shader.uniforms.shoreEarth={value:shoreEarth};
        shader.vertexShader='uniform vec2 landOrigin; varying vec2 groundMetres; attribute float shoreSediment; varying float bankWet;\n'+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n groundMetres=vec2(position.x,-position.y)+landOrigin; bankWet=shoreSediment;');
        shader.fragmentShader='varying vec2 groundMetres; varying float bankWet; uniform sampler2D shoreEarth;\n'+shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n float patchiness=sin(dot(groundMetres,vec2(.035,.019)))+.55*cos(dot(groundMetres,vec2(-.015,.047))); diffuseColor.rgb*=vec3(.96,.98,.95)+patchiness*vec3(.08,.035,.05); vec3 silt=texture2D(shoreEarth,groundMetres*.58).rgb; float bank=clamp(bankWet+(silt.g-.17)*.7,0.,1.)*smoothstep(0.,.2,bankWet); diffuseColor.rgb=mix(diffuseColor.rgb,silt*mix(vec3(.84,.78,.66),vec3(.34,.31,.25),bankWet),bank);');
      };
    }
    land.rotation.x=-Math.PI/2;land.position.y=-.17;land.receiveShadow=true;scene.add(land);
    const waterSurface=createDrivingWater(T,true);
    const relief=createVietnamRelief(T,scene,small);
    const unitBox=new T.BoxGeometry(),unitPlane=new T.PlaneGeometry(),unitPole=new T.CylinderGeometry(.5,.5,1,8);
    const roofSection=new T.Shape();roofSection.moveTo(-.5,0);roofSection.lineTo(0,1);roofSection.lineTo(.5,0);roofSection.closePath();
    const gable=new T.ExtrudeGeometry(roofSection,{depth:1,bevelEnabled:false});gable.translate(0,0,-.5);
    const wireMaterial=new T.LineBasicMaterial({color:0x50554d,transparent:true,opacity:.64});
    const temp=new T.Object3D(),tone=new T.Color();
    const roadsideImpact=createRoadsideImpact(T,scene,relief.ground);
    let roadway=relief.ground,shoreBed=()=>null,wooded=false;
    const driveGround=(x,z)=>shoreBed(x,z)??roadway(x,z);
    function driveGrade(x,z,yaw){
      const dx=2.2*Math.sin(yaw),dz=-2.2*Math.cos(yaw);
      return (driveGround(x+dx,z+dz)-driveGround(x-dx,z-dz))/4.4;
    }
    let roadGroup=null,originX=0,originZ=0,shadowStamp=-1000;
    const landmarks=window.VietnamLandmarks?.create(T,scene);
    const district=createTourDistrict(T,scene,material.wall);
    let nearbyWaterLevel=()=>null;
    let obstacleCells=new Map(),waterAt=()=>null;
    const obstacleKey=(x,z)=>Math.floor(x/15)+','+Math.floor(z/15);
    function registerObstacle(o){
      roadsideImpact.register(o);
      const reach=o.radius||Math.hypot(o.w,o.d);
      for(let i=Math.floor((o.x-reach-3)/15);i<=Math.floor((o.x+reach+3)/15);i++)
        for(let j=Math.floor((o.z-reach-3)/15);j<=Math.floor((o.z+reach+3)/15);j++){
          const key=i+','+j;
          if(!obstacleCells.has(key))obstacleCells.set(key,[]);
          obstacleCells.get(key).push(o);
        }
      return o;
    }
    function contact(x,z,r=.95){
      const px=x-originX,pz=z-originZ;
      let hit=null;
      for(const o of obstacleCells.get(obstacleKey(px,pz))||[]){
        const dx=px-o.x,dz=pz-o.z;
        let nx,nz,depth;
        if(o.radius){
          const dist=Math.hypot(dx,dz);
          nx=dist?dx/dist:1;nz=dist?dz/dist:0;depth=r+o.radius-dist;
        }else{
          const u=dx*o.fx+dz*o.fz,v=-dx*o.fz+dz*o.fx;
          let a=u-Math.min(o.w,Math.max(-o.w,u)),b=v-Math.min(o.d,Math.max(-o.d,v));
          const dist=Math.hypot(a,b);
          if(dist){depth=r-dist;a/=dist;b/=dist;}
          else if(o.w-Math.abs(u)<o.d-Math.abs(v)){depth=r+o.w-Math.abs(u);a=u>=0?1:-1;b=0;}
          else{depth=r+o.d-Math.abs(v);a=0;b=v>=0?1:-1;}
          nx=a*o.fx-b*o.fz;nz=a*o.fz+b*o.fx;
        }
        if(depth>0&&(!hit||depth>hit.depth))hit={nx,nz,depth,kind:o.kind,id:o.id,height:o.height,pointX:x+nx*(depth-r),pointZ:z+nz*(depth-r)};
      }
      return hit||landmarks?.contact(x,z,r)||district.contact(x,z,r);
    }
    function discardRoads(){
      if(!roadGroup)return;scene.remove(roadGroup);
      roadGroup.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();else if(obj.geometry)obj.geometry.dispose();});
    }
    function setRoads(edges,cx,cz,water=[],graph=null){
      relief.setOrigin(graph,cx,cz);
      const localGround=(x,z)=>relief.ground(cx+x,cz+z);
      landmarks?.setOrigin(graph,cx,cz,relief.ground);
      district.build(graph,cx,cz,landmarks,relief.ground);
      const vistas=[];
      if(graph)for(const site of VietnamLandmarks.entries){
        const end=graph.point(site.lon,site.lat);if(Math.hypot(end.x-cx,end.z-cz)>1000)continue;
        const start=graph.point(...site.start),dx=end.x-start.x,dz=end.z-start.z;
        vistas.push({start,dx,dz,length2:dx*dx+dz*dz||1});
      }
      function onApproach(x,z){
        return vistas.some(v=>{
          const dx=x-v.start.x,dz=z-v.start.z,f=(dx*v.dx+dz*v.dz)/v.length2;
          return f>-.12&&f<1.1&&Math.hypot(dx-v.dx*f,dz-v.dz*f)<9;
        });
      }
      if(shorePatch){shorePatch.dispose();shorePatch=null;}
      discardRoads();roadGroup=new T.Group();scene.add(roadGroup);originX=cx;originZ=cz;
      const gx=Math.round(cx/64)*64,gz=Math.round(cz/64)*64,positions=land.geometry.attributes.position;
      landOrigin.set(gx,gz);land.position.set(gx-cx,-.17,gz-cz);
      for(let i=0;i<positions.count;i++)positions.setZ(i,relief.ground(gx+positions.getX(i),gz-positions.getY(i)));
      positions.needsUpdate=true;land.geometry.computeVertexNormals();land.geometry.computeBoundingSphere();
      // Local plane UV runs towards -Z. Synchronize the three PBR maps at a rebase.
      for(const [mat,tile] of [[meadow,3.1],[upland,14.2]]){
        surfaces.transform(mat,landWidth/tile,landWidth/tile,(gx/tile)%1,(-gz/tile)%1);
      }
      const natural=localGround;
      const complexCenter=graph?.point(105.7956,20.5528);
      const innerPrecinct=complexCenter&&Math.hypot(complexCenter.x-cx,complexCenter.z-cz)<1500;
      const cover=innerPrecinct?(window.tamChucGroundCover||[]).map(([kind,coords])=>{
        const points=[];
        for(let i=0;i<coords.length;i+=2){
          const p=graph.point(105.79+coords[i]/1e6,20.54+coords[i+1]/1e6);
          points.push(new T.Vector2(p.x-cx,p.z-cz));
        }
        return {kind,points,bounds:new T.Box2().setFromPoints(points)};
      }):[];
      const groves=cover.filter(p=>p.kind==='wood');
      function inGrove(x,z){
        return groves.some(({points,bounds})=>{
          if(x<bounds.min.x||x>bounds.max.x||z<bounds.min.y||z>bounds.max.y)return false;
          let inside=false;
          for(let i=0,j=points.length-1;i<points.length;j=i++){
            const a=points[i],b=points[j];
            if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
          }
          return inside;
        });
      }
      const passRoad=edges.some(namedPass);
      wooded=passRoad||relief.altitude(cx,cz)>280;
      const segments=[],cells=new Map(),roadData=[],landData=[],bankData=[],railVerts=[],railIndices=[],cutVerts=[],cutUv=[],cutIndices=[],yellow=[],white=[],wires=[],junctions=new Map(),batches=new Map(),candidates=[],rivals=new Map();
      obstacleCells=new Map();
      roadsideImpact.rebase(cx,cz);
      const cellSize=32,cutoff=650;
      // A small occupancy mask lets each generated building test its footprint in constant time.
      const maskSize=336,maskScale=.25;
      // Raster cells are aligned in world metres across render-origin shifts.
      const maskX=Math.floor((cx-cutoff)/4)*4-cx,maskZ=Math.floor((cz-cutoff)/4)*4-cz;
      let wetMask=null;
      const sampleShore=(x,z)=>shorePatch?.sample(x,z)||null;
      if(water.length){
        const mask=document.createElement('canvas');mask.width=mask.height=maskSize;
        const painter=mask.getContext('2d',{willReadFrequently:true});
        painter.setTransform(maskScale,0,0,maskScale,-maskX*maskScale,-maskZ*maskScale);
        painter.fillStyle=painter.strokeStyle='#fff';painter.lineJoin=painter.lineCap='round';
        const currentCanvas=mask.cloneNode();
        const current=currentCanvas.getContext('2d',{willReadFrequently:true});
        current.setTransform(painter.getTransform());current.lineCap='round';
        // A named lake may be split into rings to preserve islands. Estimate a
        // shared stage from its shore samples, keeping the water below the banks.
        const samples=new Map(),poolIds=new Map(),pools=[null];
        for(const feature of water){
          if(feature.kind!=='lake'||! /^(hồ|đầm|ao|bàu)\s/i.test(feature.name||''))continue;
          if(!samples.has(feature.name))samples.set(feature.name,[]);
          const values=samples.get(feature.name),stride=Math.max(1,Math.ceil(feature.points.length/18));
          for(let i=0;i<feature.points.length;i+=stride){const p=feature.points[i];values.push(relief.ground(p.x,p.z));}
        }
        for(const [name,values] of samples){
          if(pools.length>=255)break;
          values.sort((a,b)=>a-b);poolIds.set(name,pools.length);pools.push(values[Math.floor(values.length*.16)]-.58);
        }
        for(const feature of water){
          if(!feature.points||feature.points.length<2)continue;
          if(feature.kind==='lake'){
            let ring=feature.points.map(p=>new T.Vector2(p.x-cx,p.z-cz));
            if(ring.at(-1).equals(ring[0]))ring.pop();
            // Clip the ring first so a lake stretching into other tiles stays cheap to render.
            for(const [axis,limit,sign] of [['x',-cutoff,1],['x',cutoff,-1],['y',-cutoff,1],['y',cutoff,-1]]){
              if(!ring.length)break;
              const clean=[];let prev=ring.at(-1),prevIn=(prev[axis]-limit)*sign>=0;
              for(const p of ring){
                const inside=(p[axis]-limit)*sign>=0;
                if(inside!==prevIn)clean.push(prev.clone().lerp(p,(limit-prev[axis])/(p[axis]-prev[axis])));
                if(inside)clean.push(p);prev=p;prevIn=inside;
              }
              ring=clean;
            }
            if(ring.length<3)continue;
            painter.fillStyle='rgb('+(poolIds.get(feature.name)||0)+',0,0)';
            painter.beginPath();painter.moveTo(ring[0].x,ring[0].y);
            for(let i=1;i<ring.length;i++)painter.lineTo(ring[i].x,ring[i].y);
            painter.closePath();
            for(const island of feature.holes||[]){
              painter.moveTo(island[0].x-cx,island[0].z-cz);
              for(const p of island.slice(1))painter.lineTo(p.x-cx,p.z-cz);
              painter.closePath();
            }
            painter.fill('evenodd');
          }else{
            const radius=Math.min(90,Math.max(2,Number(feature.width)||(/suối/i.test(feature.name||'')?8:23)))/2;
            painter.globalCompositeOperation='destination-over';painter.strokeStyle='#000';painter.lineWidth=radius*2;
            for(let i=1;i<feature.points.length;i++){
              let ax=feature.points[i-1].x-cx,az=feature.points[i-1].z-cz,bx=feature.points[i].x-cx,bz=feature.points[i].z-cz;
              const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.01)continue;
              const nx=-dz/len,nz=dx/len;
              const along=Math.max(0,Math.min(len,(-ax*dx-az*dz)/len)),lateral=Math.hypot(ax+dx/len*along,az+dz/len*along);
              if(lateral>cutoff+radius)continue;
              const lo=Math.max(0,along-cutoff-radius),hi=Math.min(len,along+cutoff+radius);
              bx=ax+dx/len*hi;bz=az+dz/len*hi;ax+=dx/len*lo;az+=dz/len*lo;
              const speed=radius<=5?.98:.58;
              current.strokeStyle='rgb('+Math.round(128+126*speed*dx/len)+','+Math.round(128+126*speed*dz/len)+',0)';
              current.lineWidth=radius*2;current.beginPath();current.moveTo(ax,az);current.lineTo(bx,bz);current.stroke();
              painter.beginPath();painter.moveTo(ax,az);painter.lineTo(bx,bz);painter.stroke();
            }
            painter.globalCompositeOperation='source-over';
          }
        }
        wetMask=painter.getImageData(0,0,maskSize,maskSize).data;
        const field=waterBankField(wetMask,current.getImageData(0,0,maskSize,maskSize).data,maskSize,1/maskScale);
        waterSurface.setField(field,maskSize,maskX,maskZ,maskScale,cx,cz);
        shorePatch=buildMappedShore(T,{mask:wetMask,field,size:maskSize,scale:maskScale,maskX,maskZ,cx,cz,gx,gz,landWidth,land,landIndex,
          ground:localGround,pools,group:roadGroup,waterMaterial:waterSurface.material});
      }
      // Index occupied blocks once so narrow streams also enable local reflections.
      const wetBlocks=new Map(),blockSize=16,blocks=Math.ceil(maskSize/blockSize);
      if(wetMask)for(let row=0;row<maskSize;row++)for(let col=0;col<maskSize;col++){
        if(wetMask[(row*maskSize+col)*4+3]<=100)continue;
        const key=Math.floor(row/blockSize)*blocks+Math.floor(col/blockSize);
        const d=(col%blockSize+.5-blockSize/2)**2+(row%blockSize+.5-blockSize/2)**2;
        if(d<(wetBlocks.get(key)?.d??Infinity)){
          wetBlocks.set(key,{x:maskX+(col+.5)/maskScale,z:maskZ+(row+.5)/maskScale,d});
        }
      }
      nearbyWaterLevel=(x,z)=>{
        const col=Math.floor((x-maskX)*maskScale/blockSize),row=Math.floor((z-maskZ)*maskScale/blockSize);
        let nearest=null,distance=Infinity;
        for(let j=Math.max(0,row-2);j<=Math.min(blocks-1,row+2);j++)for(let i=Math.max(0,col-2);i<=Math.min(blocks-1,col+2);i++){
          const p=wetBlocks.get(j*blocks+i);if(!p)continue;
          const d=(x-p.x)**2+(z-p.z)**2;
          if(d<distance){nearest=p;distance=d;}
        }
        return nearest?sampleShore(nearest.x,nearest.z)?.level??null:null;
      };
      function wet(x,z){
        const col=Math.floor((x-maskX)*maskScale),row=Math.floor((z-maskZ)*maskScale);
        return col>=0&&row>=0&&col<maskSize&&row<maskSize&&wetMask[(row*maskSize+col)*4+3]>100;
      }
      function nearbyCell(x,z){return Math.floor(x/cellSize)+','+Math.floor(z/cellSize);}
      function bounds(seg,pad,fn){
        for(let ix=Math.floor((Math.min(seg.ax,seg.bx)-pad)/cellSize);ix<=Math.floor((Math.max(seg.ax,seg.bx)+pad)/cellSize);ix++)
          for(let iz=Math.floor((Math.min(seg.az,seg.bz)-pad)/cellSize);iz<=Math.floor((Math.max(seg.az,seg.bz)+pad)/cellSize);iz++)fn(ix+','+iz);
      }
      function blocked(x,z,r){
        if(landmarks?.reserved(x+cx,z+cz,r)||district.contact(x+cx,z+cz,r))return true;
        if(wetMask&&(wet(x,z)||wet(x+r,z)||wet(x-r,z)||wet(x,z+r)||wet(x,z-r)))return true;
        const list=cells.get(nearbyCell(x,z))||[];
        for(const s of list){
          const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.fx+(z-s.az)*s.fz));
          const dx=x-s.ax-s.fx*t,dz=z-s.az-s.fz*t;
          if(dx*dx+dz*dz<(s.w+r)*(s.w+r))return true;
        }return false;
      }
      // The road graph lacks explicit bridge tags. Keep mapped carriageways
      // above water traversable and sample the exposed bed beyond the deck.
      function onDeck(x,z){
        for(const s of cells.get(nearbyCell(x,z))||[]){
          const d=Math.max(0,Math.min(s.len,(x-s.ax)*s.fx+(z-s.az)*s.fz));
          if(Math.hypot(s.ax+d*s.fx-x,s.az+d*s.fz-z)<s.w+.35)return true;
        }
        return false;
      }
      waterAt=(worldX,worldZ)=>{
        const x=worldX-cx,z=worldZ-cz,shore=sampleShore(x,z);
        return shore&&!onDeck(x,z)?shore:null;
      };
      shoreBed=(worldX,worldZ)=>{
        if(!shorePatch)return null;
        const x=worldX-cx,z=worldZ-cz;
        return onDeck(x,z)?null:shorePatch.sample(x,z,true)?.bed;
      };
      let buildingBase=null;
      function instance(mat,geo,x,y,z,sx,sy,sz,yaw=0,color=null,owner=null){
        const key=mat+':'+geo.id;
        if(!batches.has(key))batches.set(key,{mat,geo,poses:[],colors:[],moving:[]});
        const b=batches.get(key);temp.position.set(x,y+(buildingBase??localGround(x,z)),z);temp.rotation.set(0,yaw,0,'YXZ');
        if(sz>2&&sy<.16&&buildingBase===null){
          temp.rotation.x=-Math.atan(relief.grade(cx+x,cz+z,Math.PI-yaw));
          temp.rotation.z=Math.atan(relief.grade(cx+x,cz+z,Math.PI/2-yaw));
        }temp.scale.set(sx,sy,sz);temp.updateMatrix();
        if(owner)b.moving.push([b.poses.length,owner]);
        b.poses.push(temp.matrix.clone());b.colors.push(color);
      }
      function quad(points,ax,az,bx,bz,cx,cz,dx,dz){points.push(ax,az,bx,bz,cx,cz,cx,cz,bx,bz,dx,dz);}
      function strip(target,s,start,end,l,r){
        const n=s.graded?Math.max(1,Math.ceil((end-start)/5)):1;
        for(let j=0;j<n;j++){
          const a=start+(end-start)*j/n,b=start+(end-start)*(j+1)/n;
          const ax=s.ax+s.fx*a,az=s.az+s.fz*a,bx=s.ax+s.fx*b,bz=s.az+s.fz*b;
          quad(target,ax+s.nx*l,az+s.nz*l,ax+s.nx*r,az+s.nz*r,bx+s.nx*l,bz+s.nz*l,bx+s.nx*r,bz+s.nz*r);
        }
      }
      for(const e of edges){
        const width=window.worldRoadHalfWidth(e);
        for(let i=1;i<e.points.length;i++){
          const a=e.points[i-1],b=e.points[i];
          let ax=a.x-cx,az=a.z-cz,bx=b.x-cx,bz=b.z-cz;
          if(Math.min(ax,bx)>cutoff||Math.max(ax,bx)<-cutoff||Math.min(az,bz)>cutoff||Math.max(az,bz)<-cutoff)continue;
          const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(length<.05)continue;
          const fx=dx/length,fz=dz/length,nx=-fz,nz=fx;
          const near=Math.max(0,Math.min(length,-ax*fx-az*fz)),perp=Math.hypot(ax+near*fx,az+near*fz);
          if(perp>cutoff)continue;
          const seed=(Math.imul(e.id,2246822519)^Math.imul(i,3266489917))>>>0;
          const latitude=graph?graph.lat-a.z/graph.my:0;
          const mx=graph?111320*Math.cos(latitude*Math.PI/180)/graph.mx:1;
          const sourceLength=Math.hypot(dx*mx,dz);
          const s={ax,az,bx,bz,fx,fz,nx,nz,len:length,sourceLength,w:width,kind:e.kind,oneway:e.oneway,rank:perp,seed};
          s.graded=namedPass(e)||wooded&&!district.builtUp(cx+(ax+bx)*.5,cz+(az+bz)*.5)&&!['residential','service','living_street'].includes(e.kind);
          if(s.graded){
            const n=Math.max(1,Math.ceil(length/12));s.interval=length/n;s.crown=[];
            for(let j=0;j<=n;j++){
              const x=ax+fx*s.interval*j,z=az+fz*s.interval*j;
              // Build a level cross-section above the uphill shoulder. The two
              // batters reconnect it to natural ground without canting the car.
              s.crown.push(Math.max(natural(x,z),natural(x+nx*width,z+nz*width),natural(x-nx*width,z-nz*width))+.10+width*.018);
            }
          }
          segments.push(s);strip(landData,s,0,s.len,-width-.85,width+.85);
          if(s.graded){strip(roadData,s,0,s.len,-width,0);strip(roadData,s,0,s.len,0,width);}
          else strip(roadData,s,0,s.len,-width,width);
          for(const [x,z] of [[ax,az],[bx,bz]]){
            const k=Math.round(x*10)+','+Math.round(z*10);
            const node=junctions.get(k);if(node){node.r=Math.max(node.r,width);node.n++;}else junctions.set(k,{x,z,r:width,n:1});
          }
          bounds(s,width+9,key=>{if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);});
        }
      }
      // Share the formation height at every OSM node to keep joined ribbons continuous.
      const crestNodes=new Map(),nodeKey=(x,z)=>Math.round((cx+x)*10)+','+Math.round((cz+z)*10);
      for(const s of segments)if(s.graded){
        for(const [x,z,h] of [[s.ax,s.az,s.crown[0]],[s.bx,s.bz,s.crown.at(-1)]]){
          const k=nodeKey(x,z);
          crestNodes.set(k,Math.max(crestNodes.get(k)??-Infinity,h));
        }
      }
      for(const s of segments)if(s.graded){
        s.crown[0]=crestNodes.get(nodeKey(s.ax,s.az));
        s.crown[s.crown.length-1]=crestNodes.get(nodeKey(s.bx,s.bz));
      }
      roadway=!wooded?relief.ground:(x,z)=>{
        const lx=x-cx,lz=z-cz,naturalY=natural(lx,lz);
        let best=Infinity,height=naturalY;
        for(const s of cells.get(nearbyCell(lx,lz))||[]){
          if(!s.graded)continue;
          const d=Math.max(0,Math.min(s.len,(lx-s.ax)*s.fx+(lz-s.az)*s.fz));
          const cross=Math.hypot(lx-s.ax-s.fx*d,lz-s.az-s.fz*d);
          if(cross>=s.w+4||cross>=best)continue;
          const j=Math.min(s.crown.length-2,Math.floor(d/s.interval)),f=d/s.interval-j;
          const crown=s.crown[j]*(1-f)+s.crown[j+1]*f;
          const t=Math.max(0,Math.min(1,(s.w+4-cross)/3.35));
          height=naturalY+(crown-Math.min(s.w,cross)*.018-naturalY)*t;
          best=cross;
        }
        return height;
      };
      function cutClearance(x,z,own){
        let gap=8;
        for(const other of cells.get(nearbyCell(x,z))||[]){
          if(other===own)continue;
          const t=Math.max(0,Math.min(other.len,(x-other.ax)*other.fx+(z-other.az)*other.fz));
          gap=Math.min(gap,Math.hypot(x-other.ax-t*other.fx,z-other.az-t*other.fz)-other.w);
        }return Math.max(0,Math.min(1,(gap-.6)/4));
      }
      // Taper the fill into the natural slope beneath road bends and at joints.
      function cap(points,x,z,r){
        let a=0;
        for(let i=1;i<=12;i++){const b=i*Math.PI/6;points.push(x,z,x+Math.sin(a)*r,z+Math.cos(a)*r,x+Math.sin(b)*r,z+Math.cos(b)*r);a=b;}
      }
      for(const s of segments)if(s.graded)for(const sign of [-1,1]){
        const mid=s.len*.5,x=s.ax+s.fx*mid,z=s.az+s.fz*mid;
        const uphill=natural(x+s.nx*sign*8,z+s.nz*sign*8)-natural(x,z)>.35;
        strip(bankData,s,0,s.len,sign*(s.w+.68),sign*(s.w+(uphill?2.15:4.25)));
        if(!uphill||s.len<7||wetMask&&wet(x,z)||district.builtUp(cx+x,cz+z))continue;
        const count=Math.max(2,Math.ceil(s.len/2.4));
        let prev=-1;
        for(let j=0;j<=count;j++){
          const u=s.len*j/count,px=s.ax+s.fx*u,pz=s.az+s.fz*u;
          const wx=px+cx,wz=pz+cz,coarse=.5+.5*Math.sin(wx*.03+wz*.016+.8*Math.sin(wz*.047));
          const fracture=Math.sin(wx*.88+wz*.42)*.19+Math.cos(wz*1.14-wx*.29)*.13;
          const toe=1.45+.44*coarse+fracture;
          const footX=px+sign*s.nx*(s.w+toe),footZ=pz+sign*s.nz*(s.w+toe);
          const backX=footX+sign*s.nx*5.5,backZ=footZ+sign*s.nz*5.5;
          const cutRoads=cells.get(nearbyCell((footX+backX)*.5,(footZ+backZ)*.5))||[];
          if(!guardrailFits(footX,footZ,backX,backZ,cutRoads,s.len/count*.5+.45,s)){
            prev=-1;continue;
          }
          const rise=Math.max(0,natural(backX,backZ)-natural(footX,footZ));
          const ends=Math.min(1,u/4,(s.len-u)/4),gap=Math.min(cutClearance(footX,footZ,s),cutClearance(backX,backZ,s));
          const height=Math.min(3.9,.15+rise*(1.15+coarse)+coarse*coarse*1.65)*gap*ends;
          if(height<.08){prev=-1;continue;}
          const row=cutVerts.length/3,bankBase=roadway(wx+(footX-px),wz+(footZ-pz));
          for(const [lateral,y] of [[0,bankBase-.28],[.30+fracture,bankBase+height*.35],[.63-fracture,bankBase+height*.77],
            [1.28+coarse,bankBase+height],[3.1,natural(footX+sign*s.nx*3.1,footZ+sign*s.nz*3.1)+height*.32],[5.5,natural(backX,backZ)-.22]]){
            const xx=footX+sign*s.nx*lateral,zz=footZ+sign*s.nz*lateral;
            cutVerts.push(xx,y,zz);cutUv.push(((xx+cx)*s.fx+(zz+cz)*s.fz)*.33,(y+lateral*.67)*.33);
          }
          if(prev>=0){
            for(let k=0;k<5;k++)cutIndices.push(prev+k,row+k,prev+k+1,prev+k+1,row+k,row+k+1);
            if(height>.48){
              const lastX=cutVerts[prev*3],lastZ=cutVerts[prev*3+2];
              const dx=footX-lastX,dz=footZ-lastZ,length=Math.hypot(dx,dz);
              registerObstacle({id:s.seed+':cut:'+j,kind:'barrier',x:(footX+lastX)*.5,z:(footZ+lastZ)*.5,
                fx:dx/length,fz:dz/length,w:length*.5,d:.13,height,parts:[]});
            }
          }
          prev=row;
          if(j%3===1&&s.rank<260&&height>.8){
            const fh=.6+coarse*.65;
            instance('fern',unitPlane,footX+sign*s.nx*1.6,bankBase+height-natural(footX,footZ)+fh*.37,footZ+sign*s.nz*1.6,fh*2.24,fh,1,wx*.43+wz*.21);
          }
        }

      }
      for(const node of junctions.values()){cap(roadData,node.x,node.z,node.r);cap(landData,node.x,node.z,node.r+.85);}
      function openNearEnd(s,x,z){
        const node=junctions.get(Math.round(x*10)+','+Math.round(z*10));return node&&node.n>2?node.r+1:.0;
      }
      // Placements compete only with immediate neighbours by fixed OSM-derived priority.
      // Reordering visible roads or clipping a distant street cannot cascade into a new layout.
      function compareCandidate(a,b){return a.priority-b.priority||a.key.localeCompare(b.key);}
      const plotSize=12;
      const templeGrounds=graph?VietnamLandmarks.entries.filter(s=>s.gardenRadius).map(s=>({...graph.point(s.lon,s.lat),radius:s.gardenRadius}))
        .filter(p=>Math.hypot(p.x-cx,p.z-cz)<620+p.radius):[];
      function visitPlots(c,cb){
        for(let i=Math.floor((c.hx-c.footprint)/plotSize);i<=Math.floor((c.hx+c.footprint)/plotSize);i++)
          for(let j=Math.floor((c.hz-c.footprint)/plotSize);j<=Math.floor((c.hz+c.footprint)/plotSize);j++)cb(i+','+j);
      }
      for(const s of segments){
        const start=openNearEnd(s,s.ax,s.az),end=s.len-openNearEnd(s,s.bx,s.bz);
        if(end<=start)continue;
        const mid=(start+end)/2,mx=s.ax+s.fx*mid,mz=s.az+s.fz*mid;
        const street=s.kind==='residential'||s.kind==='living_street'||district.builtUp(mx+cx,mz+cz);
        if(street&&s.w<=6.8&&end-start>2&&(!wetMask||!wet(mx,mz))){
          const sw=s.w<4?1.2:1.85,angle=Math.atan2(s.fx,s.fz);
          for(const side of [-1,1]){
            const off=side*(s.w+sw/2);
            instance('pavers',unitBox,mx+s.nx*off,.02,mz+s.nz*off,sw,.14,end-start,angle);
            const lip=side*(s.w+.08);
            instance('concrete',unitBox,mx+s.nx*lip,.035,mz+s.nz*lip,.16,.14,end-start,angle);
          }
        }
        if(s.w>=4.2||s.graded){
          for(const side of [-1,1])strip(white,s,start,end,side*s.w*.94-.055,side*s.w*.94+.055);
          for(let u=start+1;u<end;u+=10)strip(s.oneway?white:yellow,s,u,Math.min(end,u+3.7),-.074,.074);
          if(s.w>=6.75)for(let u=start+2;u<end;u+=11)for(const side of [-1,1])strip(white,s,u,Math.min(end,u+3),side*s.w*.49-.065,side*s.w*.49+.065);
        }
        if(s.rank>620||s.len<3)continue;
        if(!s.graded&&s.w>=4.2&&s.len>=24){
          const spacing=s.w>6?31:38;
          let last=null;
          for(let station=9;station<end-4;station+=spacing){
            const px=s.ax+s.fx*station+s.nx*(s.w+1.7),pz=s.az+s.fz*station+s.nz*(s.w+1.7);
            if(blocked(px,pz,.45)){last=null;continue;}
            const pole=registerObstacle({id:s.seed+':pole:'+station,kind:'pole',x:px,z:pz,radius:.12,parts:[]});
            instance('concrete',unitPole,px,3.65,pz,.17,7.3,.17,0,null,pole);
            const rot=Math.atan2(s.nx,s.nz);
            if(s.w>6){
              instance('steel',unitBox,px-s.nx*.9,7.18,pz-s.nz*.9,.095,.09,1.98,rot,null,pole);
              instance('glass',unitBox,px-s.nx*1.91,7.13,pz-s.nz*1.91,.34,.14,.68,rot,null,pole);
            }else{
              instance('steel',unitBox,px,6.89,pz,.085,.095,1.66,rot,null,pole);
              for(const side of [-1,1]){
                instance('roof',unitPole,px+s.nx*side*.67,7.04,pz+s.nz*side*.67,.1,.23,.1,0,null,pole);
                if(last)for(let j=0;j<6;j++){
                  const f=j/6,t=(j+1)/6;
                  for(const u of [f,t])wires.push(last.x+(px-last.x)*u+s.nx*side*.67,7.13-2.8*u*(1-u),last.z+(pz-last.z)*u+s.nz*side*.67);
                }
              }
            }last={x:px,z:pz};
          }
        }
        const dense=['residential','living_street','secondary','tertiary'].includes(s.kind);
        const step=dense?14:23;
        let first=(s.seed%step)+2;
        if(first>s.sourceLength&&s.sourceLength>5)first=s.sourceLength*.52;
        for(let station=first,index=0;station<s.sourceLength;station+=step,index++){
          const d=station*s.len/s.sourceLength,x=s.ax+s.fx*d,z=s.az+s.fz*d;
          if(Math.hypot(x,z)>620)continue;
          for(const sign of [-1,1]){
            let seed=(s.seed^Math.imul(1+2*index+(sign>0?1:0),1597334677))>>>0;
            const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
            const priority=random(),house=random()<(s.graded?.035:dense?.73:.34),type=Math.floor(random()*shopTypes.length);
            const width=4.5+random()*2.9,depth=5+random()*3.9;
            const dist=s.w+(house?3.5+depth/2:3)+random()*(house?3:5);
            const hx=x+sign*s.nx*dist,hz=z+sign*s.nz*dist,footprint=house?Math.hypot(width,depth)/2+.8:1.7;
            if(house&&(templeGrounds.some(p=>Math.hypot(hx+cx-p.x,hz+cz-p.z)<p.radius)||
              innerPrecinct&&Math.hypot(hx+cx-complexCenter.x,hz+cz-complexCenter.z)<445))continue;
            if(blocked(hx,hz,footprint)||onApproach(hx+cx,hz+cz)||house&&district.mappedBlock(hx+cx,hz+cz))continue;
            const c={key:s.seed+':'+index+':'+sign,priority,s,sign,hx,hz,footprint,house,width,depth,type,random};
            candidates.push(c);
            visitPlots(c,k=>{if(!rivals.has(k))rivals.set(k,[]);rivals.get(k).push(c);});
          }
        }
      }
      for(const c of candidates){
        let obscured=false;
        visitPlots(c,k=>{
          if(obscured)return;
          obscured=rivals.get(k).some(o=>o!==c&&compareCandidate(o,c)<0&&Math.hypot(c.hx-o.hx,c.hz-o.hz)<c.footprint+o.footprint);
        });
        if(obscured)continue;
        const {house,s,sign,hx,hz,width,depth,type,random}=c;
            if(house){
              const h=(upstairs.has(shopTypes[type])?6.7:3.65)+random()*.62;
              registerObstacle({id:c.key,kind:'building',x:hx,z:hz,fx:s.fx,fz:s.fz,w:width/2,d:depth/2,height:h});
              // Local +Z faces the road, with the façade just outside the wall.
              const sx=-s.nx*sign,sz=-s.nz*sign,rot=Math.atan2(sx,sz);
              buildingBase=localGround(hx,hz);
              const foot=Math.abs(localGround(hx+width*.5,hz)-localGround(hx-width*.5,hz))+
                Math.abs(localGround(hx,hz+depth*.5)-localGround(hx,hz-depth*.5));
              if(foot>.14)instance('concrete',unitBox,hx,-foot*.43,hz,width+.06,foot*.9+.10,depth+.06,rot);
              instance('wall',unitBox,hx,h*.5,hz,width,h,depth,rot,[0xe9d4b5,0xc7d6bb,0xf3dfb0][type%3]);
              instance('front'+type,unitPlane,hx+sx*(depth/2+.025),h/2,hz+sz*(depth/2+.025),width,h,1,rot);
              for(const side of [-1,1]){
                const wx=hx+s.fx*side*(width/2+.035),wz=hz+s.fz*side*(width/2+.035);
                for(const floor of h>5?[1.7,4.5]:[1.7]){
                  instance('glass',unitBox,wx,floor,wz,.075,1.05,1.56,rot);
                  instance('concrete',unitBox,wx+s.fx*side*.10,floor-.57,wz+s.fz*side*.10,.28,.09,1.75,rot);
                }
              }
              instance('roof',unitBox,hx,h+.07,hz,width+.46,.19,depth+.52,rot,[0x989d98,0xaf846d,0x99aeb0][type%3]);
              const pitched=h<5&&c.priority<.7;
              if(pitched)instance('gable',gable,hx,h+.14,hz,width+.5,width*.24,depth+.59,rot,[0xa26148,0x825947,0x7b8688][type%3]);
              instance('pavement',unitBox,hx+sx*depth/2,.1,hz+sz*depth/2,width+.35,.2,2.7,rot);
              const porch=depth/2+.72;
              instance('awning',unitBox,hx+sx*porch,2.65,hz+sz*porch,width+.4,.13,1.8,rot,[0xa2a692,0xbc8062,0x809b93][type%3]);
              instance('concrete',unitPole,hx+sx*porch+s.fx*width*.45,1.32,hz+sz*porch+s.fz*width*.45,.09,2.62,.09);
              if(type%3===0&&!pitched)instance('steel',unitPole,hx,h+.65,hz,1.2,1.0,1.2);
              buildingBase=null;
            }else{
              const [lon,lat]=graph?graph.geo(hx+cx,hz+cz):[105,21];
              const uplands=lat>21.3&&lon<106.4||lat>11.6&&lat<15&&lon>107&&lon<108.6;
              const palm=random()<(uplands?.015:lat<11?.48:lat<18?.32:.11),height=(palm?7.5:5)+random()*5,w=height*(palm?.59:.92),r=random()*Math.PI;
              const tree=registerObstacle({id:c.key,kind:'tree',x:hx,z:hz,radius:.27,height,parts:[]});
              for(let k=0;k<2;k++){const angle=r+k*Math.PI/2,off=w*(palm?.07:.12);instance(palm?'palm':'tree',unitPlane,hx+off*Math.cos(angle),height*.49,hz-off*Math.sin(angle),w,height,1,angle,null,tree);}
            }
      }
      if(wooded||innerPrecinct){
        // World-aligned, seeded stands keep their identity as streamed road tiles move.
        // Dense stands only grow in gaps between mapped roads, water and settlements.
        const pitch=innerPrecinct?12:20,radius=innerPrecinct?700:460;
        for(let ix=Math.floor((cx-radius)/pitch);ix<=Math.ceil((cx+radius)/pitch);ix++){
          for(let iz=Math.floor((cz-radius)/pitch);iz<=Math.ceil((cz+radius)/pitch);iz++){
            let seed=(Math.imul(ix,73856093)^Math.imul(iz,19349663))>>>0;
            const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
            const wx=(ix+rand())*pitch,wz=(iz+rand())*pitch;
            if(!wooded&&!inGrove(wx-cx,wz-cz)&&relief.altitude(wx,wz)<63)continue;
            const openness=.46+.19*Math.sin(wx*.013+wz*.004)+.18*Math.sin(wz*.019-wx*.005);
            if(rand()>openness+.24||district.builtUp(wx,wz)||onApproach(wx,wz))continue;
            const lx=wx-cx,lz=wz-cz,dist=Math.hypot(lx,lz);
            if(dist>radius||blocked(lx,lz,5.5)||obstacleCells.has(obstacleKey(lx,lz)))continue;
            const altitude=relief.altitude(wx,wz),cool=altitude>650;
            const pine=cool&&rand()<.73;
            const h=(pine?10:6.7)+rand()*(pine?10:7.1),w=h*(pine?.5:.82)*(.82+rand()*.32);
            const angle=rand()*Math.PI,tint=tone.setHSL(.24+rand()*.10,.08+rand()*.14,.66+rand()*.18).getHex();
            const id='stand:'+ix+':'+iz;
            const tree=registerObstacle({id,kind:'tree',x:lx,z:lz,radius:Math.max(.16,h*.02),height:h,parts:[]});
            const planes=dist>275&&small?1:2;
            for(let k=0;k<planes;k++)instance(pine?'pine':'tree',unitPlane,lx,h*.485,lz,w,h,1,angle+k*Math.PI/2,tint,tree);
            if(dist>210||rand()>.76)continue;
            for(let k=0;k<3;k++){
              const fx=lx+(rand()-.5)*12,fz=lz+(rand()-.5)*12,fh=.6+rand()*1.0;
              if(!blocked(fx,fz,1.5))instance('fern',unitPlane,fx,fh*.47,fz,fh*2.24,fh,1,rand()*Math.PI,tint);
            }
          }
        }
      }
      if(cutVerts.length){
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(cutVerts,3));
        g.setAttribute('uv',new T.Float32BufferAttribute(cutUv,2));g.setIndex(cutIndices);g.computeVertexNormals();
        const bank=new T.Mesh(g,material.cut);bank.name='Exposed rock cuttings';bank.castShadow=true;bank.receiveShadow=true;roadGroup.add(bank);
      }
      // A continuous folded W-beam follows the low shoulder above a drop.
      for(const s of segments){
        if(!s.graded||s.len<3||s.rank>530)continue;
        const mid=s.len/2,x=s.ax+s.fx*mid,z=s.az+s.fz*mid;
        const side=natural(x+s.nx*7,z+s.nz*7)<natural(x-s.nx*7,z-s.nz*7)?1:-1;
        const off=side*(s.w+.47);
        if(natural(x,z)-natural(x+side*s.nx*9,z+side*s.nz*9)<.45||
          wetMask&&wet(x,z)||district.builtUp(cx+x,cz+z))continue;
        const start=openNearEnd(s,s.ax,s.az),end=s.len-openNearEnd(s,s.bx,s.bz),length=end-start;
        if(length<2)continue;
        const count=Math.ceil(length/4),angle=Math.atan2(s.fx,s.fz);
        const span=length/count;
        function row(x,z){
          const first=railVerts.length/3,y=roadway(cx+x,cz+z);
          for(const [push,up] of [[0,.51],[.064,.55],[.012,.605],[.067,.66],[0,.70]])
            railVerts.push(x-side*push*s.nx,y+up,z-side*push*s.nz);
          return first;
        }
        let previousRow=-1;
        for(let j=0;j<count;j++){
          const d=start+span*j,px=s.ax+s.fx*d+s.nx*off,pz=s.az+s.fz*d+s.nz*off;
          const ex=px+s.fx*span,ez=pz+s.fz*span,mx=(px+ex)*.5,mz=(pz+ez)*.5;
          // A side road or the return leg of a hairpin can overlap a shoulder
          // well beyond the node itself. Open the rail and its collider together.
          if(!guardrailFits(px,pz,ex,ez,cells.get(nearbyCell(mx,mz))||[],.32,s)){
            previousRow=-1;continue;
          }
          const a=previousRow>=0?previousRow:row(px,pz),b=row(ex,ez);
          for(let k=0;k<4;k++)railIndices.push(a+k,b+k,a+k+1,a+k+1,b+k,b+k+1);
          previousRow=b;
          const adjust=roadway(cx+px,cz+pz)-natural(px,pz);
          instance('steel',unitBox,px+side*.08*s.nx,adjust+.27,pz+side*.08*s.nz,.10,.88,.12,angle);
          if(j%4===0)instance('white',unitBox,px,adjust+.697,pz,.12,.054,.06,angle);
          registerObstacle({id:s.seed+':rail:'+j,kind:'barrier',x:mx,z:mz,fx:s.fx,fz:s.fz,w:span*.5,d:.10,height:.70,parts:[]});
        }
      }
      if(railVerts.length){
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(railVerts,3));
        g.setIndex(railIndices);g.computeVertexNormals();const rails=new T.Mesh(g,material.rail);
        rails.name='Mountain safety rails';rails.castShadow=true;rails.receiveShadow=true;roadGroup.add(rails);
      }
      function surface(data,mat,y,freq){
        if(!data.length)return;
        const verts=[],uv=[],step=relief.step;

        function vertex(x,z){
          const h=wooded?roadway(cx+x,cz+z):localGround(x,z);
          verts.push(x,h+y,z);
          uv.push(x*freq+(cx*freq)%1,z*freq+(cz*freq)%1);
        }
        // Split at terrain edges so a long road, its paint and the ground coincide
        // even when all three meshes have different source triangulations.
        const offset=[cx,cz,cx+cz];
        function split(poly,axis){
          if(axis===3){
            for(let j=1;j<poly.length-1;j++)for(const p of [poly[0],poly[j],poly[j+1]])vertex(p[0],p[1]);
            return;
          }
          const coord=p=>axis===2?p[0]+p[1]:p[axis];
          let low=Infinity,high=-Infinity;
          for(const p of poly){const v=coord(p);low=Math.min(low,v);high=Math.max(high,v);}
          const cut=(Math.floor((low+offset[axis]+.00001)/step)+1)*step-offset[axis];
          if(cut>=high-.00001){split(poly,axis+1);return;}
          const left=[],right=[];let prev=poly.at(-1),a=coord(prev)-cut;
          for(const p of poly){
            const b=coord(p)-cut;
            if(a*b<0){
              const f=a/(a-b),mid=[prev[0]+(p[0]-prev[0])*f,prev[1]+(p[1]-prev[1])*f];
              left.push(mid);right.push(mid);
            }
            if(b<=0)left.push(p);if(b>=0)right.push(p);prev=p;a=b;
          }
          split(left,axis+1);split(right,axis);
        }
        const same=(a,b,c,o)=>Math.floor((Math.min(a,b,c)+o)/step)===Math.floor((Math.max(a,b,c)+o)/step);
        for(let i=0;i<data.length;i+=6){
          const ax=data[i],az=data[i+1],bx=data[i+2],bz=data[i+3],dx=data[i+4],dz=data[i+5];
          if(same(ax,bx,dx,cx)&&same(az,bz,dz,cz)&&same(ax+az,bx+bz,dx+dz,cx+cz)){
            vertex(ax,az);vertex(bx,bz);vertex(dx,dz);
          }else split([[ax,az],[bx,bz],[dx,dz]],0);
        }
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
        const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;roadGroup.add(mesh);
      }
      material.white.side=material.yellow.side=T.DoubleSide;
      surface(bankData,material.earth,-.065,.60);
      if(cover.length){
        const layer={stone:[],lawn:[],wood:[]};
        for(const {kind,points} of cover){
          for(const face of T.ShapeUtils.triangulateShape(points,[])){
            for(const i of face)layer[kind].push(points[i].x,points[i].y);
          }
        }
        surface(layer.stone,material.pavers,.01,1);
        surface(layer.lawn,gardenLawn,.02,1);
        surface(layer.wood,woodlandFloor,.025,1);
      }
      if(graph&&window.tamChucPaths){
        const center=graph.point(105.7956,20.5528);
        if(Math.hypot(center.x-cx,center.z-cz)<1500){
          const paving=[];
          for(const [steps,coords] of tamChucPaths){
            let a=graph.point(105.79+coords[0]/1e6,20.54+coords[1]/1e6);
            for(let i=2;i<coords.length;i+=2){
              const b=graph.point(105.79+coords[i]/1e6,20.54+coords[i+1]/1e6);
              const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
              if(len>.1){
                const half=steps?2.5:1.65,ox=-dz/len*half,oz=dx/len*half;
                const ax=a.x-cx,az=a.z-cz,bx=b.x-cx,bz=b.z-cz;
                paving.push(ax+ox,az+oz,bx+ox,bz+oz,bx-ox,bz-oz,ax+ox,az+oz,bx-ox,bz-oz,ax-ox,az-oz);
              }
              a=b;
            }
          }
          surface(paving,material.pavers,.06,1);
        }
      }
      surface(landData,material.earth,-.032,.77);surface(roadData,material.asphalt,.002,.25);surface(yellow,material.yellow,.026,1);surface(white,material.white,.026,1);
      if(wires.length){
        for(let i=0;i<wires.length;i+=3)wires[i+1]+=localGround(wires[i],wires[i+2]);
        const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(wires,3));
        roadGroup.add(new T.LineSegments(lines,wireMaterial));
      }
      for(const b of batches.values()){
        const m=new T.InstancedMesh(b.geo,material[b.mat],b.poses.length);
        for(const [index,o] of b.moving)o.parts.push({index,mesh:m,rest:b.poses[index]});
        const tinted=b.colors.some(c=>c!==null);
        b.poses.forEach((pose,i)=>{m.setMatrixAt(i,pose);if(tinted)m.setColorAt(i,tone.set(b.colors[i]??0xffffff));});
        m.castShadow=true;m.receiveShadow=true;roadGroup.add(m);
      }
      shadowStamp=-1000;
    }
    const assetPaths={supercar:'streetscape/race-car.glb',gt:'streetscape/gt-coupe.glb',rally:'streetscape/rally-car.glb',sedan:'traffic/hatchback.glb',van:'traffic/kei-van.glb',scooter:'traffic/motor-scooter.glb',taxi:'streetscape/city-taxi.glb',rival:'streetscape/gt-coupe.glb'};
    const lengths={supercar:4.6,gt:4.65,rally:4.25,sedan:3.95,van:4.05,scooter:1.84,taxi:4.52,rival:4.65};
    const cache=new Map(),colors=[0x446370,0x9f553e,0x9aaba9,0x384c67,0xa7a39c,0x99864e];
    const contactTexture=document.createElement('canvas');contactTexture.width=contactTexture.height=64;
    const ctx=contactTexture.getContext('2d'),grad=ctx.createRadialGradient(32,32,9,32,32,31);
    grad.addColorStop(0,'rgba(10,13,15,.75)');grad.addColorStop(1,'rgba(10,13,15,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
    const contactMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(contactTexture),transparent:true,depthWrite:false});
    const fallbackMats=colors.map(c=>new T.MeshStandardMaterial({color:c,metalness:.5,roughness:.28}));
    const tires=basic(0x212323),windows=new T.MeshStandardMaterial({color:0x35494e,metalness:.48,roughness:.17}),lamps=new T.MeshBasicMaterial({color:0xa83227});
    function loadModel(kind){
      if(!cache.has(kind))cache.set(kind,TrafficModels.load.loadAsync(assetPaths[kind]).then(({scene:model})=>{
        const b=new T.Box3().setFromObject(model,true),center=b.getCenter(new T.Vector3()),scale=lengths[kind]/(b.max.z-b.min.z);
        model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-b.min.y*scale,-center.z*scale);
        model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        return model;
      }).catch(()=>null));return cache.get(kind);
    }
    const riderGeometry={
      head:new T.SphereGeometry(1,16,10),
      helmet:new T.SphereGeometry(1,20,12,0,Math.PI*2,0,1.8),
      limb:new T.CylinderGeometry(.063,.08,1,8)
    };
    const riderMats={skin:basic(0xb98e6a),jacket:basic(0x506d69),jeans:basic(0x37474b),helmet:new T.MeshStandardMaterial({color:0xe4ddd2,roughness:.26})};
    function scooterRider(parent){
      function blob(geometry,material,x,y,z,sx,sy,sz){
        const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;
      }
      function limb(a,b,mat){
        const from=new T.Vector3(...a),to=new T.Vector3(...b),dir=to.clone().sub(from),mid=from.add(to).multiplyScalar(.5);
        const m=blob(riderGeometry.limb,mat,mid.x,mid.y,mid.z,1,dir.length(),1);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
      }
      blob(riderGeometry.head,riderMats.jacket,0,1.07,-.10,.205,.335,.148).rotation.x=.16;
      blob(riderGeometry.head,riderMats.skin,0,1.49,-.045,.112,.135,.119);
      blob(riderGeometry.helmet,riderMats.helmet,0,1.53,-.054,.136,.138,.14);
      for(const s of [-1,1]){
        limb([s*.15,1.26,-.075],[s*.216,1.05,.06],riderMats.jacket);limb([s*.216,1.05,.06],[s*.255,1.03,.34],riderMats.skin);
        limb([s*.107,.83,-.14],[s*.175,.58,.24],riderMats.jeans);limb([s*.175,.58,.24],[s*.18,.26,.09],riderMats.jeans);
      }
    }
    function makeVehicle(kind,idx,player=false){
      const root=new T.Group(),outside=new T.Group(),low=new T.Group();root.add(outside);outside.add(low);scene.add(root);
      const len=lengths[kind]||4,wide=kind==='scooter'?.55:1.8,high=kind==='van'?1.65:1.18;
      const shadow=new T.Mesh(unitPlane,contactMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.013;shadow.scale.set(wide*1.75,len*1.32,1);root.add(shadow);
      const paint=fallbackMats[idx%colors.length];
      function block(x,y,z,w,h,l,m){
        const mesh=new T.Mesh(unitBox,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,l);low.add(mesh);
      }
      if(kind==='scooter'){
        for(const z of [-.59,.59]){
          const wheel=new T.Mesh(unitPole,tires);wheel.rotation.z=Math.PI/2;wheel.scale.set(.52,.16,.52);wheel.position.set(0,.26,z);low.add(wheel);
        }
        block(0,.46,-.26,.43,.42,.83,paint);block(0,.74,-.28,.39,.12,.63,tires);
        block(0,.4,.13,.36,.1,.7,paint);block(0,.69,.5,.32,.54,.18,paint);block(0,.98,.5,.57,.07,.1,tires);
      }else{
      block(0,high*.38,0,wide,high*.42,len*.97,paint);block(0,high*.69,-len*.055,wide*.87,high*.43,len*.56,windows);
      block(0,high*.92,-len*.08,wide*.84,.07,len*.49,paint);
      for(const s of [-1,1]){
        block(s*wide*.34,high*.48,-len*.485,wide*.22,.1,.05,lamps);
        for(const side of [-1,1])block(s*wide*.47,.29,side*len*.31,.16,.38,.54,tires);
      }
      }
      const item={root,outside,low,shadow,axleShadows:[],kind,idx,wheels:[],front:[],light:null,detail:null,loading:false};
      item.request=()=>{
        if(item.loading)return;item.loading=true;
        loadModel(kind).then(base=>{
          if(!base)return;
          const model=base.clone(true),tints=new Map();
          model.traverse(n=>{
            if(!n.isMesh)return;
            const src=n.material;
            if(!src||Array.isArray(src))return;
            if(/^(paint|paint_body)$/.test(src.name)){
              if(!tints.has(src)){
                const m=src.clone();
                if(player)m.color.setHex(kind==='supercar'?0xc63322:kind==='rally'?0x246397:0xb7b4a5);
                else if(kind==='rival')m.color.setHex(0x3a7790);
                else if(kind!=='taxi')m.color.setHex(colors[idx%colors.length]);
                tints.set(src,m);
              }n.material=tints.get(src);
            }else if(src.name==='light_rear'){
              if(!item.light){item.light=src.clone();item.light.emissive.setHex(0xff210b);}
              n.material=item.light;
            }
          });
          item.wheels=['FL','FR','RL','RR','F','R'].map(id=>({n:model.getObjectByName('wheel_'+id),id})).filter(i=>i.n);
          item.front=['FL','FR'].map(id=>model.getObjectByName('steer_'+id)).filter(Boolean);
          item.detail=new T.Group();item.detail.add(model);if(kind==='scooter')scooterRider(item.detail);
          outside.add(item.detail);item.detail.visible=false;
          for(const {n} of item.wheels){
            const axle=root.worldToLocal(n.getWorldPosition(new T.Vector3()));
            const patch=new T.Mesh(unitPlane,contactMat);patch.rotation.x=-Math.PI/2;
            patch.position.set(axle.x,.014,axle.z);patch.scale.set(kind==='scooter'?.24:.48,.62,1);item.detail.add(patch);item.axleShadows.push(patch);
          }
        });
      };
      return item;
    }
    const playerRig=new T.Group();scene.add(playerRig);
    const cabin=window.buildDriverCabin?.(T,playerRig);
    const cabinCourse={id:'world',name:'Việt Nam',crossing:-10000,finish:0};
    const mirrorRotation=new T.Quaternion(),eye=new T.Vector3(),look=new T.Vector3(),up=new T.Vector3(0,1,0),mirrorAdapter={
      getRenderTarget:()=>renderer.getRenderTarget(),
      setRenderTarget:t=>renderer.setRenderTarget(t),
      render(s,c){
        c.position.z-=2.13;c.position.applyQuaternion(mirrorRotation).add(playerRig.position);
        c.quaternion.premultiply(mirrorRotation);renderer.render(s,c);
      }
    };
    let player=null,version=0,width=0,height=0,totalDriven=0,lastPaint=0,slowFrames=0;
    const players=new Map(),trafficItems=new Map(),pools=new Map();
    function resize(){
      const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
      if(width===w&&height===h)return;
      width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();
    }
    function pose(item,car,dt,near){
      const pitch=Math.atan(driveGrade(car.x,car.z,car.yaw)),bank=Math.atan(driveGrade(car.x,car.z,car.yaw+Math.PI/2));
      item.root.position.set(car.x-originX,(car.flood?.y??car.wading?.bed??driveGround(car.x,car.z))+.011,car.z-originZ);
      item.root.rotation.set(car.flood?car.flood.pitch:-pitch,Math.PI-car.yaw,car.flood?0:-bank,'YXZ');
      if(near)item.request();
      const detailed=near&&!!item.detail;item.low.visible=!detailed;
      if(item.detail)item.detail.visible=detailed;
      if(detailed){
        item.wheels.forEach(({n,id})=>n.rotateX((id.endsWith('R')&&id.length===2?-1:1)*car.speed*dt/.33));
        for(const steer of item.front)steer.rotation.y=-(car.steer||0)*.34;
        if(item.light)item.light.emissiveIntensity=car.brake||car.recoil?.braking?3.5:.55;
        updateBodywork(T,item.detail,car.dent,car.yaw);
      }
    }
    const driveFx=createDrivingFX(T,scene);
    function render(car,traffic,dt,inside=false){
      if(!car||!Number.isFinite(car.x)||!Number.isFinite(car.z))return;
      if(car.sightView||car.flood)inside=false;
      resize();dt=Math.max(0,Math.min(.12,dt||0));version++;totalDriven+=Math.abs(car.speed||0)*dt;
      waterSurface.update(performance.now()*.001,weather.rainfall);
      const x=car.x-originX,z=car.z-originZ;
      const wake=car.flood?Math.exp(-car.flood.age*.36):car.wading?Math.min(1,Math.abs(car.speed)*.11):0;
      waterSurface.setWake(x,z,car.yaw+(car.speed<0?Math.PI:0),wake,car.flood?.age||0);
      const kind=['supercar','gt','rally'].includes(car.model)?car.model:'supercar';
      if(!player||player.kind!==kind){
        if(player)player.root.visible=false;
        if(!players.has(kind))players.set(kind,makeVehicle(kind,0,true));player=players.get(kind);player.request();player.root.visible=true;
      }
      pose(player,car,dt,true);player.outside.visible=!inside;
      player.shadow.visible=!car.flood;for(const shadow of player.axleShadows)shadow.visible=!car.flood;
      player.outside.rotation.set(-(car.pitch||0),0,-(car.roll||0));
      car.y=player.root.position.y-.011;playerRig.position.copy(player.root.position);
      playerRig.rotation.set(-player.root.rotation.x,-car.yaw,-player.root.rotation.z,'YXZ');
      mirrorRotation.copy(playerRig.quaternion);
      cabinCourse.finish=Math.ceil(totalDriven);cabinCourse.name=car.roadName||'Việt Nam';
      if(cabin)cabin.update(inside,Math.abs(car.speed||0)*3.6,car.steer||0,totalDriven,cabinCourse);
      const closest=(traffic||[]).map(a=>({a,d:(a.x-car.x)**2+(a.z-car.z)**2})).filter(v=>v.d<360*360).sort((a,b)=>a.d-b.d);
      for(const [index,{a,d}] of closest.entries()){
        const kind=assetPaths[a.kind]?a.kind:'sedan';
        let item=trafficItems.get(a.id);
        if(item&&item.kind!==kind){trafficItems.delete(a.id);item.root.visible=false;(pools.get(item.kind)||pools.set(item.kind,[]).get(item.kind)).push(item);item=null;}
        if(!item){item=pools.get(kind)?.pop()||makeVehicle(kind,Math.abs(Number(a.id)||index));trafficItems.set(a.id,item);}
        item.tick=version;item.root.visible=true;
        const recoil=a.flood?null:a.recoil;
        item.outside.position.y=(recoil?.y||0)+(recoil?.fallen ? .25*Math.abs(Math.sin(recoil.roll)) : 0);
        item.outside.rotation.set(-(recoil?.pitch||0),0,-(recoil?.roll||0));
        for(const shadow of item.axleShadows)shadow.visible=!a.flood&&!recoil?.fallen;
        item.shadow.visible=!a.flood&&(recoil?.y||0)<3.2;
        pose(item,a,dt,(index<(small?3:5)||kind==='scooter'||!!recoil)&&d<140*140);
      }
      for(const [id,item] of trafficItems)if(item.tick!==version){
        trafficItems.delete(id);item.root.visible=false;
        if(!pools.has(item.kind))pools.set(item.kind,[]);pools.get(item.kind).push(item);
      }
      const sin=Math.sin(car.yaw),cos=Math.cos(car.yaw),speed=Math.abs(car.speed||0);
      sun.target.position.set(Math.round(x+sin*17),car.y,Math.round(z-cos*17));sun.position.copy(sun.target.position).addScaledVector(up,42);sun.position.x-=34;sun.position.z+=25;
      const now=performance.now();if(now-shadowStamp>(small?115:66)){renderer.shadowMap.needsUpdate=true;shadowStamp=now;}
      const viewpoint=car.sightView||car;
      land.material=wooded||car.region==='highlands'?upland:meadow;relief.update(viewpoint.x,viewpoint.z);
      if(car.showroom&&!inside){
        const portrait=camera.aspect<.85;
        eye.set(portrait?-5.6:-4.3,portrait?1.9:1.6,portrait?8.0:5.5);
        look.set(portrait?0:-1.38,.72,-.38);
      }else if(inside){
        eye.set(-.31,1.1,.53);look.set(-.31,.6,-13);
      }else{
        const back=(camera.aspect<.85?7.55:6.35)+speed*.018;
        eye.set(-(car.steer||0)*.32,2.08+speed*.007,back);look.set(0,.9,-10);
      }
      eye.applyQuaternion(mirrorRotation).add(playerRig.position);look.applyQuaternion(mirrorRotation).add(playerRig.position);
      if(car.showroom&&car.tourStop){
        const stop=landmarks.nearest(car.x,car.z);
        if(stop&&stop.distance>3){
          const dx=(stop.x-car.x)/stop.distance,dz=(stop.z-car.z)/stop.distance;
          eye.set(x-dx*7+dz*1.5,car.y+2.15,z-dz*7-dx*1.5);
          look.set(x+dx*15,car.y+2.7,z+dz*15);
        }
      }
      if(car.flood){eye.y=Math.max(eye.y,car.flood.level+2.2);look.set(x,car.flood.level-.25,z);}
      camera.position.copy(eye);camera.lookAt(look);
      if(car.sightView){
        const v=car.sightView,angle=v.angle-v.data.yaw;
        const span=Math.abs(Math.cos(angle))*v.data.width+Math.abs(Math.sin(angle))*v.data.depth;
        const front=Math.abs(Math.sin(angle))*v.data.width+Math.abs(Math.cos(angle))*v.data.depth;
        const radius=(Math.max(span/Math.max(.35,camera.aspect),v.height)*1.10+front*.40)*v.zoom;
        const focus=relief.ground(v.x,v.z)+v.height*.46;
        look.set(v.x-originX,focus,v.z-originZ);
        camera.position.set(look.x+Math.sin(v.angle)*radius*Math.cos(v.elevation),focus+radius*Math.sin(v.elevation),
          look.z+Math.cos(v.angle)*radius*Math.cos(v.elevation));camera.lookAt(look);
        sun.target.position.copy(look);sun.position.copy(look).addScaledVector(up,42);sun.position.x-=34;sun.position.z+=25;
      }
      const fov=(inside?64:car.showroom?47:57+Math.min(15,speed*.28))+(car.boost?5:0);
      if(Math.abs(fov-camera.fov)>.05){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*7));camera.updateProjectionMatrix();}
      if(inside&&cabin)cabin.reflect(mirrorAdapter,scene,playerRig,0,0);
      roadsideImpact.update(dt);driveFx.update(car,dt,originX,originZ,inside,camera);
      weather.render(camera,now);
      const waterLevel=nearbyWaterLevel(viewpoint.x-originX,viewpoint.z-originZ);
      waterSurface.reflect(renderer,scene,camera,waterLevel,now,waterLevel!==null);
      renderer.render(scene,camera);
      const elapsed=now-lastPaint;
      slowFrames=lastPaint&&elapsed>48&&elapsed<500?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames>=18&&renderer.getPixelRatio()>.78){
        renderer.setPixelRatio(Math.max(.78,renderer.getPixelRatio()*.88));slowFrames=0;
      }
      lastPaint=now;
    }
    return {weather,waterAt:(x,z)=>waterAt(x,z),terrainReady:relief.ready,grade:driveGrade,ground:driveGround,setRoads,render,resize,contact,loadDistrict:async(g,x,z)=>(await Promise.all([district.load(g,x,z),relief.loadLocal(g,x,z)])).some(Boolean),splash:(x,z,nx,nz,strength,level)=>driveFx.impact(x,z,nx,nz,strength,'water',level,.3),nearLandmark:(x,z)=>landmarks?.nearest(x,z),reactToContact:roadsideImpact.react,impact:(x,z,nx,nz,s,k,h=0,g)=>driveFx.impact(x,z,nx,nz,s,k,driveGround(x,z)+h,g),scrape:(x,y,z,vx,vz)=>driveFx.scrape(x,driveGround(x,z)+y,z,vx,vz),resetFx(){driveFx.reset();roadsideImpact.reset();}};
  };
})();
