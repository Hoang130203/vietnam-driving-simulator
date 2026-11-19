'use strict';
window.VietnamLandmarks=(()=>{
  // OSM footprint centres and axes in WGS84. Positive local Z is the principal façade.
  const entries=[
    {id:'turtle',name:'Tháp Rùa',city:'Hà Nội',lon:105.852293,lat:21.027873,yaw:0,width:4.54,depth:6.28,
      start:[105.853697,21.027313],map:'https://www.openstreetmap.org/way/178995269',
      source:'https://scov.gov.vn/dat-nuoc-con-nguoi/dat-nuoc-viet-nam/ho-guom-dep-tuyet-qua-goc-nhin-la.html'},
    {id:'cathedral',name:'Nhà thờ Con Gà',city:'Đà Nẵng',lon:108.2230584,lat:16.0666828,yaw:1.492,width:20,depth:46,
      start:[108.223797,16.067551],map:'https://www.openstreetmap.org/way/404714309',
      source:'https://danangfantasticity.com/en/culture-en/danang-cathedral'},
    {id:'market',name:'Chợ Bến Thành',city:'TP. Hồ Chí Minh',lon:106.698017,lat:10.772568,yaw:.532,width:89,depth:122,
      start:[106.698484,10.771409],map:'https://www.openstreetmap.org/way/39514795',
      source:'https://visithcmc.vn/vi/kham-pha-cho-ben-thanh-tphcm-tu-a-z-5-phut-doc/'}
  ];
  const churchRails=[[-14.7,39,.29,16.4],[14.7,39,.29,16.4],[-10.05,55.1,4,.38],[10.05,55.1,4,.38]];

  // Bake the masonry, roof tiles, trims and ornaments into one draw call per building.
  function model(T,id){
    const positions=[],normals=[],colours=[],uvs=[],group=new T.Group(),pose=new T.Object3D();
    let seed=2043;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const cube=new T.BoxGeometry(),round=new T.CylinderGeometry(1,1,1,20),colour=new T.Color();
    function stamp(geo,tint,x,y,z,w=1,h=1,d=1,ry=0,rx=0,rz=0){
      pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.rotation.set(rx,ry,rz,'YXZ');pose.updateMatrix();
      const transformed=geo.clone().applyMatrix4(pose.matrix),p=transformed.attributes.position,n=transformed.attributes.normal;
      const order=transformed.index;colour.setHex(tint);
      for(let i=0;i<(order?order.count:p.count);i++){
        const j=order?order.getX(i):i,px=p.getX(j),py=p.getY(j),pz=p.getZ(j),nx=n.getX(j),ny=n.getY(j),nz=n.getZ(j);
        positions.push(px,py,pz);normals.push(nx,ny,nz);colours.push(colour.r,colour.g,colour.b);
        uvs.push((Math.abs(nx)>Math.abs(nz)?pz:px)*.23,(Math.abs(ny)>.64?pz:py)*.23);
      }
      transformed.dispose();
    }
    const box=(...args)=>stamp(cube,...args);
    function tapered(tint,x,y,z,base,top,height,depthRatio=1,sides=4){
      const geo=new T.CylinderGeometry(top,base,height,sides);
      if(sides===4)geo.rotateY(Math.PI/4);
      stamp(geo,tint,x,y,z,1,1,depthRatio);geo.dispose();
    }
    function profile(shape,tint,x,y,z,depth,angle=0){
      const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8});stamp(geo,tint,x,y,z,1,1,1,angle);geo.dispose();
    }
    function outline(points,tint,x,y,z,thickness,angle=0){
      const shape=new T.Shape();points.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
      profile(shape,tint,x,y,z,thickness,angle);
    }
    function arch(tint,x,y,z,width,height,angle=0){
      // A solid spandrel and jambs around a genuinely open passage.
      const span=width*.35,spring=height*.46;
      const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(-span,0);s.lineTo(-span,spring);
      s.quadraticCurveTo(-span,spring+span,0,spring+span*1.15);s.quadraticCurveTo(span,spring+span,span,spring);
      s.lineTo(span,0);s.lineTo(width/2,0);s.lineTo(width/2,height);s.lineTo(-width/2,height);s.closePath();
      profile(s,tint,x,y,z,.28,angle);
    }
    function sign(title,x,y,z,width,height){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
      const g=canvas.getContext('2d');g.fillStyle='#f2dfa7';g.fillRect(0,0,768,128);
      g.fillStyle='#703d39';g.font='bold 76px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(title,384,67,732);
      const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
      const panel=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map,roughness:.86}));
      panel.position.set(x,y,z);group.add(panel);
    }
    if(id==='turtle'){
      const stone=0xad9e87,band=0xc5b699,roof=0x796758;
      const island=new T.SphereGeometry(1,40,9);
      for(let i=0;i<island.attributes.position.count;i++){
        const p=island.attributes.position,x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),wave=1+.027*Math.sin(a*7)+.016*Math.cos(a*11);
        p.setXYZ(i,x*wave,y,z*wave);
      }
      island.computeVertexNormals();stamp(island,0x726952,0,-.98,0,9.5,1.47,12.7);stamp(island,0x617746,0,-.64,0,8.96,1.23,11.95);
      const shrub=new T.IcosahedronGeometry(1,0);
      for(let i=0;i<64;i++){
        const a=random()*Math.PI*2,dist=.61+random()*.28,x=Math.cos(a)*8.9*dist,z=Math.sin(a)*11.9*dist;
        stamp(shrub,i%4?0x647d45:0x85924d,x,-.64+1.23*Math.sqrt(1-dist*dist),z,.2+random()*.4,.12+random()*.25,.3,a);
      }
      shrub.dispose();island.dispose();
      box(stone,0,.59,0,4.95,.28,6.65);
      for(const [base,w,d,h] of [[.72,4.54,6.28,2.22],[3.31,3.64,4.8,1.98]]){
        for(const side of [-1,1]){
          for(let i=0;i<3;i++)arch(stone,side*(w/2-.13),base,(i-1)*d/3,d/3,h,side*Math.PI/2);
          for(let i=0;i<2;i++)arch(stone,(i-.5)*w/2,base,side*(d/2-.13),w/2,h,side<0?Math.PI:0);
        }
        for(const [rise,edge,thick,tint] of [[.04,.23,.16,band],[.21,.36,.18,roof],[.32,.07,.10,band]])box(tint,0,base+h+rise,0,w+edge,thick,d+edge);
      }
      box(stone,0,6.26,0,2.25,1.38,2.95);
      stamp(round,0x393831,1.14,6.28,0,.31,.04,.31,0,0,Math.PI/2);
      tapered(roof,0,7.18,0,2.24,1.31,.57,1.23);
      for(const dx of [-1,1])for(const dz of [-1,1])box(roof,dx*1.53,7.04,dz*1.9,.22,.19,.62,dx*dz*.4,dz*-.36);
      box(band,0,7.55,0,1.91,.3,2.32);tapered(stone,0,8.0,0,1.83,.56,.68,1.22);
      tapered(roof,0,8.50,0,.47,.19,.38,1,8);
    }
    if(id==='cathedral'){
      const pink=0xdf9697,blush=0xf3b6ad,trim=0xffe2c4,glass=0x334958,slate=0x757c7b;
      box(0xc9b59e,0,.03,38,30,.12,35);
      for(let j=0;j<4;j++)box(0xe4d4bd,0,.1+j*.1,24.45-j*.45,10-j*.25,.17+j*.2,1);
      for(const side of [-1,1]){
        box(0x73865c,side*10.7,.12,40,6.7,.17,24);
        box(0xddb7a3,side*14.7,.23,39,.49,.42,35);
        for(let j=0;j<=12;j++){
          const z=23+j*2.6;box(blush,side*14.7,1.07,z,.51,2.1,.5);tapered(trim,side*14.7,2.21,z,.42,.16,.24);
          if(j<12)for(let i=0;i<6;i++)box(0x52645b,side*14.7,1.02,z+.31+i*.37,.07,1.48,.065);
        }
        box(0x52645b,side*14.7,1.55,38.5,.09,.09,31);
        for(const x of [6.5,13.6]){box(blush,x*side,1.47,55.1,.95,2.9,.95);tapered(trim,x*side,3.08,55.1,.77,.22,.54);}
        box(0x52645b,10.1*side,1.5,55.1,6.6,.08,.09);
        for(let i=0;i<15;i++)box(0x52645b,(7.02+i*.44)*side,.92,55.1,.065,1.75,.09);
      }
      box(0xafa397,0,.21,0,20.8,.42,47);box(pink,0,5.2,-1,18.7,10,42);
      const gable=[[-9.7,0],[0,5.7],[9.7,0]];
      outline(gable,slate,0,10.1,-22,42.8);
      function lancet(x,y,z,w,h,a){
        for(const [scale,depth,tint] of [[1,0,trim],[.76,.08,glass]]){
          const width=w*scale,hgt=h*scale;
          const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,hgt*.57);
          s.quadraticCurveTo(width*.36,hgt*.86,0,hgt);s.quadraticCurveTo(-width*.36,hgt*.86,-width/2,hgt*.57);s.closePath();
          profile(s,tint,x+Math.sin(a)*depth,y+(h-hgt)/2,z+Math.cos(a)*depth,.09,a);
        }
        box(trim,x+.18*Math.sin(a),y+h*.42,z+.18*Math.cos(a),.12,h*.61,.11,a);
      }
      for(const side of [-1,1])for(let j=0;j<8;j++){
        const z=-19+j*5.3;
        box(blush,side*9.68,4.55,z,.95,9.1,.82);tapered(trim,side*9.68,9.48,z,.65,.12,.84);
        if(j<7)lancet(side*9.41,2.2,z+2.5,2.8,6.3,side*Math.PI/2);
      }
      box(blush,0,8.8,19,8.1,17.1,6.7);
      for(const side of [-1,1]){
        box(blush,side*7.25,6.4,19,4.25,12.4,6.5);tapered(slate,side*7.25,15.5,19,3.17,.03,5.8);
        lancet(side*7.25,2.1,22.26,2.7,5,0);
        for(const sx of [-1,1])tapered(trim,side*7.25+sx*1.92,14.1,21.94,.39,.02,3.2);
      }
      for(const [y,w,h] of [[16.9,8.8,.65],[25.1,7.8,.64],[32.3,6.5,.58],[37,5.4,.52]])box(trim,0,y,19,w,h,w*.85);
      box(pink,0,21,19,7.0,8.6,5.7);box(blush,0,28.9,19,5.9,7.4,5);box(pink,0,34.8,19,4.95,4.9,4);
      for(const [y,z,w,h] of [[.6,22.39,5.4,9],[18,21.91,3.5,5.9],[26.5,21.53,3,4.8],[33.4,21.03,2.1,3.0]])lancet(0,y,z,w,h,0);
      // Rose window, tracery and four corner pinnacles mark the stepped bell tower.
      stamp(round,trim,0,13.4,22.43,2.2,.14,2.2,0,Math.PI/2);stamp(round,glass,0,13.4,22.55,1.82,.12,1.82,0,Math.PI/2);
      for(let i=0;i<6;i++)box(trim,0,13.4,22.67,.1,3.6,.085,0,0,i*Math.PI/6);
      for(const x of [-2.8,2.8])for(const z of [16.7,21.3])tapered(trim,x,34.7,z,.59,.04,4.7);
      tapered(slate,0,46.2,19,3.46,.16,18.4,1,8);stamp(round,0x43474a,0,56.13,19,.09,1.7,.09);
      outline([[-1.32,.88],[-1.06,.82],[-.75,.4],[-.46,.42],[-.21,.63],[.04,.59],[.23,1.08],[.38,1.18],[.45,1.43],[.54,1.22],[.75,1.31],[.69,1.05],[.97,.97],[.65,.82],[.52,.44],[.32,.12],[-.09,0],[-.55,.11],[-.81,.32],[-1.35,.49]],0x504d41,0,56.9,19,.1);
    }
    if(id==='market'){
      const wall=0xe2c58f,trim=0xf2e0b0,tile=0xa6503d,glass=0x49534d;
      box(0xa5a297,0,.16,0,90,.32,123);box(wall,0,3.1,0,88,5.9,121);
      for(let i=0;i<6;i++){
        const x=(i-2.5)*14.6;
        outline([[-7.3,0],[0,3.55],[7.3,0]],i%2?tile:0xad5943,x,6,-60.9,121.8);
        box(0x924b39,x,9.58,0,.42,.32,121.9);
        for(const f of [-1,1])outline([[-7.18,0],[0,3.34],[7.18,0]],wall,x,6,f*61,.15,f<0?Math.PI:0);
      }
      for(const side of [-1,1]){
        for(let i=0;i<20;i++){
          const z=(i-9.5)*5.95;box(trim,side*44.1,3.35,z,1.1,6.6,.6);
          box(glass,side*44.08,2.65,z+2.67,.2,4.2,4.25);
          for(let j=0;j<3;j++)box(wall,side*44.25,3.62+j*.4,z+2.67,.22,.16,4.35);
        }
        for(let i=0;i<7;i++){
          const x=side*(9+i*5.25);box(glass,x,2.6,60.7,3.6,4.4,.28);box(trim,x+side*2.23,3.3,61,.53,6.4,.77);
          box(i%3===0?0x8e9d80:0xb26446,x,4.75,61.3,4.85,.16,1.6,0,.09);
          box(0x79684e,x,1.03,61.06,3.5,.34,.56);
          for(let j=0;j<4;j++)box([0xc78a52,0xbba16f,0x909c62,0xaf6145][(i+j)%4],x-1.29+j*.78,1.45,61,.69,.51,.48);
        }
      }
      const cz=56.3;
      box(wall,0,7.5,cz,9.7,14.8,9.1);box(trim,0,14.9,cz,10.2,.68,9.5);
      box(wall,0,17.65,cz,9.2,5.2,8.7);
      for(const a of [0,Math.PI/2,-Math.PI/2]){
        const s=Math.sin(a),c=Math.cos(a),face=a===0?4.42:4.66;
        stamp(round,0x896e4a,s*face,17.61,cz+c*face,1.96,.18,1.96,a,Math.PI/2);
        stamp(round,0xfff3d9,s*(face+.12),17.61,cz+c*(face+.12),1.7,.09,1.7,a,Math.PI/2);
        for(let i=0;i<12;i++){
          const rad=i*Math.PI/6,off=Math.sin(rad)*1.4,depth=face+.2;
          box(0x484637,s*depth+c*off,17.61+Math.cos(rad)*1.4,cz+c*depth-s*off,.1,.30,.08,a,0,-rad);
        }
        for(const [ang,len] of [[-.96,1.06],[1.12,.83]]){
          const off=Math.sin(ang)*len/2,depth=face+.27;
          box(0x34392f,s*depth+c*off,17.61+Math.cos(ang)*len/2,cz+c*depth-s*off,.13,len,.08,a,0,-ang);
        }
      }
      box(trim,0,20.51,cz,10.2,.6,9.7);tapered(tile,0,22.0,cz,7.5,1.1,2.5,.93);
      box(glass,0,3.35,61,6.6,6.4,.28);arch(trim,0,.24,61.21,9.4,7.2);
      sign('CHỢ BẾN THÀNH',0,10.65,61.04,8.65,1.44);
    }
    const geometry=new T.BufferGeometry();
    for(const [name,values] of [['position',positions],['normal',normals],['color',colours]])geometry.setAttribute(name,new T.Float32BufferAttribute(values,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();
    // Shared metre-scale plaster grain. Edge wrapping also repeats stains at texture seams.
    const tile=document.createElement('canvas');tile.width=tile.height=128;
    const ctx=tile.getContext('2d'),pixels=ctx.createImageData(128,128);
    for(let i=0;i<pixels.data.length;i+=4){const val=236+random()*18;pixels.data.set([val,val,val,255],i);}
    ctx.putImageData(pixels,0,0);
    for(let i=0;i<85;i++){
      const x=random()*128,y=random()*128,r=1+random()*11;
      for(const dx of [-128,0,128])for(const dy of [-128,0,128]){
        const xx=x+dx,yy=y+dy,grad=ctx.createRadialGradient(xx,yy,0,xx,yy,r);
        grad.addColorStop(0,'rgba(91,82,70,.13)');grad.addColorStop(1,'rgba(91,82,70,0)');ctx.fillStyle=grad;ctx.fillRect(xx-r,yy-r,r*2,r*2);
      }
    }
    const map=new T.CanvasTexture(tile);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({map,vertexColors:true,roughness:.88}));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    cube.dispose();round.dispose();group.name=id;return group;
  }
  function create(T,scene){
    const cached=new Map();let active=[];
    function setOrigin(graph,cx,cz){
      for(const {mesh} of active)mesh.visible=false;
      active=[];
      if(!graph)return;
      for(const data of entries){
        const {x,z}=graph.point(data.lon,data.lat);if(Math.hypot(x-cx,z-cz)>1050)continue;
        if(!cached.has(data.id)){const mesh=model(T,data.id);scene.add(mesh);cached.set(data.id,mesh);}
        const mesh=cached.get(data.id);mesh.position.set(x-cx,0,z-cz);mesh.rotation.y=data.yaw;mesh.visible=true;
        active.push({data,x,z,mesh,c:Math.cos(data.yaw),s:Math.sin(data.yaw)});
      }
    }
    function nearest(x,z,maxMeters=650){
      let best=null;
      for(const site of active){
        const distance=Math.hypot(x-site.x,z-site.z);
        if(distance<=maxMeters&&(!best||best.distance>distance))best={data:site.data,distance,x:site.x,z:site.z};
      }
      return best;
    }
    function reserved(x,z,padding=0){
      return active.some(a=>{
        const dx=x-a.x,dz=z-a.z,extra=a.data.id==='cathedral'?8:a.data.id==='turtle'?12:2;
        const u=dx*a.c-dz*a.s,v=dx*a.s+dz*a.c;
        if(a.data.id==='cathedral'&&Math.abs(u)<16+padding&&v>0&&v<57+padding)return true;
        return Math.abs(u)<a.data.width/2+extra+padding&&Math.abs(v)<a.data.depth/2+extra+padding;
      });
    }
    function contact(x,z,r=.95){
      for(const a of active){
        const dx=x-a.x,dz=z-a.z,u=dx*a.c-dz*a.s,v=dx*a.s+dz*a.c;
        function solid(cx,cz,w,d){
          const lx=u-cx,lz=v-cz;
          let nx=lx-Math.max(-w,Math.min(w,lx)),nz=lz-Math.max(-d,Math.min(d,lz)),depth;
          const length=Math.hypot(nx,nz);
          if(length>=r)return null;
          if(length){depth=r-length;nx/=length;nz/=length;}
          else if(w-Math.abs(lx)<d-Math.abs(lz)){depth=r+w-Math.abs(lx);nx=Math.sign(lx)||1;nz=0;}
          else{depth=r+d-Math.abs(lz);nz=Math.sign(lz)||1;nx=0;}
          const wx=nx*a.c+nz*a.s,wz=-nx*a.s+nz*a.c;
          return {nx:wx,nz:wz,pointX:x+wx*(depth-r),pointZ:z+wz*(depth-r),depth,kind:'building',id:a.data.id};
        }
        const main=solid(0,0,a.data.width/2,a.data.depth/2);if(main)return main;
        if(a.data.id==='cathedral')for(const rail of churchRails){const hit=solid(...rail);if(hit)return hit;}
      }
      return null;
    }
    return {setOrigin,nearest,reserved,contact};
  }
  return {entries,create};
})();
