// Roadside buildings face the carriageway. All repeated masonry, poles and roofs are instanced.
function distantHills(){
  const group=new T.Group();
  for(let band=0;band<2;band++){
    const vertices=[],colors=[],indices=[],shade=new T.Color(),radius=band?760:970,columns=256;
    for(let i=0;i<=columns;i++){
      const a=i/columns*Math.PI*2;
      const peaks=Math.abs(Math.sin(5*a+.6)+.55*Math.sin(11*a)+.25*Math.cos(23*a+.7));
      const height=(river?43:75)+(river?39:76)*peaks+(band?0:45);
      for(let row=0;row<5;row++){
        const t=row/4,r=radius+t*100;
        vertices.push(Math.cos(a)*r,-16+(height+16)*t,Math.sin(a)*r);
        shade.set(band?0x475f53:0x758984).multiplyScalar(.75+.24*t+.17*Math.cos(5*a)+.1*Math.sin(17*a+t*3));
        colors.push(shade.r,shade.g,shade.b);
      }
      if(i)for(let j=0;j<4;j++){const n=i*5+j;indices.push(n-5,n,n+1,n-5,n+1,n-4);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);
    group.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));
  }scene.add(group);return group;
}
function buildRoadside(){
  const windowGlass='#425957',wirePoints=[];
  const shops=[
    ['CÀ PHÊ','BẾN SÔNG','#e4d6b4','#436658'],
    ['BÁNH MÌ','LÒ CHÚ TƯ','#e9c76b','#923f2e'],
    ['TẠP HÓA','THANH AN','#dbdfcd','#32586c'],
    ['TRÀ ĐỒI','HƯƠNG SỚM','#c9d4ae','#435c43']
  ];
  function elevation(data){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;
    const ctx=canvas.getContext('2d'),[goods,name,wall,ink]=data;
    ctx.fillStyle=wall;ctx.fillRect(0,0,768,512);
    // Recessed windows and a slatted steel door with a shaded lintel.
    ctx.fillStyle='#52564a';ctx.fillRect(32,189,344,297);ctx.fillRect(423,190,307,227);
    ctx.fillStyle='#737f79';ctx.fillRect(43,198,322,288);
    for(let y=201;y<482;y+=7){ctx.fillStyle=y%3?'#8a9691':'#687672';ctx.fillRect(44,y,319,3);ctx.fillStyle='#4d5955';ctx.fillRect(44,y+4,319,1);}
    ctx.fillStyle=windowGlass;ctx.fillRect(433,200,288,204);
    for(let i=0;i<4;i++){const x=439+i*70;ctx.fillStyle='#677f78';ctx.fillRect(x,205,60,90);ctx.fillStyle='#485b55';ctx.fillRect(x,303,60,95);}
    ctx.fillStyle='#b7b7a0';ctx.fillRect(415,412,325,9);
    ctx.fillStyle=ink;ctx.fillRect(19,25,730,129);ctx.strokeStyle='#e6d9ba';ctx.lineWidth=2;ctx.strokeRect(26,32,716,115);
    ctx.textAlign='center';ctx.fillStyle='#f6e7c6';ctx.font='bold 25px Arial';ctx.fillText(goods,384,65);
    ctx.font='bold 63px Arial';ctx.fillText(name,384,128,680);
    for(let n=0;n<12000;n++){ctx.fillStyle=random()>.48?'rgba(39,37,22,.055)':'rgba(255,249,228,.064)';ctx.fillRect(random()*768,random()*512,1+random()*3,1+random()*4);}
    const grime=ctx.createLinearGradient(0,420,0,512);grime.addColorStop(0,'transparent');grime.addColorStop(1,'rgba(44,43,30,.4)');ctx.fillStyle=grime;ctx.fillRect(0,420,768,92);
    const tx=new T.CanvasTexture(canvas);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;return tx;
  }
  const facades=shops.map(shop=>({mat:new T.MeshLambertMaterial({map:elevation(shop)}),matrices:[]}));
  function store(d,l,variant){
    const p=at(d,l),y=ground(p.x,p.z),rise=y-p.y;
    const wide=5.8+variant*.46,depth=5.9,h=3.75,side=Math.sign(l);
    beside(d,l,'box',0xc7bd9f,depth,h,wide,rise);
    beside(d,l,'box',variant%2?0x8d6654:0x637779,depth+.42,.23,wide+.58,rise+h);
    const f=at(d,l-side*(depth/2+.022));
    temp.position.set(f.x,y+h/2,f.z);temp.rotation.set(0,-p.h-side*Math.PI/2,0);temp.scale.set(wide,h,1);temp.updateMatrix();
    facades[variant].matrices.push(temp.matrix.clone());
    const awning=l-side*(depth*.5+.78);
    beside(d,awning,'box',variant%2?0x796758:0x68807b,1.85,.12,wide+.32,rise+2.58);
    for(let dz=-wide/2;dz<wide/2;dz+=.22)beside(d+dz,awning,'box',0x89918a,1.84,.05,.044,rise+2.67);
    for(const dz of [-1,1])beside(d+dz*(wide*.48),awning-side*.79,'pole',0x596864,.082,2.68,.082,rise);
    beside(d,awning,'box',0xada89a,2.2,.18,wide+.5,rise-.04);
    beside(d+wide*.28,l+side*.35,'pole',0x98aaab,1.05,.95,1.05,rise+h+.23);
    for(const offset of [-1.35,1.35]){
      beside(d-wide/2-.04,l+offset,'box',0x88897a,1.48,1.44,.12,rise+1.18);
      beside(d-wide/2-.12,l+offset,'box',0x4b615b,1.27,1.24,.07,rise+1.27);
      for(const slit of [-.4,0,.4])beside(d-wide/2-.17,l+offset+slit,'box',0x999888,.035,1.24,.035,rise+1.27);
      beside(d-wide/2-.22,l+offset,'box',0xb7b3a1,1.68,.10,.45,rise+2.63);
    }
  }
  const clusters=river?[16,145,305,495,935,1235,1510,1830,2080]:[20,355,700,1120,1435,1770,2205];
  for(const [i,d] of clusters.entries()){
    if(d>route.finish-25)continue;
    for(let k=0;k<(i%3===0?3:2);k++)store(d+k*9.3,river?14+k*.7:(i%2?-1:1)*(16+k*.65),(i+k+(river?0:3))%4);
  }
  for(const group of facades){
    const m=new T.InstancedMesh(new T.PlaneGeometry(1,1),group.mat,group.matrices.length);
    group.matrices.forEach((mat,i)=>m.setMatrixAt(i,mat));m.receiveShadow=true;scene.add(m);
  }
  let last;
  for(let d=1;d<route.finish+18;d+=34){
    if(d>bridgeStart-8&&d<bridgeEnd+8){last=null;continue;}
    const p=at(d,8.8),y=ground(p.x,p.z),height=6.8;
    scatter('pole',0xaaa69a,p.x,y+height/2,p.z,.21,height,.21);
    scatter('box',0x65665f,p.x,y+height-.38,p.z,1.55,.1,.14,-p.h);
    const wires=[];
    for(const dx of [-.62,0,.62]){
      const q=at(d,8.8+dx),top=new T.Vector3(q.x,y+height-.16,q.z);wires.push(top);
      scatter('pole',0x64554b,top.x,top.y-.12,top.z,.11,.27,.11);
    }
    if(last)wires.forEach((tip,index)=>{
      const begin=last[index];let a=begin;
      for(let n=1;n<=8;n++){const t=n/8,b=begin.clone().lerp(tip,t);b.y-=2.6*t*(1-t);wirePoints.push(a.x,a.y,a.z,b.x,b.y,b.z);a=b;}
    });last=wires;
  }
  const line=new T.BufferGeometry();line.setAttribute('position',new T.Float32BufferAttribute(wirePoints,3));
  scene.add(new T.LineSegments(line,new T.LineBasicMaterial({color:0x464840,transparent:true,opacity:.68})));
}
