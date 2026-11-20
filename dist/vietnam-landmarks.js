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
      source:'https://visithcmc.vn/vi/kham-pha-cho-ben-thanh-tphcm-tu-a-z-5-phut-doc/'},
    {id:'sapa',name:'Nhà thờ đá Sa Pa',city:'Sa Pa',lon:103.8423215,lat:22.335102,yaw:-2.31,width:12.6,depth:38.5,scale:[1.11,1,1.24],
      start:[103.841426,22.335771],map:'https://www.openstreetmap.org/way/1379648108',source:'https://vietnamtourism.gov.vn/en/post/11269'},
    {id:'coal',name:'Bảo tàng Quảng Ninh',city:'Hạ Long',lon:107.097448,lat:20.9485596,yaw:1.386,width:62,depth:45,scale:[1.09,1,.98],
      start:[107.098402,20.949146],map:'https://www.openstreetmap.org/way/674061974',source:'https://dulichso.quangninh.gov.vn/article/bao-tang-quang-ninh-bieu-tuong-than-da-giua-long-ha-long-2d1'},
    {id:'flag',name:'Kỳ Đài',city:'Huế',lon:107.5802849,lat:16.4663006,yaw:.623,width:78,depth:49,scale:[1.18,1,.79],
      start:[107.581668,16.465841],map:'https://www.openstreetmap.org/way/218427614',source:'https://svhtt.hue.gov.vn/tin-trong-tinh/khanh-thanh-cong-trinh-chieu-sang-my-thuat-ky-dai-hue.html'},
    {id:'ponagar',name:'Tháp Bà Po Nagar',city:'Nha Trang',lon:109.195463,lat:12.265371,yaw:1.56,width:47,depth:58,
      start:[109.196350,12.265950],map:'https://www.openstreetmap.org/way/146780347',source:'https://vietnam.travel/vi/things-to-do/vietnams-cham-legacy/'},
    {id:'nghinh',name:'Tháp Nghinh Phong',city:'Tuy Hòa',lon:109.307256,lat:13.1163162,yaw:-2.13,width:38,depth:14,
      start:[109.306441,13.115609],map:'https://www.openstreetmap.org/node/11055944805',source:'https://vietnamtourism.gov.vn/printer/54780?type=1'},
    {id:'rong',name:'Nhà rông Kon Klor',city:'Kon Tum',lon:108.0344241,lat:14.3482379,yaw:-1.32,width:16.7,depth:9.9,
      start:[108.033765,14.347389],map:'https://www.openstreetmap.org/node/4133919102',source:'https://nongthon.vietnamtourism.gov.vn/thanh-pho-kon-tum-bao-ton-va-phat-huy-gia-tri-nghe-truyen-thong/'},
    {id:'station',name:'Ga Đà Lạt',city:'Đà Lạt',lon:108.4544254,lat:11.9415757,yaw:-.99,width:66,depth:17,scale:[1.27,1,1.07],
      start:[108.453436,11.941116],map:'https://www.openstreetmap.org/relation/17877171',source:'https://vietnamtourism.gov.vn/post/33922'},
    {id:'bat',name:'Chùa Dơi',city:'Sóc Trăng',lon:105.9724502,lat:9.5789424,yaw:-1.219,width:13.1,depth:19.7,scale:[.8,1,.68],
      start:[105.972331,9.580009],map:'https://www.openstreetmap.org/way/669125218',source:'https://dantoc.vietnamtourism.gov.vn/kham-pha-chua-doi-noi-hoi-tu-van-hoa-khmer-viet-hoa/'},
    {id:'dinh',name:'Dinh Cậu',city:'Phú Quốc',lon:103.9564106,lat:10.2172171,yaw:1.01,width:11,depth:13,
      start:[103.957484,10.217047],map:'https://www.openstreetmap.org/way/1491082316',source:'https://vietnamtourism.gov.vn/post/54798'}
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
    function sign(title,x,y,z,width,height,glass=false){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
      const g=canvas.getContext('2d');if(!glass){g.fillStyle='#f2dfa7';g.fillRect(0,0,768,128);}
      g.fillStyle=glass?'#f1f2ef':'#703d39';g.font=glass?'bold 78px Arial':'bold 76px Georgia, serif';g.textAlign='center';g.textBaseline='middle';g.fillText(title,384,67,732);
      const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
      const panel=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshStandardMaterial({map,transparent:glass,alphaTest:glass?.32:0,roughness:.86}));
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
    // The following pieces share the same baked mesh and metric coordinates as the original three sites.
    const stone=0xa3937c,ochre=0xd3a451,cream=0xf3deb0,tileRed=0x95513d,wood=0x633e2e;
    function gable(x,eaves,z,w,h,d,tint){
      outline([[-w/2,0],[0,h],[w/2,0]],tint,x,eaves,z-d/2,d);
    }
    function steps(x,z,width,count){
      for(let i=0;i<count;i++)box(i%2?0xc1b49a:0xb7ac97,x,(count-i)*.085,z+i*.36,width,(count-i)*.17,.39);
    }
    function dial(x,y,z,r){
      stamp(round,0x6d6253,x,y,z,r,.14,r,0,Math.PI/2);
      stamp(round,0xf2e7c9,x,y,z+.13,r*.89,.09,r*.89,0,Math.PI/2);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;box(wood,x+r*.74*Math.sin(a),y+r*.74*Math.cos(a),z+.21,.07,r*.16,.07,0,0,-a);
      }
      for(const [a,l] of [[-.78,.42],[1.15,.7]])box(wood,x+Math.sin(a)*l*r/2,y+Math.cos(a)*l*r/2,z+.25,.08,r*l,.08,0,0,-a);
    }
    function stoneWindow(x,y,z,w,h,angle=0){
      box(0x46504d,x,y+h/2,z,w,h,.16,angle);
      arch(0xc4beb1,x+.13*Math.sin(angle),y,z+.13*Math.cos(angle),w+.3,h+.16,angle);
    }
    if(id==='sapa'){
      const brick=0x9d998d,w=10.4;
      box(brick,0,3.25,-2,w,6.5,27);gable(0,6.5,-2,w+1,4,28,0x71685b);
      for(const side of [-1,1])for(let i=0;i<6;i++){
        const z=-14+i*4.6;box(0xb3afa2,side*5.25,3,z,1.1,6.1,.64);
        stoneWindow(side*5.23,1.6,z+1.9,1.45,3.5,side*Math.PI/2);
      }
      box(brick,0,8.45,12.0,4.9,16.9,5.3);
      for(const h of [5.1,10.9,16.55])box(0xc4bfb3,0,h,12,5.34,.28,5.75);
      stoneWindow(0,.35,14.7,2.45,4.3);stoneWindow(0,12.0,14.72,2.25,3.45);
      dial(0,9.25,14.71,1.05);
      tapered(0x5b5e5c,0,19.1,12,3.82,.12,4.6);box(cream,0,21.84,12,.12,1.4,.12);box(cream,0,22,12,.77,.12,.12);
      for(const s of [-1,1]){box(brick,s*3.8,2.75,12.7,2.35,5.5,2.55);gable(s*3.8,5.5,12.7,2.6,1.8,2.8,0x827768);}
      steps(0,15,7,4);
    }
    if(id==='coal'){
      // Dark glass expansion joints catch different bands of sky and coastal haze.
      box(0x93958e,0,.44,0,58,.88,48);
      for(const s of [-1,1]){
        const d=s===1?21:24,z=s*11.4;
        box(0x263439,0,12.5,z,55,24,d);
        for(let i=0;i<22;i++)for(let j=0;j<7;j++){
          const floor=0x283e45+j*0x020202;
          box(floor+(i%6)*0x010101,(i-10.5)*2.48,2.6+j*3.35,z+s*(d/2+.05),2.43,3.30,.08);
        }
      }
      box(0x394346,0,3.3,22.15,18,6.6,2.3);steps(0,24.0,30,7);
      sign('BẢO TÀNG QUẢNG NINH',0,19.8,22.1,32,2.75,true);
    }
    if(id==='flag'){
      for(const [base,w,d,h] of [[0,66,62,5.5],[5.5,48,44,5.8],[11.3,32,29,5.8]]){
        box(0x807c69,0,base+h/2,0,w,h,d);
        box(0xa49a7f,0,base+h-.18,0,w+.42,.5,d+.42);
        for(let z=-d*.45;z<d*.47;z+=4.3)for(const side of [-1,1])box(0x6e7060,side*w/2,base+h*.57,z,.11,.86,1.2);
      }
      stamp(round,0xa2957d,0,36,0,.29,38,.29);
      // Folded red flag with the national star visible on either face.
      const flagY=51.8;
      const wave=x=>Math.sin(x*.42)*.57;
      for(let i=0;i<16;i++){const x=(i+.5)*.63;box(0xc62827,x,flagY-i*.04,wave(x),.65,6,.055,-Math.atan(.24*Math.cos(x*.42)));}
      const star=Array.from({length:10},(_,i)=>[Math.sin(i*Math.PI/5)*(i%2?.62:1.65),Math.cos(i*Math.PI/5)*(i%2?.62:1.65)]);
      for(const side of [-1,1])outline(star,0xf3c837,4.7,flagY-.25,wave(4.7)+side*.32,.02);
    }
    if(id==='ponagar'){
      const brick=0xa85339,dark=0x70402e;
      // The surviving towers rise over the red-brick column hall on Cù Lao hill.
      const mound=new T.SphereGeometry(1,40,10);stamp(mound,0x73834f,0,-3.5,0,29,10,30);mound.dispose();
      const shrub=new T.IcosahedronGeometry(1,0);
      for(let i=0;i<100;i++){
        const a=i*2.4,r=.76+random()*.22,x=29*r*Math.cos(a),z=30*r*Math.sin(a);
        if(Math.abs(x)<6&&z>0)continue;
        stamp(shrub,i%4?0x5c753c:0x846d50,x,-3.5+10*Math.sqrt(1-r*r),z,1.1+random()*2,.65+random(),1.1+random(),a);
      }
      shrub.dispose();
      function cham(x,z,w,h){
        const y=5.85;box(0x986147,x,y,z,w+1.3,.65,w+1.5);
        box(brick,x,y+h*.28,z,w,h*.56,w);
        for(const s of [-1,1])for(const f of [-.37,-.13,.13,.37]){
          box(0xb86445,x+f*w,y+h*.29,z+s*w*.5,w*.10,h*.53,.38);
          box(0xb46143,x+s*w*.5,y+h*.29,z+f*w,.38,h*.53,w*.10);
        }
        for(let i=0;i<4;i++){
          const k=1-i*.18,hh=h*(.107-i*.009),base=y+h*.56+h*(.11*i-.0045*i*(i-1));
          box(dark,x,base,z,w*k*1.12,.34,w*k*1.12);
          tapered(brick,x,base+hh*.5,z,w*k*.74,w*k*.53,hh);
          for(const sx of [-1,1])for(const sz of [-1,1])tapered(0xa95a3e,x+sx*k*w*.39,base+hh*.55,z+sz*k*w*.39,w*k*.14,.05,hh*1.3);
        }
        tapered(0xb38a64,x,y+h*.98,z,w*.11,.05,h*.14,1,8);
        box(0x422f29,x,y+h*.17,z+w*.5+.07,w*.34,h*.30,.17);arch(0xbb7050,x,y,z+w*.5+.2,w*.46,h*.38);
      }
      cham(4,-4,9.8,21);cham(-10,-4,5.3,11);cham(-10,8,4.1,8.5);cham(4,-11,4.5,9);
      for(let i=0;i<5;i++)for(const x of [-5,5])tapered(brick,x,4.5,13+i*2.9,1.2,.9,5.15,1,8);
    }
    if(id==='nghinh'){
      const grey=[0xbeb9aa,0xc6c1b6,0xb0aca1,0xaaa597];
      // Basalt-inspired hexagonal shafts form two ascending fans separated by a wind slot.
      for(const side of [-1,1])for(let i=0;i<7;i++)for(let j=0;j<5;j++){
        const x=side*(1.63+i*2.46),z=(j-2+(i%2)*.5)*2.82;
        const h=1.5+(side===1?34:29)*Math.pow(1-i/7,2.1)*Math.pow(1-Math.abs(j-2)/4,1.45);
        tapered(grey[(i+j)%4],x,h/2,z,1.63,1.60,h,1,6);
      }
      box(0xc2bba9,0,.08,0,39,.16,21);
    }
    if(id==='rong'){
      const straw=0x957749,bamboo=0xb08c5d;
      for(const x of [-6.2,6.2])for(const z of [-3.8,0,3.8])stamp(round,wood,x,1.55,z,.32,3.1,.32);
      box(wood,0,2.9,0,15,.4,9.8);box(bamboo,0,4.3,0,14,2.6,8.8);
      const roofProfile=[[-5.5,0],[-4.9,.3],[-3.25,6.1],[-1.9,10.9],[-.24,16],[.24,16],[1.9,10.9],[3.25,6.1],[4.9,.3],[5.5,0]];
      outline(roofProfile,straw,-7.8,5.25,0,15.6,Math.PI/2);
      for(let i=0;i<18;i++)for(const side of [-1,1]){
        const z=side*(4.7-1.6),x=-7.45+i*.87;
        box(i%3?0x806b49:0xaf905a,x,9.5,z,.07,9.0,.11,0,-side*.29);
      }
      // Bands of bound thatch follow the taper rather than a rectangular texture.
      for(let i=1;i<25;i++)for(const side of [-1,1]){
        const t=i/25,z=side*(5.16-4.95*t);
        box(i%5?0x9a8055:0x796745,0,5.4+t*15.75,z,15.6,.055,.14);
      }
      for(let i=0;i<26;i++)for(const side of [-1,1])box(0x806647,-6.8+i*.55,4.35,side*4.46,.10,2.48,.09);
      box(wood,0,21.4,0,16.6,.25,.39);
      for(const x of [-7.6,7.6])for(const s of [-1,1])box(wood,x,21.85,s*.32,.16,1.3,.15,0,s*.55);
      for(let j=0;j<10;j++)box(bamboo,0,.24+j*.29,8-j*.31,1.55,.17,.36);
      box(0x41352b,0,4.06,4.45,1.65,2.24,.15);
    }
    if(id==='station'){
      box(ochre,0,2.8,0,51,5.6,13.2);
      const amber=0xdcb469;gable(0,5.6,0,51.4,1.9,13.8,tileRed);
      for(let i=-1;i<=1;i++){
        const x=i*7.9,w=8.2;
        gable(x,4.7,3.5,w,7.3,10.3,0x9e543c);
        outline([[-w*.48,0],[0,7.05],[w*.48,0]],amber,x,4.7,8.7,.18);
        for(let j=-2;j<=2;j++)box(0x85533c,x+j*.78,6.3-Math.abs(j)*.33,8.9,.18,3-Math.abs(j)*.52,.14);
        box(0x555b50,x,2.25,6.71,4.4,4.15,.18);
        for(let j=-1;j<=1;j++)box(cream,x+j*1.1,2.4,6.86,.12,4,.10);
      }
      dial(0,8.25,8.98,1.06);
      for(const s of [-1,1])for(let i=0;i<3;i++){const x=s*(14.8+i*4);box(wood,x,3.35,6.7,2.6,2.65,.12);box(cream,x,3.35,6.8,.12,2.64,.08);}
      sign('DALAT',0,4.1,8.95,4.7,1.0);
    }
    if(id==='bat'){
      box(cream,0,.55,0,17,1.1,29);box(ochre,0,3.65,0,12,5.4,24);
      for(const s of [-1,1])for(let i=0;i<7;i++){
        const z=-12+i*4;box(cream,s*7.4,3.48,z,.72,4.95,.72);tapered(0xc69d47,s*7.4,6.1,z,.63,.83,.7);
      }
      for(const [w,d,y,h] of [[16.7,29,6.3,3.8],[13.5,23,8.4,3.6],[9,19,10.8,3.7]]){
        gable(0,y,0,w,h,d,0xb66742);
        for(const s of [-1,1])for(const end of [-1,1]){
          const x=s*w*.51,z=end*d*.5;
          outline([[0,0],[s*.38,.12],[s*.69,.6],[s*.78,1.4],[s*.27,.8]],0xd5ab4e,x,y,z,.23);
          box(0xe2c16c,s*w*.25,y+h*.5,z,.23,Math.hypot(w/2,h),.23,0,0,s*Math.atan2(w/2,h));
        }
      }
      for(const end of [-1,1]){
        outline([[-5,0],[0,4.2],[5,0]],0xcf9a4c,0,6.25,end*12.3,.2);box(wood,0,3.1,end*12.04,2.5,3.9,.12);
        for(let j=0;j<5;j++)for(let k=-4+j;k<=4-j;k+=2){
          outline([[0,0],[.27,.3],[0,.64],[-.27,.3]],0xffcf63,k*.72,6.4+j*.58,end*(12.55),.13);
        }
      }
      steps(0,13.3,5.4,5);
    }
    if(id==='dinh'){
      const rock=new T.IcosahedronGeometry(1,1);
      for(let i=0;i<29;i++){
        const a=i*2.39996,r=Math.sqrt(i/29),x=10.6*r*Math.cos(a),z=10*r*Math.sin(a);
        stamp(rock,i%4===0?0xa79478:0x8e806e,x,1.3-r,z,3.6,2.8+(1-r)*2,3.25,i);
      }
      rock.dispose();box(0xbd9a74,0,3.25,0,11,.68,14.2);box(0xe4b886,0,4.95,-.5,8.2,3.3,8.8);
      for(const [w,d,y,h] of [[10.5,11,6.4,2.35],[6.7,6.3,8.05,1.7]]){
        tapered(tileRed,0,y+h*.48,-.5,w*.72,w*.17,h,d/w);
        for(const sx of [-1,1])for(const sz of [-1,1])box(0x995432,sx*w*.47,y+.23,-.5+sz*d*.46,.21,.27,1.3,sx*sz*.67,-sz*.30);
      }
      for(const x of [-3.5,3.5])stamp(round,0xa6533b,x,5.0,4.55,.24,3.45,.24);
      steps(0,6.5,2.25,14);
      const canopy=new T.IcosahedronGeometry(1,1);
      stamp(round,0x736450,-6.7,5.27,-2,.75,6.8,.65,0,.09,-.17);
      for(let i=0;i<14;i++){
        const a=i*2.399,r=Math.sqrt(i/14)*3.5;
        stamp(canopy,[0x54693f,0x6b794b,0x607748][i%3],-7+Math.cos(a)*r,9.7-r*.28+random()*.5,-2+Math.sin(a)*r,2.6,1.54,2.15,a);
      }
      canopy.dispose();
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
    const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({map,vertexColors:true,roughness:id==='coal'?.22:.88,metalness:id==='coal'?.42:0}));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    cube.dispose();round.dispose();group.name=id;return group;
  }
  function create(T,scene){
    const cached=new Map();let active=[];
    function setOrigin(graph,cx,cz,ground=()=>0){
      for(const {mesh} of active)mesh.visible=false;
      active=[];
      if(!graph)return;
      for(const data of entries){
        const {x,z}=graph.point(data.lon,data.lat);if(Math.hypot(x-cx,z-cz)>1050)continue;
        if(!cached.has(data.id)){const mesh=model(T,data.id);scene.add(mesh);cached.set(data.id,mesh);}
        const mesh=cached.get(data.id);mesh.position.set(x-cx,ground(x,z),z-cz);mesh.rotation.y=data.yaw;mesh.visible=true;
        if(data.scale)mesh.scale.fromArray(data.scale);
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
