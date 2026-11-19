/* Metres, with the player's direction of travel along negative Z. */
(() => {
  const T = THREE;
  const canvas = document.getElementById('road');
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0xffdfba, 0.008);
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const camera = new T.PerspectiveCamera(48, 1, 0.12, 600);
  scene.add(new T.HemisphereLight(0xfff1d8, 0x98a7a9, 1.65));
  const sun = new T.DirectionalLight(0xffdcac, 2);
  sun.position.set(-45, 68, -36);
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
  const asphalt=texture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#585952';ctx.fillRect(0,0,w,h);
    for(let i=0;i<19000;i++){ctx.fillStyle=random()>.5?'rgba(255,245,221,.1)':'rgba(0,0,0,.15)';ctx.fillRect(random()*w,random()*h,1+random()*2,1);}
  });
  asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping; asphalt.repeat.set(3,75);
  block(new T.MeshLambertMaterial({map:asphalt}),0,-.12,-120,16,.22,420);
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
      for(let j=0;j<6;j++){c.fillStyle=j%2?'#547476':'#798985';c.fillRect(22+j*82,633,73,124);}
    })});
  }
  const facades=shopNames.map((_,i)=>facade(i,2+i%3));
  const panel=new T.PlaneGeometry();
  const foliage=[0x65804a,0x7f9a58,0x516e46,0x95a35b,0x526e3e];
  function tree(x,z){
    const height=3.9+random()*1.7;
    block(0x73604c,x,height*.46,z,.31,height*.92,.32);
    for(let j=0;j<10;j++){
      const a=random()*6.28, r=random()*1.8;
      part(leaf,foliage[j%5],x+Math.cos(a)*r,height+random()*1.6,z+Math.sin(a)*r,1.4+random(),1.1+random(),1.3+random(),a);
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
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));scene.add(mesh);
  }
  let width=0,height=0;
  window.renderDrive=function(distance=0,lateral=2,time=0,green=false){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w<1||h<1)return;
    if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    player.position.set(lateral,0,-distance+2.13);
    camera.position.set(lateral+.55,3.25,9-distance);
    camera.lookAt(lateral-.35,1.72,-distance-8);
    sky.position.copy(camera.position);
    bulbs[0].color.setHex(green?0x4d3533:0xff3823);bulbs[2].color.setHex(green?0x41ff82:0x29443b);
    opposing.forEach((g,i)=>{g.rotation.y=Math.PI;g.position.set(-2.25-i%2*3,0,22-(264+i*77-time*5%264)%264);});
    scooters.forEach((g,i)=>{const forward=i%2===0;g.rotation.y=forward?0:Math.PI;g.position.set(forward?6.55:-6.45,0,15-((i*51+36+(forward?1:-1)*time*3)%260+260)%260);});
    renderer.render(scene,camera);
  };
  window.renderDrive();
})();

