'use strict';
(() => {
  const widths={motorway:7.3,trunk:6.9,primary:6.1,secondary:5.2,tertiary:4.6,residential:3.4,unclassified:3.4,service:2.8};
  window.worldRoadHalfWidth=kind=>String(kind).endsWith('_link')?3.8:widths[kind]||4.2;

  window.createWorldScene=function(canvas){
    const T=window.THREE,scene=new T.Scene();
    const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    const small=matchMedia('(pointer:coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio,small?1.25:1.65));
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
    scene.background=new T.Color(0xaec5d2);scene.fog=new T.FogExp2(0xb7c9cc,.00235);
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
    scene.add(new T.HemisphereLight(0xd1e6ff,0x857760,1.13));
    const sun=new T.DirectionalLight(0xffdfab,2.85);
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
    material.asphalt.side=material.earth.side=T.DoubleSide;
    material.pavers=new T.MeshStandardMaterial({color:0xb5ada4,roughness:.91});
    material.pavers.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 paving;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n paving=(instanceMatrix*vec4(position,1.)).xz;');
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
    const meadow=surfaces.scanned('meadow',0xc8d0a6,.56);
    const upland=surfaces.scanned('grass',0xadcd9c,.67);
    const landWidth=2200;
    const land=new T.Mesh(new T.PlaneGeometry(landWidth,landWidth),meadow);
    const landOrigin=new T.Vector2();
    // Low-frequency variation is fixed in geographic space. Close-up grain stays sharp.
    for(const mat of [meadow,upland]){
      mat.onBeforeCompile=shader=>{
        shader.uniforms.landOrigin={value:landOrigin};
        shader.vertexShader='uniform vec2 landOrigin; varying vec2 groundMetres;\n'+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n groundMetres=vec2(position.x,-position.y)+landOrigin;');
        shader.fragmentShader='varying vec2 groundMetres;\n'+shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n float patchiness=sin(dot(groundMetres,vec2(.035,.019)))+.55*cos(dot(groundMetres,vec2(-.015,.047))); diffuseColor.rgb*=vec3(.96,.98,.95)+patchiness*vec3(.08,.035,.05);');
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
    const roadsideImpact=createRoadsideImpact(T,scene);
    let roadGroup=null,originX=0,originZ=0,shadowStamp=-1000;
    const landmarks=window.VietnamLandmarks?.create(T,scene);
    const district=createTourDistrict(T,scene,material.wall);
    let nearbyWater=()=>false;
    let obstacleCells=new Map(),waterContact=()=>null;
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
      return hit||landmarks?.contact(x,z,r)||district.contact(x,z,r)||waterContact(px,pz,r);
    }
    function discardRoads(){
      if(!roadGroup)return;scene.remove(roadGroup);
      roadGroup.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();else if(obj.geometry)obj.geometry.dispose();});
    }
    function setRoads(edges,cx,cz,water=[],graph=null){
      landmarks?.setOrigin(graph,cx,cz);
      district.build(graph,cx,cz,landmarks);
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
      discardRoads();roadGroup=new T.Group();scene.add(roadGroup);originX=cx;originZ=cz;
      relief.setOrigin(graph,cx,cz);landOrigin.set(cx,cz);
      // Local plane UV runs towards -Z. Synchronize the three PBR maps at a rebase.
      for(const [mat,tile] of [[meadow,3.1],[upland,14.2]]){
        surfaces.transform(mat,landWidth/tile,landWidth/tile,(cx/tile)%1,(-cz/tile)%1);
      }
      const segments=[],cells=new Map(),roadData=[],landData=[],yellow=[],white=[],wires=[],junctions=new Map(),batches=new Map(),candidates=[],rivals=new Map();
      obstacleCells=new Map();
      roadsideImpact.rebase(cx,cz);
      const cellSize=32,cutoff=650;
      // A small occupancy mask lets each generated building test its footprint in constant time.
      const maskSize=336,maskScale=.25,waterData=[];
      // Raster cells are aligned in world metres across render-origin shifts.
      const maskX=Math.floor((cx-cutoff)/4)*4-cx,maskZ=Math.floor((cz-cutoff)/4)*4-cz;
      let wetMask=null;
      if(water.length){
        const mask=document.createElement('canvas');mask.width=mask.height=maskSize;
        const painter=mask.getContext('2d',{willReadFrequently:true});
        painter.setTransform(maskScale,0,0,maskScale,-maskX*maskScale,-maskZ*maskScale);
        painter.fillStyle=painter.strokeStyle='#fff';painter.lineJoin=painter.lineCap='round';
        const currentCanvas=mask.cloneNode();
        const current=currentCanvas.getContext('2d',{willReadFrequently:true});
        current.setTransform(painter.getTransform());current.lineCap='round';
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
            const triangles=T.ShapeUtils.triangulateShape(ring,[]);
            for(const [a,b,c] of triangles)waterData.push(ring[a].x,ring[a].y,ring[c].x,ring[c].y,ring[b].x,ring[b].y);
            painter.beginPath();painter.moveTo(ring[0].x,ring[0].y);
            for(let i=1;i<ring.length;i++)painter.lineTo(ring[i].x,ring[i].y);
            painter.closePath();painter.fill();
          }else{
            const radius=Math.min(90,Math.max(2,Number(feature.width)||(/suối/i.test(feature.name||'')?8:23)))/2;
            painter.lineWidth=radius*2;
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
              quad(waterData,ax-nx*radius,az-nz*radius,ax+nx*radius,az+nz*radius,bx-nx*radius,bz-nz*radius,bx+nx*radius,bz+nz*radius);
              cap(waterData,bx,bz,radius);
              painter.beginPath();painter.moveTo(ax,az);painter.lineTo(bx,bz);painter.stroke();
            }
          }
        }
        wetMask=painter.getImageData(0,0,maskSize,maskSize).data;
        if(waterData.length)waterSurface.setField(waterBankField(wetMask,current.getImageData(0,0,maskSize,maskSize).data,maskSize,1/maskScale),
          maskSize,maskX,maskZ,maskScale,cx,cz);
      }
      // Index occupied blocks once so narrow streams also enable local reflections.
      const wetBlocks=new Set(),blockSize=16,blocks=Math.ceil(maskSize/blockSize);
      if(wetMask)for(let row=0;row<maskSize;row++)for(let col=0;col<maskSize;col++){
        if(wetMask[(row*maskSize+col)*4+3]>100)wetBlocks.add(Math.floor(row/blockSize)*blocks+Math.floor(col/blockSize));
      }
      nearbyWater=(x,z)=>{
        const col=Math.floor((x-maskX)*maskScale/blockSize),row=Math.floor((z-maskZ)*maskScale/blockSize);
        for(let j=Math.max(0,row-2);j<=Math.min(blocks-1,row+2);j++)
          for(let i=Math.max(0,col-2);i<=Math.min(blocks-1,col+2);i++)if(wetBlocks.has(j*blocks+i))return true;
        return false;
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
      // Bridges cover the water below. Estimate the outward bank normal only on contact.
      waterContact=(x,z,r)=>{
        if(!wetMask||!wet(x,z))return null;
        for(const s of cells.get(nearbyCell(x,z))||[]){
          const d=Math.max(0,Math.min(s.len,(x-s.ax)*s.fx+(z-s.az)*s.fz));
          if(Math.hypot(s.ax+d*s.fx-x,s.az+d*s.fz-z)<s.w+.5)return null;
        }
        for(let d=1;d<=16;d+=1)for(let i=0;i<16;i++){
          const nx=Math.cos(i*Math.PI/8),nz=Math.sin(i*Math.PI/8);
          if(!wet(x+d*nx,z+d*nz))return {nx,nz,depth:d+r,kind:'water'};
        }
        return null;
      };
      function instance(mat,geo,x,y,z,sx,sy,sz,yaw=0,color=null,owner=null){
        const key=mat+':'+geo.id;
        if(!batches.has(key))batches.set(key,{mat,geo,poses:[],colors:[],moving:[]});
        const b=batches.get(key);temp.position.set(x,y,z);temp.rotation.set(0,yaw,0);temp.scale.set(sx,sy,sz);temp.updateMatrix();
        if(owner)b.moving.push([b.poses.length,owner]);
        b.poses.push(temp.matrix.clone());b.colors.push(color);
      }
      function quad(points,ax,az,bx,bz,cx,cz,dx,dz){points.push(ax,az,bx,bz,cx,cz,cx,cz,bx,bz,dx,dz);}
      function strip(target,s,start,end,l,r){
        const ax=s.ax+s.fx*start,az=s.az+s.fz*start,bx=s.ax+s.fx*end,bz=s.az+s.fz*end;
        quad(target,ax+s.nx*l,az+s.nz*l,ax+s.nx*r,az+s.nz*r,bx+s.nx*l,bz+s.nz*l,bx+s.nx*r,bz+s.nz*r);
      }
      for(const e of edges){
        const width=window.worldRoadHalfWidth(e.kind);
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
          segments.push(s);strip(landData,s,0,s.len,-width-.85,width+.85);strip(roadData,s,0,s.len,-width,width);
          for(const [x,z] of [[ax,az],[bx,bz]]){
            const k=Math.round(x*10)+','+Math.round(z*10);
            const node=junctions.get(k);if(node){node.r=Math.max(node.r,width);node.n++;}else junctions.set(k,{x,z,r:width,n:1});
          }
          bounds(s,width+9,key=>{if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);});
        }
      }
      function cap(points,x,z,r){
        let a=0;
        for(let i=1;i<=12;i++){const b=i*Math.PI/6;points.push(x,z,x+Math.sin(a)*r,z+Math.cos(a)*r,x+Math.sin(b)*r,z+Math.cos(b)*r);a=b;}
      }
      for(const node of junctions.values()){cap(roadData,node.x,node.z,node.r);cap(landData,node.x,node.z,node.r+.85);}
      function openNearEnd(s,x,z){
        const node=junctions.get(Math.round(x*10)+','+Math.round(z*10));return node&&node.n>2?node.r+1:.0;
      }
      // Placements compete only with immediate neighbours by fixed OSM-derived priority.
      // Reordering visible roads or clipping a distant street cannot cascade into a new layout.
      function compareCandidate(a,b){return a.priority-b.priority||a.key.localeCompare(b.key);}
      const plotSize=12;
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
        if(s.w>=4.2){
          for(const side of [-1,1])strip(white,s,start,end,side*s.w*.94-.055,side*s.w*.94+.055);
          for(let u=start+1;u<end;u+=10)strip(s.oneway?white:yellow,s,u,Math.min(end,u+3.7),-.074,.074);
          if(s.w>=6.75)for(let u=start+2;u<end;u+=11)for(const side of [-1,1])strip(white,s,u,Math.min(end,u+3),side*s.w*.49-.065,side*s.w*.49+.065);
        }
        if(s.rank>620||s.len<3)continue;
        if(s.w>=4.2&&s.len>=24){
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
            const priority=random(),house=random()<(dense?.73:.34),type=Math.floor(random()*shopTypes.length);
            const width=4.5+random()*2.9,depth=5+random()*3.9;
            const dist=s.w+(house?3.5+depth/2:3)+random()*(house?3:5);
            const hx=x+sign*s.nx*dist,hz=z+sign*s.nz*dist,footprint=house?Math.hypot(width,depth)/2+.8:1.7;
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
            }else{
              const [lon,lat]=graph?graph.geo(hx+cx,hz+cz):[105,21];
              const uplands=lat>21.3&&lon<106.4||lat>11.6&&lat<15&&lon>107&&lon<108.6;
              const palm=random()<(uplands?.015:lat<11?.48:lat<18?.32:.11),height=(palm?7.5:5)+random()*5,w=height*(palm?.59:.92),r=random()*Math.PI;
              const tree=registerObstacle({id:c.key,kind:'tree',x:hx,z:hz,radius:.27,height,parts:[]});
              for(let k=0;k<2;k++){const angle=r+k*Math.PI/2,off=w*(palm?.07:.12);instance(palm?'palm':'tree',unitPlane,hx+off*Math.cos(angle),height*.49,hz-off*Math.sin(angle),w,height,1,angle,null,tree);}
            }
      }
      function surface(data,mat,y,freq){
        if(!data.length)return;
        const verts=new Float32Array(data.length*1.5),uv=new Float32Array(data.length),normals=new Float32Array(verts.length);
        for(let i=0,j=0;i<data.length;i+=2,j+=3){
          verts[j]=data[i];verts[j+1]=y;verts[j+2]=data[i+1];normals[j+1]=1;
          uv[i]=data[i]*freq+(cx*freq)%1;uv[i+1]=data[i+1]*freq+(cz*freq)%1;
        }
        const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(verts,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));
        const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;roadGroup.add(mesh);
      }
      material.white.side=material.yellow.side=T.DoubleSide;
      surface(waterData,waterSurface.material,-.085,.074);surface(landData,material.earth,-.032,.77);surface(roadData,material.asphalt,.002,.25);surface(yellow,material.yellow,.026,1);surface(white,material.white,.026,1);
      if(wires.length){
        const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(wires,3));
        roadGroup.add(new T.LineSegments(lines,wireMaterial));
      }
      for(const b of batches.values()){
        const m=new T.InstancedMesh(b.geo,material[b.mat],b.poses.length);
        for(const [index,o] of b.moving)o.parts.push({index,mesh:m,rest:b.poses[index]});
        b.poses.forEach((pose,i)=>{m.setMatrixAt(i,pose);if(b.colors[i]!==null)m.setColorAt(i,tone.set(b.colors[i]));});
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
      item.root.position.set(car.x-originX,.011,car.z-originZ);item.root.rotation.y=Math.PI-car.yaw;
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
      if(car.sightView)inside=false;
      resize();dt=Math.max(0,Math.min(.12,dt||0));version++;totalDriven+=Math.abs(car.speed||0)*dt;
      waterSurface.update(performance.now()*.001);
      const x=car.x-originX,z=car.z-originZ;
      const kind=['supercar','gt','rally'].includes(car.model)?car.model:'supercar';
      if(!player||player.kind!==kind){
        if(player)player.root.visible=false;
        if(!players.has(kind))players.set(kind,makeVehicle(kind,0,true));player=players.get(kind);player.request();player.root.visible=true;
      }
      pose(player,car,dt,true);player.outside.visible=!inside;
      player.outside.rotation.set(-(car.pitch||0),0,-(car.roll||0));
      playerRig.position.set(x,.011,z);playerRig.rotation.y=-car.yaw;
      mirrorRotation.setFromAxisAngle(up,-car.yaw);
      cabinCourse.finish=Math.ceil(totalDriven);cabinCourse.name=car.roadName||'Việt Nam';
      if(cabin)cabin.update(inside,Math.abs(car.speed||0)*3.6,car.steer||0,totalDriven,cabinCourse);
      const closest=(traffic||[]).map(a=>({a,d:(a.x-car.x)**2+(a.z-car.z)**2})).filter(v=>v.d<360*360).sort((a,b)=>a.d-b.d);
      for(const [index,{a,d}] of closest.entries()){
        const kind=assetPaths[a.kind]?a.kind:'sedan';
        let item=trafficItems.get(a.id);
        if(item&&item.kind!==kind){trafficItems.delete(a.id);item.root.visible=false;(pools.get(item.kind)||pools.set(item.kind,[]).get(item.kind)).push(item);item=null;}
        if(!item){item=pools.get(kind)?.pop()||makeVehicle(kind,Math.abs(Number(a.id)||index));trafficItems.set(a.id,item);}
        item.tick=version;item.root.visible=true;
        const recoil=a.recoil;
        item.outside.position.y=(recoil?.y||0)+(recoil?.fallen ? .25*Math.abs(Math.sin(recoil.roll)) : 0);
        item.outside.rotation.set(-(recoil?.pitch||0),0,-(recoil?.roll||0));
        for(const shadow of item.axleShadows)shadow.visible=!recoil?.fallen;
        item.shadow.visible=(recoil?.y||0)<3.2;
        pose(item,a,dt,(index<(small?3:5)||kind==='scooter'||!!recoil)&&d<140*140);
      }
      for(const [id,item] of trafficItems)if(item.tick!==version){
        trafficItems.delete(id);item.root.visible=false;
        if(!pools.has(item.kind))pools.set(item.kind,[]);pools.get(item.kind).push(item);
      }
      const sin=Math.sin(car.yaw),cos=Math.cos(car.yaw),speed=Math.abs(car.speed||0);
      sun.target.position.set(Math.round(x+sin*17),0,Math.round(z-cos*17));sun.position.copy(sun.target.position).addScaledVector(up,42);sun.position.x-=34;sun.position.z+=25;
      const now=performance.now();if(now-shadowStamp>(small?115:66)){renderer.shadowMap.needsUpdate=true;shadowStamp=now;}
      land.material=car.region==='highlands'?upland:meadow;relief.update(car.x,car.z);
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
          eye.set(x-dx*7+dz*1.5,2.15,z-dz*7-dx*1.5);
          look.set(x+dx*15,2.7,z+dz*15);
        }
      }
      camera.position.copy(eye);camera.lookAt(look);
      if(car.sightView){
        const v=car.sightView,radius=Math.max(24,v.data.depth*.9,v.data.width*.83)*(camera.aspect<.85?1.48:1);
        const focus=Math.max(4,Math.min(13,v.data.depth*.19));
        look.set(v.x-originX,focus,v.z-originZ);
        camera.position.set(look.x+Math.sin(v.angle)*radius*Math.cos(v.elevation),focus+radius*Math.sin(v.elevation),
          look.z+Math.cos(v.angle)*radius*Math.cos(v.elevation));camera.lookAt(look);
        sun.target.position.copy(look);sun.position.copy(look).addScaledVector(up,42);sun.position.x-=34;sun.position.z+=25;
      }
      const fov=(inside?64:car.showroom?47:57+Math.min(15,speed*.28))+(car.boost?5:0);
      if(Math.abs(fov-camera.fov)>.05){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*7));camera.updateProjectionMatrix();}
      if(inside&&cabin)cabin.reflect(mirrorAdapter,scene,playerRig,0,0);
      roadsideImpact.update(dt);driveFx.update(car,dt,originX,originZ,inside,camera);
      waterSurface.reflect(renderer,scene,camera,-.085,now,nearbyWater(x,z));
      renderer.render(scene,camera);
      const elapsed=now-lastPaint;
      slowFrames=lastPaint&&elapsed>48&&elapsed<500?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames>=18&&renderer.getPixelRatio()>.78){
        renderer.setPixelRatio(Math.max(.78,renderer.getPixelRatio()*.88));slowFrames=0;
      }
      lastPaint=now;
    }
    return {setRoads,render,resize,contact,loadDistrict:district.load,nearLandmark:(x,z)=>landmarks?.nearest(x,z),reactToContact:roadsideImpact.react,impact:driveFx.impact,scrape:driveFx.scrape,resetFx(){driveFx.reset();roadsideImpact.reset();}};
  };
})();
