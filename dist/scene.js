/* Metres, with the player's direction of travel along negative Z. */
(() => {
  const T = THREE;
  const canvas = document.getElementById('road');
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xcdd9df, 0.0055);
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  const camera = new T.PerspectiveCamera(48, 1, 0.12, 600);
  scene.add(new T.HemisphereLight(0xddeeff, 0x81796b, 1.26));
  const sun = new T.DirectionalLight(0xffdcac, 2);
  sun.position.set(-48, 64, -116);
  sun.target.position.set(0, 0, -95);
  scene.add(sun.target);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-132,right:132,top:103,bottom:-103,near:.5,far:225});
  sun.shadow.normalBias=.065;
  sun.shadow.bias=-.00024;
  scene.add(sun);
  let seed = 473;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function texture(w,h,paint) {
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    paint(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace=T.SRGBColorSpace;
    else tex.encoding=T.sRGBEncoding;
    tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  const basic = (map) => new T.MeshBasicMaterial({map});
  const cache=new Map();
  function material(color) {
    if (!cache.has(color)) cache.set(color,new T.MeshLambertMaterial({color}));
    return cache.get(color);
  }
  const box=new T.BoxGeometry(), leaf=new T.IcosahedronGeometry(1,1);
  const staticParts=new Map();
  function part(geo,mat,x,y,z,w,h,d,ry=0,rz=0,parent=null) {
    mat=typeof mat==='object'?mat:material(mat);
    const mesh=new T.Mesh(geo,mat);
    mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.rotation.set(0,ry,rz); mesh.updateMatrix();
    if(parent) parent.add(mesh);
    else {
      const key=geo.uuid+mat.uuid;
      if(!staticParts.has(key)) staticParts.set(key,{geo,mat,matrices:[]});
      staticParts.get(key).matrices.push(mesh.matrix);
    }
    return mesh;
  }
  const block=(...args)=>part(box,...args);
  const sky=new T.Mesh(new T.SphereGeometry(500,32,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false, uniforms:{},
    vertexShader:'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 dir;void main(){vec3 n=normalize(dir);float y=max(n.y,0.);vec3 c=mix(vec3(.99,.86,.69),vec3(.31,.67,.86),smoothstep(0.,.48,y));float s=dot(n,normalize(vec3(-.41,.32,-1.)));c+=vec3(.26,.18,.09)*pow(max(0.,s),26.);c=mix(c,vec3(1.,.96,.8),smoothstep(.9988,.9994,s));gl_FragColor=vec4(c,1.);}'
  })); scene.add(sky);
  const loader=new T.TextureLoader();
  loader.load('streetscape/sky.jpg',map=>{
    map.colorSpace=T.SRGBColorSpace;
    sky.material=new T.MeshBasicMaterial({map,side:T.BackSide,fog:false,depthWrite:false});
    sky.rotation.y=.54;
  });
  const asphalt=texture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#585952';ctx.fillRect(0,0,w,h);
    for(let i=0;i<19000;i++){ctx.fillStyle=random()>.5?'rgba(255,245,221,.1)':'rgba(0,0,0,.15)';ctx.fillRect(random()*w,random()*h,1+random()*2,1);}
  });
  asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping; asphalt.repeat.set(3,75);
  const roadMaterial=new T.MeshLambertMaterial({map:asphalt});
  loader.load('streetscape/asphalt.jpg',map=>{
    map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;
    map.repeat.set(4,105);
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    roadMaterial.map=map;
    roadMaterial.color.setHex(0xb8b9c1);
    roadMaterial.needsUpdate=true;
  });
  block(roadMaterial,0,-.12,-120,16,.22,420);
  block(0xaaa28e,0,-.29,-110,200,.2,420);
  block(0x595b58,0,-.04,-101,170,.05,14);
  for(let z=20;z>-300;z-=6){
    if(z<-90&&z>-113)continue;
    block(0xe9ae37,0,.012,z,.12,.02,3.4);
    for(const side of [-1,1]) block(0xece8dc,side*4,.012,z,.11,.02,2.4);
  }
  for(const z of [-93,-110]){
    for(let i=-7.6;i<8;i+=1.05)block(0xf6f0df,i,.026,z,.51,.023,3);
  }
  block(0xf4ead9,4,.03,-90,7.9,.025,.30);
  const shopNames=['CÀ PHÊ PHỐ','BÁNH MÌ','HOA TƯƠI','NHÀ SÁCH','PHỞ HÀ NỘI','TRÀ VIỆT','TẠP HÓA','TIỆM ẢNH'];
  const paints=['#e4c190','#cbd8c5','#e2b9a1','#e7dbbe','#c9cbbb','#e3cc9d','#b4c6bf','#ecd4b5'];
  const boards=['#12594f','#ae4c35','#3d6862','#394e63','#9a342d','#39614a','#ab7031','#374653'];
  function facade(i,floors) {
    return new T.MeshLambertMaterial({map:texture(512,768,(c,w,h)=>{
      c.fillStyle=paints[i];c.fillRect(0,0,w,h);
      const fh=540/floors;
      for(let f=0;f<floors;f++){
        let top=f*fh;
        for(let j=0;j<3;j++){
          let x=25+j*159;
          c.fillStyle='#eee3c9';c.fillRect(x-5,top+12,143,fh*.71);
          const gl=c.createLinearGradient(x,top,x+80,top+fh);gl.addColorStop(0,'#bacbc3');gl.addColorStop(.4,'#749193');gl.addColorStop(1,'#394e52');
          c.fillStyle=gl;c.fillRect(x,top+16,133,fh*.64);
          c.fillStyle='#d9ceb7';c.fillRect(x+61,top+15,5,fh*.65);
          for(let k=0;k<7;k++){c.fillStyle='#566265';c.fillRect(x+k*21,top+fh*.69,3,fh*.2);}
          c.fillRect(x,top+fh*.69,133,4);
        }
        c.fillStyle='#a69d88';c.fillRect(0,top+fh-11,w,5);
        c.fillStyle='#eee2c7';c.fillRect(0,top+fh-6,w,6);
      }
      c.fillStyle=boards[i];c.fillRect(0,544,w,72);
      c.fillStyle='#fff6d9';c.font='bold 49px Arial';c.textAlign='center';c.fillText(shopNames[i],256,598,482);
      c.fillStyle='#344746';c.fillRect(12,625,488,143);
      // Layer a reflected street, shelving and merchandise behind the shop glass.
      for(let j=0;j<6;j++){
        const x=22+j*82;
        const window=c.createLinearGradient(0,628,0,762);
        window.addColorStop(0,'#72898a');window.addColorStop(.24,'#465b5a');window.addColorStop(.53,'#3d4036');window.addColorStop(1,'#7b7565');
        c.fillStyle=window;c.fillRect(x,633,73,124);
        for(let row=0;row<3;row++){
          for(let k=0;k<9;k++){
            c.fillStyle=['#ab9060','#c0b39a','#787b60','#a26443','#6d8182'][Math.floor(random()*5)];
            let hh=4+random()*13;c.fillRect(x+3+k*7.5,677+row*25-hh,4+random()*2,hh);
          }
          c.fillStyle='#514938';c.fillRect(x,677+row*25,73,3);
        }
        c.fillStyle='rgba(209,225,225,.13)';c.beginPath();c.moveTo(x,633);c.lineTo(x+39,633);c.lineTo(x+12,757);c.lineTo(x,757);c.fill();
        c.fillStyle='#283637';c.fillRect(x+36,633,2,124);
      }
      c.fillStyle='#cdc4a6';c.font='bold 11px Arial';c.fillText(['CÀ PHÊ RANG XAY','BÁNH MÌ NÓNG','HOA TƯƠI MỖI NGÀY','SÁCH VÀ VĂN PHÒNG PHẨM','PHỞ BÒ GIA TRUYỀN','TRÀ VÀ CÀ PHÊ','HÀNG TIÊU DÙNG','IN ẢNH KỸ THUẬT SỐ'][i],256,612,475);
    })});
  }
  const facades=shopNames.map((_,i)=>facade(i,2+i%3));
  const panel=new T.PlaneGeometry();
  const canopyMap=texture(256,256,(c)=>{
    const shades=['#335839','#436b39','#618442','#82994e','#9aaf60'];
    for(let i=0;i<3600;i++){
      const a=random()*Math.PI*2,r=Math.sqrt(random()),x=128+Math.cos(a)*r*113,y=128+Math.sin(a)*r*105;
      if (r>.7 && Math.sin(a*9)+Math.cos(a*13)<(r-.7)*3) continue;
      const tone=Math.max(0,Math.min(4,Math.floor(random()*3.5+(1-y/128)*1.3)));
      c.fillStyle=shades[tone];c.beginPath();c.ellipse(x,y,2+random()*5,1+random()*2,random()*3,0,Math.PI*2);c.fill();
    }
  });
  const foliage=new T.MeshLambertMaterial({map:canopyMap,side:T.DoubleSide,alphaTest:.45});
  const trunk=new T.CylinderGeometry(.11,.24,1,7);
  function tree(x,z){
    const h=4+random()*1.5;
    part(trunk,0x65574a,x,h*.43,z,1,h*.86,1);
    for(let j=0;j<4;j++){
      const angle=j*1.58+random()*.3;
      part(trunk,0x756859,x+Math.cos(angle)*.26,h*.79,z+Math.sin(angle)*.26,.55,h*.48,.55,angle,.45);
    }
    for(let j=0;j<7;j++){
      const a=j*2.4, r=j===6?0:1.2;
      const cx=x+Math.cos(a)*r, cz=z+Math.sin(a)*r, cy=h+(j===6?1.45:random()*.8);
      for(let k=0;k<2;k++)part(panel,foliage,cx,cy,cz,4.3,3.7,1,a+k*Math.PI/2);
    }
    block(0x99927f,x,.24,z,1.45,.2,1.5);
  }
  for(const side of [-1,1]){
    for(let z=26;z>-265;z-=9){
      if(z<-89&&z>-115)continue;
      let i=Math.floor(random()*8), height=7+i%3*1.5+random()*3, x=side*(12.2+random()*.65);
      block(0xc3b59e,side*9.9,.065,z,3.85,.22,9);
      block(paints[i],x+side*3.2,height/2,z,6.6,height,8.87);
      part(panel,facades[i],x-side*.125,height/2,z,8.85,height,1,-side*Math.PI/2);
      block(0xf2e3c7,x+side*2.95,height,z,7,.28,9.1);
      block(boards[i],x-side*.48,height*.28,z,.95,.15,8.8);
      for(let f=1;f<=2;f++){
        const y=height*(.29+f*.22);
        block(0xc6bba4,x-side*.39,y,z,.79,.15,7.6);
        for(let rail=0;rail<3;rail++)block(0x565e60,x-side*.76,y+.16+rail*.18,z,.038,.035,7.48);
        for(let rail=-3.5;rail<4;rail+=1.17)block(0x565e60,x-side*.76,y+.28,z+rail,.045,.58,.045);
      }
      if(i===0 || i===4 || i===5){
        for(const dz of [-2.3,2.3]){
          const tx=x-side*1.05;
          block(0x564d40,tx,.68,z+dz,.85,.075,.68);
          block(0x625c54,tx,.39,z+dz,.09,.58,.09);
          for(const offset of [-.56,.56]){
            block(boards[i],tx,.39,z+dz+offset,.37,.085,.35);
            for(const sx of [-.14,.14])block(0x514d44,tx+sx,.23,z+dz+offset,.045,.31,.25);
          }
        }
      }
      if(i%2===0) {
        block(0xc7c5b1,x-side*.29,height*.62,z+3,.52,.56,.82);
        block(0xd8d7c6,x+side*2,height+.65,z+1.7,1.5,1.4,1.5);
      }
      if(Math.round((26-z)/9)%2===0)tree(side*9.35,z+2.2);
      if(i%3===0){
        block(0x646f6a,side*8.6,3.5,z,.105,7,.1);
        block(0x6e7872,side*7.65,6.98,z,2.02,.105,.12);
        block(0xe7e0c3,side*6.75,6.88,z,.62,.12,.33);
      }
    }
    for(let j=0;j<36;j++){
      const h=13+random()*24;
      block(paints[j%8],side*(27+random()*19),h/2,-j*8,h*.42,h,7+random()*5);
    }
  }
  // Cloth flags and utility cables frame the boulevard at eye level.
  const flagMaterial=basic(texture(128,82,(c,w,h)=>{
    c.fillStyle='#bd3028';c.fillRect(0,0,w,h);c.fillStyle='#f6d055';c.beginPath();
    for(let i=0;i<10;i++){
      const angle=i*Math.PI/5-Math.PI/2,r=i%2?9:23;
      const x=64+Math.cos(angle)*r,y=41+Math.sin(angle)*r;
      if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.closePath();c.fill();
  }));
  flagMaterial.side=T.DoubleSide;
  for(const side of [-1,1]){
    for(let z=8;z>-218;z-=30){
      if(z<-89&&z>-115)continue;
      block(0x8c7b61,side*10.75,4.25,z,.08,1.58,.08,0,-side*.48);
      part(panel,flagMaterial,side*10.38,4.31,z,1.25,.79,1,side*.64,-side*.13);
    }
    for(let z=8;z>-230;z-=24){
      for(let j=0;j<3;j++){
        const points=[];
        for(let k=0;k<=8;k++)points.push(new T.Vector3(side*(10.8+j*.15),7.4-.49*Math.sin(Math.PI*k/8),z-3*k));
        const wire=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x605c50}));
        scene.add(wire);
      }
    }
  }
  const signMat=basic(texture(512,160,(c,w,h)=>{
    c.fillStyle='#28745a';c.fillRect(0,0,w,h);c.strokeStyle='#fffae7';c.lineWidth=5;c.strokeRect(8,8,w-16,h-16);
    c.fillStyle='#fff';c.textAlign='center';c.font='bold 49px Arial';c.fillText('↑  TRUNG TÂM',256,73);
    c.font='31px Arial';c.fillText('Trần Phú   →',256,124);
  }));
  block(0x71766f,8.25,3.7,-36,.15,7.4,.15);
  block(0x71766f,6.6,7.1,-36,3.4,.15,.18);
  part(panel,signMat,5.4,6.45,-35.9,4.8,1.5,1);
  block(0x56625e,8,3.5,-92,.2,7,.19);
  block(0x56625e,5.1,6.85,-92,6,.15,.18);
  block(0x242e30,3,5.97,-92,.61,1.8,.4);
  const bulbs=[];
  for(let i=0;i<3;i++){
    const mat=new T.MeshBasicMaterial({color:0x302e28});
    bulbs.push(mat);
    part(leaf,mat,3,6.51-i*.53,-91.76,.20,.20,.09);
  }
  const speedSign=texture(256,256,c=>{
    c.fillStyle='#bf281e';c.beginPath();c.arc(128,128,124,0,Math.PI*2);c.fill();
    c.fillStyle='#f8f5e9';c.beginPath();c.arc(128,128,100,0,Math.PI*2);c.fill();
    c.fillStyle='#242424';c.font='bold 120px Arial';c.textAlign='center';c.fillText('40',127,169);
  });
  block(0xb5b7af,7.95,1.78,-25,.09,3.56,.09);
  part(panel,new T.MeshBasicMaterial({map:speedSign,alphaTest:.5}),7.95,3.32,-24.92,1.02,1.02,1);
  // Mark the curbside bay as it appears in the final parking exercise.
  const parkingSign=basic(texture(200,236,c=>{
    c.fillStyle='#f3eee6';c.fillRect(0,0,200,236);
    c.fillStyle='#1d5994';c.fillRect(6,6,188,224);
    c.fillStyle='white';c.textAlign='center';c.font='bold 196px Arial';c.fillText('P',100,188);
  }));
  block(0xafb7b7,8.18,1.62,-162,.085,3.24,.085);
  part(panel,parkingSign,8.18,3.18,-161.92,.72,.86,1);
  for(let z=-161;z>-186;z-=3)block(0xe9e6d7,5.68,.032,z,.10,.018,1.6);
  for(const z of [-160,-186])block(0xe9e6d7,6.79,.032,z,2.34,.018,.11);
  function hull(group,color,rings) {
    const vertices=[],indices=[];
    for(const [z,y,w,top,wt] of rings)vertices.push(-w,y,z,w,y,z,wt,top,z,-wt,top,z);
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++){
      const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,b+4,a,b+4,a+4);
    }
    const end=(rings.length-1)*4;indices.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    group.add(new T.Mesh(geo,new T.MeshPhongMaterial({color,side:T.DoubleSide,shininess:75})));
  }
  const tire=new T.CylinderGeometry(1,1,1,16); tire.rotateZ(Math.PI/2);
  const shadowTex=texture(64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(21,24,23,.8)');g.addColorStop(.56,'rgba(21,24,23,.55)');g.addColorStop(1,'rgba(21,24,23,0)');c.fillStyle=g;c.fillRect(0,0,64,64);
  });
  function car(color){
    const group=new T.Group();
    const shadow=new T.Mesh(panel,new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.scale.set(3.2,5.8,1);shadow.position.y=.052;group.add(shadow);
    hull(group,color,[[-2.13,.37,.78,.76,.78],[-1.55,.34,.94,.93,.86],[.84,.34,.96,.98,.89],[2.04,.41,.83,.89,.83]]);
    hull(group,0x344f5b,[[-1.19,.88,.84,.93,.8],[-.60,.93,.84,1.48,.66],[.53,.94,.85,1.47,.66],[1.28,.94,.81,1,.76]]);
    block(color,0,1.48,-.025,1.33,.09,1.17,0,0,group);
    for(const s of [-1,1]){
      block(0x252f32,s*.81,1.18,-.03,.06,.46,.105,0,0,group);
      block(color,s*.99,1.02,-.61,.24,.13,.21,0,0,group);
      block(0xdc3531,s*.613,.76,2.052,.43,.138,.06,0,0,group);
      block(0xffecbd,s*.60,.68,-2.13,.38,.12,.055,0,0,group);
      for(const z of [-1.32,1.34]){
        part(tire,0x222728,s*.9,.36,z,.18,.33,.33,0,0,group);
        part(tire,0x9ba6a3,s*.997,.36,z,.022,.21,.21,0,0,group);
      }
    }
    block(0x27343a,0,.49,2.04,1.51,.12,.11,0,0,group);
    block(0xfff1cb,0,.68,2.064,.49,.14,.035,0,0,group);
    scene.add(group);return group;
  }
  const player=car(0xe1b647);
  const opposing=[car(0x96bcab),car(0xd7d8d0),car(0xa0523c)];
  const scooters=[];
  for(let i=0;i<5;i++){
    const g=new T.Group();scene.add(g);scooters.push(g);
    for(const z of [-.53,.56])part(tire,0x252d2e,0,.26,z,.14,.26,.26,0,0,g);
    block(i%2?0xaf3e32:0x306967,0,.54,0,.38,.46,1.13,0,0,g);
    part(leaf,i%2?0x355e79:0xac795d,0,1.01,.1,.27,.44,.20,0,0,g);
    part(leaf,0xf3ba8e,0,1.52,.09,.18,.20,.17,0,0,g);
    part(leaf,i%2?0xe2d3af:0x529ba3,0,1.62,.09,.2,.15,.19,0,0,g);
  }
  for(const {geo,mat,matrices} of staticParts.values()){
    const mesh=new T.InstancedMesh(geo,mat,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.receiveShadow=true;
    mesh.castShadow=mat!==roadMaterial && mat!==flagMaterial && matrices[0].elements[5]>.03;
    scene.add(mesh);
  }
  const pedestrian=new T.Group();
  scene.add(pedestrian);
  const sphere=new T.SphereGeometry(1,12,10);
  const hips=[];
  const shoulders=[];
  function ellipsoid(group,color,x,y,z,w,h,d){
    return part(sphere,color,x,y,z,w,h,d,0,0,group);
  }
  pedestrian.rotation.y=Math.PI/2;
  ellipsoid(pedestrian,0xa34539,0,1.13,0,.235,.35,.14);
  ellipsoid(pedestrian,0xcda385,0,1.61,0,.115,.145,.115);
  ellipsoid(pedestrian,0x2e221c,0,1.69,.01,.12,.085,.117);
  for(const side of [-1,1]){
    const leg=new T.Group(),arm=new T.Group();
    leg.position.set(side*.108,.88,0);arm.position.set(side*.208,1.35,0);
    pedestrian.add(leg,arm);hips.push(leg);shoulders.push(arm);
    ellipsoid(leg,0x283749,0,-.36,0,.088,.42,.098);
    ellipsoid(leg,0x3b3936,0,-.77,.04,.085,.075,.15);
    ellipsoid(arm,0xa34539,0,-.11,0,.083,.16,.085);
    ellipsoid(arm,0xc99c7e,0,-.34,0,.058,.17,.062);
  }
  let crossingTime=0, previousDistance=0, previousTime=0;
  function animateCrossing(distance,time,green){
    if(distance<previousDistance-2 || time<previousTime)crossingTime=0;
    const delta=Math.max(0,Math.min(.2,time-previousTime));
    if(distance>=65 && !green)crossingTime+=delta;
    const progress=green?1:Math.min(1,crossingTime/10.5);
    pedestrian.position.set(-8.6+progress*17.2,0,-93);
    const stride=progress>0 && progress<1?Math.sin(crossingTime*7.4)*.48:0;
    hips[0].rotation.x=stride;hips[1].rotation.x=-stride;
    shoulders[0].rotation.x=-stride;shoulders[1].rotation.x=stride;
    previousDistance=distance;previousTime=time;
  }

  // Separate camera-space cabin keeps the eye point and dashboard proportions fixed.
  const interior=new T.Scene();
  const dashCamera=new T.OrthographicCamera(-1,1,1,-1,.01,8);
  dashCamera.position.z=4;
  interior.add(new T.HemisphereLight(0xe8f6ff,0x77726a,1.8));
  const cabinLight=new T.DirectionalLight(0xffe0ae,2.1);
  cabinLight.position.set(-3,5,4);interior.add(cabinLight);
  const leather=texture(128,128,(c,w,h)=>{
    c.fillStyle='#363a3b';c.fillRect(0,0,w,h);
    for(let i=0;i<8300;i++){c.fillStyle=random()>.5?'#46494a':'#292c2d';c.fillRect(random()*w,random()*h,1+random(),1);}
  });
  leather.wrapS=leather.wrapT=T.RepeatWrapping;
  leather.repeat.set(5,1);
  const softTrim=new T.MeshPhongMaterial({map:leather,shininess:12,specular:0x454846});
  const darkTrim=new T.MeshPhongMaterial({color:0x22282b,shininess:20});
  const chrome=new T.MeshPhongMaterial({color:0xa9b2b6,shininess:100});
  const consoleGroup=new T.Group();
  interior.add(consoleGroup);
  consoleGroup.position.y=.105;
  function surface(group,points,depth,mat,z=0,bevel=.01){
    const shape=new T.Shape();
    points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
    shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2});
    const mesh=new T.Mesh(geo,mat);mesh.position.z=z;group.add(mesh);return mesh;
  }
  const dash=surface(consoleGroup,[[-3,-.84],[-2,-.76],[-1.2,-.68],[-.65,-.64],[.05,-.66],[1.3,-.72],[3,-.82],[3,-1.2],[-3,-1.2]],.09,softTrim);
  dash.rotation.x=-.07;
  surface(consoleGroup,[[-3,-.95],[-1,-.83],[.2,-.85],[3,-1.02],[3,-1.06],[.2,-.89],[-1,-.87],[-3,-.99]],.02,chrome,.1,.003);
  const cluster=new T.Group();consoleGroup.add(cluster);
  cluster.position.set(-.28,-.745,.12);
  surface(cluster,[[-.39,-.1],[-.35,.10],[-.25,.145],[.25,.145],[.35,.095],[.39,-.10]],.055,darkTrim);
  const gauge=texture(640,180,c=>{
    const bg=c.createLinearGradient(0,0,0,180);bg.addColorStop(0,'#16252c');bg.addColorStop(1,'#080e14');
    c.fillStyle=bg;c.fillRect(0,0,640,180);c.textAlign='center';
    for(const [cx,max,step,label] of [[147,80,10,'km/h'],[495,8,1,'×1000 r/min']]){
      for(let n=0;n<=40;n++){
        const a=Math.PI*(.84+n/40*1.33),major=n%5===0;
        c.strokeStyle=n>33?'#f58f62':'#ccdcde';c.lineWidth=major?3:1;
        c.beginPath();c.moveTo(cx+Math.cos(a)*80,105+Math.sin(a)*80);
        c.lineTo(cx+Math.cos(a)*(major?67:74),105+Math.sin(a)*(major?67:74));c.stroke();
        if(major){c.fillStyle='#e9f0ed';c.font='17px Arial';c.fillText(n/5*step,cx+Math.cos(a)*54,111+Math.sin(a)*54);}
      }
      c.fillStyle='#c1cdcf';c.font='15px Arial';c.fillText(label,cx,139);
    }
    c.fillStyle='#8ad9b4';c.font='bold 44px Arial';c.fillText('D',320,85);
    c.fillStyle='#cbd8d5';c.font='14px Arial';c.fillText('DRIVE',320,111);
  });
  part(panel,basic(gauge),0,.012,.065,.68,.195,1,0,0,cluster);
  const needles=[];
  for(const cx of [147,495]){
    const pivot=new T.Group();
    pivot.position.set((cx/640-.5)*.68,.012+(.5-105/180)*.195,.073);
    cluster.add(pivot);
    surface(pivot,[[0,.003],[.070,.0006],[0,-.003]],.001,new T.MeshBasicMaterial({color:0xff914c}),0,0);
    needles.push(pivot);
  }
  const wheel=new T.Group();
  wheel.position.set(-.284,-1.014,.44);consoleGroup.add(wheel);
  const rim=new T.Mesh(new T.TorusGeometry(.315,.034,12,72),softTrim);wheel.add(rim);
  for(const angle of [-1.38,1.38,Math.PI]){
    const spoke=surface(wheel,[[-.03,.02],[-.025,.29],[.027,.29],[.056,.03]],.022,chrome);
    spoke.rotation.z=angle;
  }
  surface(wheel,[[-.152,.065],[-.12,.096],[.12,.096],[.152,.065],[.115,-.062],[.06,-.092],[-.065,-.092],[-.124,-.055]],.04,darkTrim,.023,.015);
  block(chrome,0,.01,.09,.085,.009,.006,0,0,wheel);
  for(let i=0;i<8;i++)block(darkTrim,.66,-.80-i*.012,.12,.42,.005,.02,0,-.005,consoleGroup);
  const pillars=[];
  for(const side of [-1,1]){
    const g=new T.Group();interior.add(g);pillars.push(g);
    surface(g,[[0,-.86],[-side*.072,-.73],[-side*.39,1.1],[-side*.26,1.1],[side*.06,-.76]],.05,darkTrim);
  }
  let cockpit=true;
  window.toggleDriveCamera=()=>{cockpit=!cockpit;return cockpit;};

  let width=0,height=0;
  window.renderDrive=function(distance=0,lateral=2,time=0,green=false,steering=0,speed=0){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w<1||h<1)return;
    if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    player.position.set(lateral,0,-distance+2.13);
    player.visible=!cockpit;
    if(cockpit){
      camera.fov=61;
      camera.position.set(lateral-.32,1.43,2.6-distance);
      camera.lookAt(lateral-.32+steering*.55,1.12,-distance-12);
    }else{
      camera.fov=48;
      camera.position.set(lateral+.55,3.25,9-distance);
      camera.lookAt(lateral-.35,1.72,-distance-8);
    }
    camera.updateProjectionMatrix();
    animateCrossing(distance,time,green);
    sky.position.copy(camera.position);
    bulbs[0].color.setHex(green?0x4d3533:0xff3823);bulbs[2].color.setHex(green?0x41ff82:0x29443b);
    opposing.forEach((g,i)=>{g.rotation.y=Math.PI;g.position.set(-2.25-i%2*3,0,22-(264+i*77-time*5%264)%264);});
    scooters.forEach((g,i)=>{const forward=i%2===0;g.rotation.y=forward?0:Math.PI;const z=15-((i*51+36+(forward?1:-1)*time*3)%260+260)%260;g.position.set(forward?6.55:-6.45,0,z);g.visible=!forward || z>-130;});
    renderer.autoClear=true;
    renderer.render(scene,camera);
    if(cockpit){
      const aspect=w/h;
      dashCamera.left=-aspect;dashCamera.right=aspect;dashCamera.updateProjectionMatrix();
      pillars[0].position.x=-aspect;pillars[1].position.x=aspect;
      needles[0].rotation.z=-Math.PI*(.84+1.33*T.MathUtils.clamp(speed/80,0,1));
      const rpm=speed>0?1.1+(speed%18)/18*1.9:.8;
      needles[1].rotation.z=-Math.PI*(.84+1.33*rpm/8);
      wheel.rotation.z=T.MathUtils.lerp(wheel.rotation.z,-steering*.9,.16);
      renderer.autoClear=false;renderer.clearDepth();renderer.render(interior,dashCamera);
    }
  };
  window.renderDrive();
})();

