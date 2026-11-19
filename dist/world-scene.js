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
    const camera=new T.PerspectiveCamera(61,1,.09,1850);
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
    const material={
      asphalt:new T.MeshLambertMaterial({map:texture('asphalt.jpg',true),color:0xa5aab0,side:T.DoubleSide}),
      earth:new T.MeshLambertMaterial({map:texture('verge-earth.webp',true),color:0xb2aba0,side:T.DoubleSide}),
      white:basic(0xe8e8d7),yellow:basic(0xf0ca63),wall:basic(0xe8ddbd),roof:basic(0x748585),
      pavement:basic(0xc2b8a3),steel:basic(0x687877),concrete:basic(0xb0afa3),glass:basic(0x48646a),
      awning:basic(0x9c9f92),tree:new T.MeshLambertMaterial({map:texture('roadside-tree.webp'),alphaTest:.46,side:T.DoubleSide,color:0xd4dbcc,emissive:0x262b23}),
      palm:new T.MeshLambertMaterial({map:texture('roadside-palm.webp'),alphaTest:.46,side:T.DoubleSide,color:0xd6dccb,emissive:0x262b23})
    };
    function shopTexture(name,background,signColor,stories){
      const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d');
      g.fillStyle=background;g.fillRect(0,0,512,512);
      const windows=(x,y,w,h)=>{
        g.fillStyle='#68746d';g.fillRect(x-3,y-4,w+6,h+8);
        g.fillStyle='#385356';g.fillRect(x,y,w,h);
        g.fillStyle='#698284';g.fillRect(x+3,y+3,w/2-6,h*.43);
        g.fillStyle='#526b69';g.fillRect(x+w/2+2,y+3,w/2-5,h*.85);
        g.fillStyle='#bec0ac';g.fillRect(x+w/2-1,y,3,h);g.fillRect(x,y+h*.49,w,2);
      };
      if(stories){
        for(const x of [24,196,365])windows(x,28,119,112);
        g.fillStyle='#c2b8a3';g.fillRect(0,151,512,17);
        for(let x=4;x<508;x+=15){g.fillStyle='#75827b';g.fillRect(x,133,2,32);}
      }
      const signY=stories?183:30;
      g.fillStyle=signColor;g.fillRect(9,signY,494,74);g.strokeStyle='#f1dcab';g.lineWidth=2;g.strokeRect(15,signY+5,482,64);
      g.fillStyle='#ffefce';g.textAlign='center';g.font='bold 40px Arial';g.fillText(name,256,signY+49,466);
      const y=signY+89;
      g.fillStyle='#52605b';g.fillRect(15,y,255,512-y);
      for(let row=y+3;row<510;row+=6){g.fillStyle='#84938c';g.fillRect(19,row,247,3);}
      windows(291,y+7,198,Math.min(512-y-20,161));
      const fade=g.createLinearGradient(0,400,0,512);fade.addColorStop(0,'transparent');fade.addColorStop(1,'rgba(50,39,28,.32)');g.fillStyle=fade;g.fillRect(0,380,512,132);
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return new T.MeshLambertMaterial({map:t});
    }
    const shopTypes=[
      ['CÀ PHÊ SỮA ĐÁ','#e6d0a5','#386458',true],['TIỆM BÁNH MÌ','#e3ca8e','#a65936',false],
      ['TẠP HÓA','#d8dfce','#256071',true],['PHỞ BÒ','#dad2bb','#85443c',false],
      ['SỬA XE','#b4bdb0','#495659',false],['NHÀ THUỐC','#dfddcd','#426c63',true]
    ];
    shopTypes.forEach((s,i)=>material['front'+i]=shopTexture(...s));
    const grass=texture('verge-grass.webp',true);grass.repeat.set(430,430);
    const land=new T.Mesh(new T.PlaneGeometry(2200,2200),new T.MeshLambertMaterial({map:grass,color:0x9caf8a}));
    land.rotation.x=-Math.PI/2;land.position.y=-.17;land.receiveShadow=true;scene.add(land);
    const waveCanvas=document.createElement('canvas');waveCanvas.width=waveCanvas.height=128;
    const waveContext=waveCanvas.getContext('2d'),wavePixels=waveContext.createImageData(128,128);
    for(let z=0;z<128;z++)for(let x=0;x<128;x++){
      const a=x*Math.PI/64,b=z*Math.PI/64,i=(z*128+x)*4;
      const dx=.19*Math.cos(3*a+5*b)+.14*Math.cos(7*a-9*b)+.045*Math.sin(11*a+15*b);
      const dy=.26*Math.cos(3*a+5*b)-.21*Math.cos(7*a-9*b)+.07*Math.sin(11*a+15*b);
      wavePixels.data[i]=128+dx*120;wavePixels.data[i+1]=128+dy*120;wavePixels.data[i+2]=248;wavePixels.data[i+3]=255;
    }
    waveContext.putImageData(wavePixels,0,0);
    const wave=new T.CanvasTexture(waveCanvas);wave.wrapS=wave.wrapT=T.RepeatWrapping;
    const waterMaterial=new T.MeshStandardMaterial({color:0x48786f,normalMap:wave,normalScale:new T.Vector2(.32,.32),roughness:.22,metalness:.37,side:T.DoubleSide});
    // Layered foothills anchor the horizon far beyond the streamed roadway.
    const hills=new T.Group();scene.add(hills);
    for(let band=0;band<2;band++){
      const pos=[],col=[],indices=[],tone=new T.Color(),count=128;
      for(let i=0;i<=count;i++){
        const a=i/count*Math.PI*2,r=band?650:905;
        const height=band?32+17*Math.sin(6*a)+9*Math.cos(15*a):77+32*Math.cos(7*a)+16*Math.sin(18*a);
        for(const f of [0,1]){
          pos.push(Math.cos(a)*(r+f*50),f?height:-2,Math.sin(a)*(r+f*50));
          tone.set(band?0x546c61:0x729092).multiplyScalar(.88+f*.16+.06*Math.cos(12*a));col.push(tone.r,tone.g,tone.b);
        }
        if(i){const k=2*i;indices.push(k-2,k,k-1,k-1,k,k+1);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setIndex(indices);
      hills.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));
    }
    const unitBox=new T.BoxGeometry(),unitPlane=new T.PlaneGeometry(),unitPole=new T.CylinderGeometry(.5,.5,1,8);
    const wireMaterial=new T.LineBasicMaterial({color:0x50554d,transparent:true,opacity:.64});
    const temp=new T.Object3D(),tone=new T.Color();
    let roadGroup=null,originX=0,originZ=0,shadowStamp=-1000;
    function discardRoads(){
      if(!roadGroup)return;scene.remove(roadGroup);
      roadGroup.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();else if(obj.geometry)obj.geometry.dispose();});
    }
    function setRoads(edges,cx,cz,water=[]){
      discardRoads();roadGroup=new T.Group();scene.add(roadGroup);originX=cx;originZ=cz;
      land.material.map.offset.set((cx/2200*430)%1,(-cz/2200*430)%1);land.position.x=land.position.z=0;
      const segments=[],cells=new Map(),roadData=[],landData=[],yellow=[],white=[],wires=[],junctions=new Map(),batches=new Map(),occupied=new Set();
      const cellSize=32,cutoff=650;
      // A small occupancy mask lets each generated building test its footprint in constant time.
      const maskSize=352,maskScale=maskSize/(cutoff*2),waterData=[];
      let wetMask=null;
      if(water.length){
        const mask=document.createElement('canvas');mask.width=mask.height=maskSize;
        const painter=mask.getContext('2d',{willReadFrequently:true});
        painter.setTransform(maskScale,0,0,maskScale,maskSize/2,maskSize/2);
        painter.fillStyle=painter.strokeStyle='#fff';painter.lineJoin=painter.lineCap='round';
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
              quad(waterData,ax-nx*radius,az-nz*radius,ax+nx*radius,az+nz*radius,bx-nx*radius,bz-nz*radius,bx+nx*radius,bz+nz*radius);
              cap(waterData,bx,bz,radius);
              painter.beginPath();painter.moveTo(ax,az);painter.lineTo(bx,bz);painter.stroke();
            }
          }
        }
        wetMask=painter.getImageData(0,0,maskSize,maskSize).data;
      }
      function wet(x,z){
        const col=Math.floor((x+cutoff)*maskScale),row=Math.floor((z+cutoff)*maskScale);
        return col>=0&&row>=0&&col<maskSize&&row<maskSize&&wetMask[(row*maskSize+col)*4+3]>100;
      }
      function nearbyCell(x,z){return Math.floor(x/cellSize)+','+Math.floor(z/cellSize);}
      function bounds(seg,pad,fn){
        for(let ix=Math.floor((Math.min(seg.ax,seg.bx)-pad)/cellSize);ix<=Math.floor((Math.max(seg.ax,seg.bx)+pad)/cellSize);ix++)
          for(let iz=Math.floor((Math.min(seg.az,seg.bz)-pad)/cellSize);iz<=Math.floor((Math.max(seg.az,seg.bz)+pad)/cellSize);iz++)fn(ix+','+iz);
      }
      function blocked(x,z,r){
        if(wetMask&&(wet(x,z)||wet(x+r,z)||wet(x-r,z)||wet(x,z+r)||wet(x,z-r)))return true;
        const list=cells.get(nearbyCell(x,z))||[];
        for(const s of list){
          const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.fx+(z-s.az)*s.fz));
          const dx=x-s.ax-s.fx*t,dz=z-s.az-s.fz*t;
          if(dx*dx+dz*dz<(s.w+r)*(s.w+r))return true;
        }return false;
      }
      function instance(mat,geo,x,y,z,sx,sy,sz,yaw=0,color=null){
        if(!batches.has(mat))batches.set(mat,{geo,poses:[],colors:[]});
        const b=batches.get(mat);temp.position.set(x,y,z);temp.rotation.set(0,yaw,0);temp.scale.set(sx,sy,sz);temp.updateMatrix();
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
          const lo=Math.max(0,near-cutoff),hi=Math.min(length,near+cutoff);
          bx=ax+fx*hi;bz=az+fz*hi;ax+=fx*lo;az+=fz*lo;
          const s={ax,az,bx,bz,fx,fz,nx,nz,len:hi-lo,w:width,kind:e.kind,oneway:e.oneway,rank:perp,
            seed:Math.floor(Math.abs(a.x*.4951+a.z*.1847+i*17))};
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
      segments.sort((a,b)=>a.rank-b.rank);
      const dense=segments.reduce((total,s)=>s.rank<180?total+s.len:total,0)>2600;
      for(const s of segments){
        const start=openNearEnd(s,s.ax,s.az),end=s.len-openNearEnd(s,s.bx,s.bz);
        if(end<=start)continue;
        if(s.w>=4.2){
          for(const side of [-1,1])strip(white,s,start,end,side*s.w*.94-.055,side*s.w*.94+.055);
          for(let u=start+1;u<end;u+=10)strip(s.oneway?white:yellow,s,u,Math.min(end,u+3.7),-.074,.074);
          if(s.w>=6.75)for(let u=start+2;u<end;u+=11)for(const side of [-1,1])strip(white,s,u,Math.min(end,u+3),side*s.w*.49-.065,side*s.w*.49+.065);
        }
        if(s.rank>380||s.len<3)continue;
        if(s.w>=4.2&&s.len>=24){
          const spacing=s.w>6?31:38;
          let last=null;
          for(let station=9;station<end-4;station+=spacing){
            const px=s.ax+s.fx*station+s.nx*(s.w+1.7),pz=s.az+s.fz*station+s.nz*(s.w+1.7);
            if(blocked(px,pz,.45)){last=null;continue;}
            instance('concrete',unitPole,px,3.65,pz,.17,7.3,.17);
            const rot=Math.atan2(s.nx,s.nz);
            if(s.w>6){
              instance('steel',unitBox,px-s.nx*.9,7.18,pz-s.nz*.9,.095,.09,1.98,rot);
              instance('glass',unitBox,px-s.nx*1.91,7.13,pz-s.nz*1.91,.34,.14,.68,rot);
            }else{
              instance('steel',unitBox,px,6.89,pz,.085,.095,1.66,rot);
              for(const side of [-1,1]){
                instance('roof',unitPole,px+s.nx*side*.67,7.04,pz+s.nz*side*.67,.1,.23,.1);
                if(last)for(let j=0;j<6;j++){
                  const f=j/6,t=(j+1)/6;
                  for(const u of [f,t])wires.push(last.x+(px-last.x)*u+s.nx*side*.67,7.13-2.8*u*(1-u),last.z+(pz-last.z)*u+s.nz*side*.67);
                }
              }
            }last={x:px,z:pz};
          }
        }
        let seed=s.seed||1;
        const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
        const step=dense?13:23;
        let d=(s.seed%step)+2;
        if(d>s.len&&s.len>5)d=s.len*.52;
        for(;d<s.len;d+=step){
          const x=s.ax+s.fx*d,z=s.az+s.fz*d;
          if(Math.hypot(x,z)>420)continue;
          for(const sign of [-1,1]){
            const house=random()<(dense?.73:.34),type=Math.floor(random()*shopTypes.length);
            const width=4.5+random()*2.9,depth=5+random()*3.9;
            const dist=s.w+(house?3.5+depth/2:3)+random()*(house?3:5);
            const hx=x+sign*s.nx*dist,hz=z+sign*s.nz*dist;
            const footprint=house?Math.hypot(width,depth)/2+.8:1.7;
            if(blocked(hx,hz,footprint))continue;
            const cellsTaken=[];
            for(let gx=Math.floor((hx-footprint)/6);gx<=Math.floor((hx+footprint)/6);gx++)
              for(let gz=Math.floor((hz-footprint)/6);gz<=Math.floor((hz+footprint)/6);gz++)cellsTaken.push(gx+','+gz);
            if(cellsTaken.some(key=>occupied.has(key)))continue;
            cellsTaken.forEach(key=>occupied.add(key));
            if(house){
              const h=(shopTypes[type][3]?6.7:3.65)+random()*.62;
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
              instance('pavement',unitBox,hx+sx*depth/2,.1,hz+sz*depth/2,width+.35,.2,2.7,rot);
              const porch=depth/2+.72;
              instance('awning',unitBox,hx+sx*porch,2.65,hz+sz*porch,width+.4,.13,1.8,rot,[0xa2a692,0xbc8062,0x809b93][type%3]);
              instance('concrete',unitPole,hx+sx*porch+s.fx*width*.45,1.32,hz+sz*porch+s.fz*width*.45,.09,2.62,.09);
              if(type%3===0)instance('steel',unitPole,hx,h+.65,hz,1.2,1.0,1.2);
            }else{
              const palm=random()<.26,height=(palm?7.5:5)+random()*5,w=height*(palm?.59:.92),r=random()*Math.PI;
              for(let k=0;k<2;k++){const angle=r+k*Math.PI/2,off=w*(palm?.07:.12);instance(palm?'palm':'tree',unitPlane,hx+off*Math.cos(angle),height*.49,hz-off*Math.sin(angle),w,height,1,angle);}
            }
          }
        }
      }
      function surface(data,mat,y,freq){
        if(!data.length)return;
        const verts=new Float32Array(data.length*1.5),uv=new Float32Array(data.length),normals=new Float32Array(verts.length);
        for(let i=0,j=0;i<data.length;i+=2,j+=3){
          verts[j]=data[i];verts[j+1]=y;verts[j+2]=data[i+1];normals[j+1]=1;
          uv[i]=(data[i]+cx%1024)*freq;uv[i+1]=(data[i+1]+cz%1024)*freq;
        }
        const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(verts,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));
        const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;roadGroup.add(mesh);
      }
      material.white.side=material.yellow.side=T.DoubleSide;
      surface(waterData,waterMaterial,-.085,.074);surface(landData,material.earth,-.032,.55);surface(roadData,material.asphalt,.002,.18);surface(yellow,material.yellow,.026,1);surface(white,material.white,.026,1);
      if(wires.length){
        const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(wires,3));
        roadGroup.add(new T.LineSegments(lines,wireMaterial));
      }
      for(const [key,b] of batches){
        const m=new T.InstancedMesh(b.geo,material[key],b.poses.length);
        b.poses.forEach((pose,i)=>{m.setMatrixAt(i,pose);if(b.colors[i]!==null)m.setColorAt(i,tone.set(b.colors[i]));});
        m.castShadow=true;m.receiveShadow=true;roadGroup.add(m);
      }
      shadowStamp=-1000;
    }
    const assetPaths={supercar:'streetscape/race-car.glb',gt:'streetscape/gt-coupe.glb',rally:'streetscape/rally-car.glb',sedan:'traffic/hatchback.glb',van:'traffic/kei-van.glb',scooter:'traffic/motor-scooter.glb',taxi:'streetscape/city-taxi.glb',rival:'streetscape/gt-coupe.glb'};
    const lengths={supercar:4.6,gt:4.65,rally:4.25,sedan:3.95,van:4.05,scooter:1.84,taxi:4.52,rival:4.65};
    const cache=new Map(),colors=[0x446370,0x9f553e,0x9aaba9,0x384c67,0xa7a39c,0x99864e];
    const contact=document.createElement('canvas');contact.width=contact.height=64;
    const ctx=contact.getContext('2d'),grad=ctx.createRadialGradient(32,32,9,32,32,31);
    grad.addColorStop(0,'rgba(10,13,15,.75)');grad.addColorStop(1,'rgba(10,13,15,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
    const contactMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(contact),transparent:true,depthWrite:false});
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
      block(0,high*.38,0,wide,high*.42,len*.97,paint);block(0,high*.69,-len*.055,wide*.87,high*.43,len*.56,windows);
      block(0,high*.92,-len*.08,wide*.84,.07,len*.49,paint);
      for(const s of [-1,1]){
        block(s*wide*.34,high*.48,-len*.485,wide*.22,.1,.05,lamps);
        for(const side of [-1,1])block(s*wide*.47,.29,side*len*.31,.16,.38,.54,tires);
      }
      const item={root,outside,low,kind,idx,wheels:[],front:[],light:null,detail:null,loading:false};
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
            }else if(player&&src.name==='light_rear'){
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
            patch.position.set(axle.x,.014,axle.z);patch.scale.set(kind==='scooter'?.24:.48,.62,1);item.detail.add(patch);
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
    let player=null,version=0,width=0,height=0,totalDriven=0,lastPaint=0;
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
        if(item.light)item.light.emissiveIntensity=car.brake?3.5:.55;
      }
    }
    function render(car,traffic,dt,inside=false){
      if(!car||!Number.isFinite(car.x)||!Number.isFinite(car.z))return;
      resize();dt=Math.max(0,Math.min(.12,dt||0));version++;totalDriven+=Math.abs(car.speed||0)*dt;
      wave.offset.set((performance.now()*.000024)%1,(performance.now()*.000012)%1);
      const x=car.x-originX,z=car.z-originZ;
      const kind=['supercar','gt','rally'].includes(car.model)?car.model:'supercar';
      if(!player||player.kind!==kind){
        if(player)player.root.visible=false;
        if(!players.has(kind))players.set(kind,makeVehicle(kind,0,true));player=players.get(kind);player.request();player.root.visible=true;
      }
      pose(player,car,dt,true);player.outside.visible=!inside;playerRig.position.set(x,.011,z);playerRig.rotation.y=-car.yaw;
      mirrorRotation.setFromAxisAngle(up,-car.yaw);
      cabinCourse.finish=Math.ceil(totalDriven);cabinCourse.name=car.roadName||'Việt Nam';
      if(cabin)cabin.update(inside,Math.abs(car.speed||0)*3.6,car.steer||0,totalDriven,cabinCourse);
      const closest=(traffic||[]).map(a=>({a,d:(a.x-car.x)**2+(a.z-car.z)**2})).filter(v=>v.d<360*360).sort((a,b)=>a.d-b.d);
      for(const [index,{a,d}] of closest.entries()){
        const kind=assetPaths[a.kind]?a.kind:'sedan';
        let item=trafficItems.get(a.id);
        if(item&&item.kind!==kind){trafficItems.delete(a.id);item.root.visible=false;(pools.get(item.kind)||pools.set(item.kind,[]).get(item.kind)).push(item);item=null;}
        if(!item){item=pools.get(kind)?.pop()||makeVehicle(kind,Math.abs(Number(a.id)||index));trafficItems.set(a.id,item);}
        item.tick=version;item.root.visible=true;pose(item,a,dt,index<(small?3:5)&&d<115*115);
      }
      for(const [id,item] of trafficItems)if(item.tick!==version){
        trafficItems.delete(id);item.root.visible=false;
        if(!pools.has(item.kind))pools.set(item.kind,[]);pools.get(item.kind).push(item);
      }
      const sin=Math.sin(car.yaw),cos=Math.cos(car.yaw),speed=Math.abs(car.speed||0);
      sun.target.position.set(Math.round(x+sin*17),0,Math.round(z-cos*17));sun.position.copy(sun.target.position).addScaledVector(up,42);sun.position.x-=34;sun.position.z+=25;
      const now=performance.now();if(now-shadowStamp>(small?115:66)){renderer.shadowMap.needsUpdate=true;shadowStamp=now;}
      hills.position.set(x,0,z);hills.scale.y=car.region==='highlands'?1.65:car.region==='delta'?.4:.78;
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
      camera.position.copy(eye);camera.lookAt(look);
      const fov=inside?64:car.showroom?47:57+Math.min(15,speed*.28);
      if(Math.abs(fov-camera.fov)>.05){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*7));camera.updateProjectionMatrix();}
      if(inside&&cabin)cabin.reflect(mirrorAdapter,scene,playerRig,0,0);
      renderer.render(scene,camera);
      if(lastPaint&&now-lastPaint>100&&version%40===0&&renderer.getPixelRatio()>.78)renderer.setPixelRatio(Math.max(.78,renderer.getPixelRatio()*.88));
      lastPaint=now;
    }
    return {setRoads,render,resize};
  };
})();
