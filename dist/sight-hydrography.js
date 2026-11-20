'use strict';
// Surveyed flow lines and entrance approaches, © OpenStreetMap contributors.
// The surveyed axis anchors the scene. Rock, spray and the unmeasured section
// are a visual interpretation of the feature rather than a measured cave survey.
(() => {
  const atlas=window.VietnamTourism,profiles=window.VietnamHydrography;
  const byId=atlas.byId??new Map(atlas.entries.map(s=>[s.id,s]));
  const shared=new Map(),reference=window.VietnamSightDetails??{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function map(T,file,colour) {
    if(!shared.has(file)){
      const t=new T.TextureLoader().load('streetscape/surfaces/'+file);
      t.wrapS=t.wrapT=T.RepeatWrapping;
      if(colour)t.colorSpace=T.SRGBColorSpace;
      t.userData.sightShared=true;shared.set(file,t);
    }
    return shared.get(file);
  }
  function rockMaterial(T){
    const m=new T.MeshStandardMaterial({map:map(T,'cut-rock-color.webp',true),normalMap:map(T,'cut-rock-normal.webp',false),
      normalScale:new T.Vector2(.95,.95),roughness:.92,vertexColors:true,side:T.DoubleSide});
    m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',
      `vec3 scan=texture2D(map,vMapUv*.39).rgb;
       float mineral=dot(scan,vec3(.28,.62,.1));
       float dip=vMapUv.y*2.8+.46*sin(vMapUv.x*.8)+.18*sin(vMapUv.x*2.2);
       float grains=dot(texture2D(map,vMapUv*1.18).rgb,vec3(.28,.62,.1));
       float crack=1.-smoothstep(.025,.12,abs(fract(dip+mineral*.73)-.5));
       float fade=1.-smoothstep(.14,.72,fwidth(dip));
       diffuseColor.rgb*=clamp(.39+3.7*mineral+1.9*grains-.21*crack*fade,.30,1.54);`);};
    return m;
  }
  function waterMaterial(T,fall){
    // Use the normal renderer lighting; moving highlights are visible on the
    // sheets and the downstream pool even when viewed from the riverbank.
    const m=new T.MeshPhongMaterial({vertexColors:true,side:T.DoubleSide,specular:0xc4e1d9,shininess:43});
    const clock={value:0},quiet=matchMedia('(prefers-reduced-motion: reduce)');
    m.onBeforeRender=()=>{clock.value=quiet.matches?0:(performance.now()%600000)*.001;};
    m.customProgramCacheKey=()=>fall?'hydro-falling-water':'hydro-pool-water';
    m.onBeforeCompile=s=>{
      s.uniforms.streamClock=clock;
      s.vertexShader='varying vec2 streamUV;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n streamUV=uv;');
      s.fragmentShader='uniform float streamClock; varying vec2 streamUV;\n'+s.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n'+(fall?
          `float v=streamUV.y+streamClock*2.7;
           float line=streamUV.x*21.+sin(v*.76+streamUV.x)*.9;
           float phase=v*4.2+streamUV.x*1.8+sin(line)*1.7;
           float stripes=sin(line)*(1.-smoothstep(.85,3.,fwidth(line)));
           float streak=cos(phase)*(1.-smoothstep(.85,3.,fwidth(phase)));
           diffuseColor.rgb*=.98+.12*stripes+.14*streak;`:
          `float r=length(streamUV*vec2(1.,.79));
           float ripples=sin(r*6.-streamClock*2.6+sin(streamUV.x*2.+streamClock*.3)*.7);
           float light=pow(max(0.,ripples),6.)*(.35+.65*exp(-r*.12));
           diffuseColor.rgb+=vec3(.12,.15,.13)*light*(1.-smoothstep(.12,.63,fwidth(r)));`));
    };
    return m;
  }
  // Indexed grids retain a shared normal at neighbouring samples. Each stored
  // point can blend between local terrain and a level pool/cave datum. Rebuilds
  // always use the original section, never accumulate the previous deformation.
  function surface(T,group,parts,material){
    const p=[],uv=[],c=[],weight=[],indices=[],colour=new T.Color();
    function grid(nx,ny,sample){
      const first=p.length/3;
      for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
        const [x,y,z,u,v,tint,mix]=sample(i/nx,j/ny);
        p.push(x,y,z);uv.push(u,v);colour.setHex(tint);c.push(colour.r,colour.g,colour.b);
        weight.push(mix);
        if(i&&j){const k=first+j*(nx+1)+i;indices.push(k-nx-2,k-1,k-nx-1,k-1,k,k-nx-1);}
      }
    }
    function finish(){
      if(!indices.length){material.dispose();return;}
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(p,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(indices);
      g.computeVertexNormals();g.computeBoundingSphere();
      const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.castShadow=material.isMeshStandardMaterial;
      group.add(mesh);parts.push({g,ys:Float32Array.from(weight,(_,i)=>p[3*i+1]),weight});
    }
    return {grid,finish};
  }
  function tint(a,b,t){
    const k=clamp(t,0,1);
    return (Math.round((a>>16)*(1-k)+(b>>16)*k)<<16)+
      (Math.round((a>>8&255)*(1-k)+(b>>8&255)*k)<<8)+Math.round((a&255)*(1-k)+(b&255)*k);
  }
  function stone(x,y,z,phase,wet){
    const moss=Math.sin(x*.63+y*.34+phase)*Math.sin(z*.57-y*.49)+.22*Math.sin(x*2.56-y*.83);
    const grain=.5+.5*Math.cos(y*3.5+Math.sin(x*.31+phase)*.48+z*.12);
    return tint(tint(wet?0x666b65:0xaaa799,wet?0x909283:0xc4bca8,grain*.7),wet?0x55635b:0x82906b,Math.max(0,moss));
  }
  function stones(rock,ridges,phase){
    for(const [cx,cz,rx,h,rz] of ridges){
      rock.grid(14,6,(u,v)=>{
        const theta=u*Math.PI*2,lat=v*Math.PI/2;
        const n=1+.093*Math.sin(theta*3+phase)*Math.cos(lat*2)+.047*Math.cos(theta*7+lat);
        const x=cx+rx*n*Math.cos(lat)*Math.cos(theta),z=cz+rz*n*Math.cos(lat)*Math.sin(theta);
        const y=-.15+h*Math.sin(lat)*(1+.12*Math.sin(theta)*Math.cos(lat));
        return [x,y,z,x*.47,(y+z*.36)*.53,stone(x,y,z,phase,true),0];
      });
    }
  }
  function groundFit(group,parts,z,entrance=false){
    group.userData.fitGround=ground=>{
      const datum=ground(0,z);
      for(const {g,ys,weight} of parts){
        const pos=g.attributes.position;
        for(let i=0;i<pos.count;i++){
          const local=ground(pos.getX(i),pos.getZ(i));
          // The underlying terrain remains drivable. Follow an uphill cave
          // floor and emerging streambed where a level section would disappear.
          const base=entrance||ys[i]<.2?Math.max(datum,local):datum;
          pos.setY(i,ys[i]+local+(base-local)*weight[i]);
        }
        pos.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
      }
    };
  }
  function watercourse(profile){
    // Preserve downstream bends present in the sampled mapped line. Samples
    // may coincide when a way begins or ends at the falls.
    const sin=Math.sin(profile.yaw),cos=Math.cos(profile.yaw);
    const trace=profile.trace.map(([east,south])=>[east*cos-south*sin,east*sin+south*cos]);
    if(!trace.length)return ()=>0;
    const cx=trace[2][0],cz=trace[2][1];
    const pts=[];
    for(const [x,z] of trace)if(!pts.length||z-cz>pts.at(-1)[1]+.1)pts.push([x-cx,z-cz]);
    return z=>{
      if(z<pts[0][1])return pts[0][0];
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i];
        if(z>=a[1]&&z<=b[1])return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
      }
      return pts.at(-1)[0];
    };
  }
  function waterfall(T,group,p,seed){
    const parts=[],rock=surface(T,group,parts,rockMaterial(T)),sheets=surface(T,group,parts,waterMaterial(T,true)),
      pool=surface(T,group,parts,waterMaterial(T,false)),w=p.width,h=p.height,centre=watercourse(p);
    const tiers=p.form==='cascade'?3:p.form?1:p.heightSource==='estimate'&&p.grade>.30&&p.grade<.82&&h>4?3:h>2.8&&p.grade<.32?2:1;
    const ledge=clamp(w*.22+h*.13,1,9)*(tiers>1?1.3:1),undercut=p.form==='overhang';
    const dz=ledge/tiers,spread=clamp(w*.31+h*.09,1.8,13),phase=(seed%1597)*.013;
    const lip=x=>clamp(w*.097,.26,1.75)*(Math.sin(x/Math.max(2,w)*11+phase)*.75+Math.cos(x*.86+phase)*.24);
    const xAt=(x,z)=>x+clamp(centre(z),-w*.32,w*.32);
    const toe=ledge-.68*dz,pz=toe+spread*.47;
    function cross(x,back){return x*(1-.14*back)+.02*w*Math.sin(phase+back*2.7);}
    for(let j=0;j<tiers;j++){
      const back=1-j/tiers,z0=dz*j,y0=h*back,y1=h*(back-1/tiers),half=w*(.53+.09*j/tiers);
      function point(u,v,shelf) {
        const x=cross((u-.5)*2*half,back),r=lip(x),z=z0+r+(shelf?-dz*(1-v):dz*.32*v);
        const grain=.12*Math.cos(x*3.4+phase)+.08*Math.sin(z*3.7+x*.17);
        const y=(shelf?y0:y0+(y1-y0)*v)+grain;
        return [xAt(x,z),y,z];
      }
      for(const shelf of [false,true])rock.grid(36,shelf?4:16,(u,v)=>{
        const [x,y,face]=point(u,v,shelf);
        const recess=shelf?0:Math.sin(Math.PI*v)**.71*Math.sin(Math.PI*u)**.7*clamp(w*.22,1,6);
        const z=face-(undercut?recess:0)+(shelf?0:Math.sin(y*2.7+x*.3)*.11);
        const colour=stone(x,y,z,phase,true);
        return [x,y,z,x*.38,(y+z*.47)*.43,undercut?tint(colour,0x454b46,clamp(recess*.23,0,.8)):colour,1];
      });
      const runs=clamp(Math.ceil(w/.54),8,100);
      for(let k=0;k<runs;k++){
        const f=(k+.5)/runs;
        const distribution=Math.sin(f*12+phase)+.53*Math.sin(f*23-phase+j*.2)+.34*Math.cos(f*42+j);
        if(distribution<(p.intermittent?.19:p.form==='dry-season'?-.4:-1.06))continue;
        sheets.grid(1,5,(u,v)=>{
          const [x,y,z]=point((k+u)/runs,v,false),fall=v*v;
          const spreadOut=(k+u-runs*.5)/runs*w*.13*fall;
          return [x+spreadOut,y+.085,z+.14+Math.sin(Math.PI*v)*.21+Math.sin(f*32+phase)*fall*.17,x,y,
            tint(0x809c96,0xeaf1e6,Math.min(1,.09+v*.60+(distribution+1.6)*.19)),1];
        });
        sheets.grid(1,2,(u,v)=>{
          const [x,y,z]=point((k+u)/runs,.52+v*.48,true);
          return [x,y+.08,z,x,z,0x78a6a5,1];
        });
      }
    }
    // Banks feather down to the rendered relief. A short upstream apron
    // joins the waterfall crest without standing like a wall across the valley.
    const backDepth=Math.max(ledge*1.8,w*.25,h*.59);
    rock.grid(26,8,(u,v)=>{
      const x=(u-.5)*1.18*w,z=lip(x)-dz-backDepth*v;
      const y=h*(1-v)**.6+.12*Math.sin(x+phase)*(1-v)-.18*v;
      return [xAt(x,z),y,z,x*.42,z*.41,stone(x,y,z,phase,true),1-v];
    });
    for(const side of [-1,1]){
      const breadth=w*.29+h*.45+2.1;
      function bluff(u,v,cap){
        const x=side*(w*.44+breadth*u);
        const margin=1-clamp((u-.71)/.29,0,1);
        const joint=.5+.5*Math.cos(u*16+phase+side);
        const height=h*(1+.075*Math.sin(u*6+phase+side)+.037*joint)*margin;
        const line=lip(x)+toe*(.69+.28*Math.sin(u*8+phase))+u*w*.075;
        const y=height*(cap?1-v**1.7:1-v),exposure=h*.045+.12;
        const band=Math.cos(y/Math.max(h*.10,.38)+Math.sin(x*.27+phase)*.57);
        const ledgeJoint=(band*.36+joint)*exposure;
        const front=line+v*(h*.10+.6)+ledgeJoint;
        const z=cap?line+ledgeJoint*(1-v)-(backDepth+dz)*v:front;
        const factor=margin*(cap?1-v:1);
        const colour=tint(stone(x,y,z,phase,false),0x5f6258,Math.max(0,-band)*.37);
        return [xAt(x,z),y-.16*(1-factor),z,x*.47,(y+z*.43)*.45,colour,factor];
      }
      rock.grid(24,24,(u,v)=>bluff(u,v,false));
      rock.grid(24,8,(u,v)=>bluff(u,v,true));
    }
    // A shallow elliptical pool abuts the foot of the last fall. Vary the
    // colour and foam by depth, with quiet margins against exposed bedrock.
    pool.grid(54,11,(u,v)=>{
      const a=Math.PI*2*u,x=Math.cos(a)*v*(w*.62+spread*.29),z=pz+Math.sin(a)*v*(spread+.67);
      const y=.10+.016*Math.sin(v*18+phase)*(1-v);
      const foam=clamp(1-Math.abs(z-toe)/Math.max(1,spread*.7),0,1)*(1-v*.65);
      return [xAt(x,z),y,z,x,z-toe,tint(tint(0x396360,0x687f71,v),0xc9dfd7,foam*.85),1];
    });
    const stonesAt=[];
    for(let i=0;i<13;i++){
      const sign=i%2?1:-1,angle=phase+i*2.4,size=.15+spread*(.07+.115*(.5+.5*Math.sin(angle)));
      stonesAt.push([sign*(w*.54+spread*.45*Math.sin(angle)),toe+spread*.6+spread*.81*Math.cos(angle),
        size*1.57,size*.83,size]);
    }
    stones(rock,stonesAt,phase);
    rock.finish();sheets.finish();pool.finish();groundFit(group,parts,pz);
  }
  function cave(T,group,p,seed){
    const parts=[],rock=surface(T,group,parts,rockMaterial(T)),w=p.width,h=p.height,phase=(seed%2377)*.014;
    const wing=Math.max(w*1.72,3.6),depth=clamp(w*1.47+h*.32,2.3,19),asymmetry=Math.sin(phase)*.18;
    function mouth(x){
      const t=x/(w*.5),u=clamp(t,-1,1);
      return Math.abs(t)>=1?0:h*Math.pow(1-u*u,.57+.23*Math.cos(phase))*(1+u*asymmetry+.06*Math.sin(8*u+phase));
    }
    function front(x,v){
      const outer=clamp((wing-Math.abs(x))/(wing*.51),0,1),base=mouth(x);
      const level=(h+Math.min(h*.80,wing*.65))*(.82+.13*Math.cos(x*.8+phase)+.07*Math.sin(x*2.2))*outer;
      const y=base+(level-base)*v-.09*(1-outer);
      const strata=.12*Math.cos(y*4.5+x*.37+phase)+.06*Math.sin(y*9.1-x*.23);
      const z=.22*Math.sin(x*2.6+y*.8+phase)+Math.min(.76,w*.12)*Math.cos(x*.67+y*.29)-v*v*h*.29+strata;
      return [x,y,z];
    }
    rock.grid(54,13,(u,v)=>{
      const [x,y,z]=front((u*2-1)*wing,v);
      const colour=stone(x,y,z,phase,false);
      return [x,y,z,x*.59,(y-z*.39)*.57,p.form==='basalt'?tint(colour,0x474a42,.67):colour,1-clamp((Math.abs(x)-w*.5)/wing,0,1)];
    });
    // Extend the visible opening around a bend. Only the entrance section is
    // illustrated; an entrance tag alone says nothing about a cave's interior.
    rock.grid(32,12,(u,v)=>{
      const x0=(u-.5)*w,[,lipY,z0]=front(x0,0);
      const x=x0*(1-v*.27)+v*v*.35*w*Math.sin(phase),z=z0-v*depth;
      const y=lipY*(1-.18*v)+.08*Math.sin(v*11+u*14+phase)*Math.sin(v*Math.PI);
      return [x,y,z,(x+z*.37)*.61,(z+y*.36)*.54,tint(0x999b8c,0x272f2c,v**.64),1];
    });
    rock.grid(32,4,(u,v)=>{
      const x0=(u-.5)*w,[,y,z]=front(x0,0);
      return [x0*.73+.35*w*Math.sin(phase),y*.82*(1-v),z-depth-.13,
        u*3,v*2,0x252b28,1];
    });
    rock.grid(22,9,(u,v)=>{
      const x0=(u-.5)*w,[,,z0]=front(x0,0),x=x0*(1-v*.27)+v*v*.35*w*Math.sin(phase);
      const z=z0+.46-v*(depth+.55),y=.092+.024*Math.sin(x*3+v*15)*v;
      return [x,y,z,x*.53,z*.53,tint(0x827e69,0x242b26,v**.55),1];
    });
    rock.grid(38,8,(u,v)=>{
      const [x,y,z]=front((u*2-1)*wing,1);
      return [x,(1-v)**.82*y-.23*v,z-v*depth*1.03,x*.53,(z-v*depth)*.57,stone(x,y,z-v*depth,phase,false),1-v];
    });
    const rocks=[];
    for(let i=0;i<11;i++){
      const side=i%2?1:-1,r=.14+(.4+.34*Math.cos(phase+i*3.1))*Math.min(wing*.29,w*.3,1.24);
      rocks.push([side*(w*.57+r+i%3*.31),.45+Math.sin(i*2.4+phase)*.83,r*1.4,r*.84,r]);
    }
    stones(rock,rocks,phase);rock.finish();groundFit(group,parts,0,true);
  }
  for(const [id,p] of Object.entries(profiles)){
    const site=byId.get(id);
    if(!site)continue;
    const isCave=site.kind==='Hang động',seed=Number(id.slice(id.lastIndexOf('-')+1))||1;
    const span=isCave?Math.max(p.width*3.3,8.3):Math.max(10,p.width*2.25+p.height*.44);
    const widthText=p.widthSource==='tag'?' Bề rộng trên bản đồ là '+p.width+' m.':p.widthSource==='published'?' Bề rộng tham khảo khoảng '+p.width+' m.':'';
    const heightText=p.heightSource==='tag'?' Chiều cao được ghi trên bản đồ là '+p.height+' m.':p.heightSource==='published'?' Chiều cao tham khảo khoảng '+p.height+' m.':'';
    const axisText=isCave?(p.evidence==='direction'?'Hướng cửa hang lấy từ ký hiệu bản đồ.':
      p.evidence==='passage'?'Góc nhìn hướng vào đoạn hang có lối ngầm đã lập bản đồ.':'Góc nhìn theo lối đi bộ đã lập bản đồ tới cửa hang.'):
      'Dòng thác đổ theo hướng của '+(p.evidence==='river'?'đoạn sông':'con suối')+' trên bản đồ.';
    const seasonal=p.form==='dry-season'?' Mô hình thể hiện dòng chảy mùa khô.':'';
    (window.VietnamSights??=[]).push({...site,id,catalogId:id,surveyed:true,source:p.reference??(p.way?'https://www.openstreetmap.org/way/'+p.way:site.map),
      photo:reference[id]?.photo??site.photo,width:span,depth:span*.82,solids:[],yaw:p.yaw,
      reserve(x,z,pad=0){
        const across=(isCave?p.width*.62:p.width*.65+1.7)+pad;
        const along=(isCave?1.5:Math.min(19,p.width*.34+p.height*.15+2))+pad;
        return (x/across)**2+(z/along)**2<1;
      },
      viewAngle:p.yaw+(isCave?.14:.28),viewElevation:isCave?.18:.25,viewRadius:Math.max(isCave?7:13,span*.95,p.height*1.95),
      description:axisText+heightText+widthText+seasonal+(isCave?' Hình dáng vách đá ở cửa hang được ước dựng.':' Các bậc đá và dòng nước được ước dựng theo địa hình.'),
      build(T,{group}){
        if(isCave)cave(T,group,p,seed);else waterfall(T,group,p,seed);
        // Feather decorative rock returns into the terrain before the mapped
        // driving approach. Leave the measured opening and cascade untouched.
        const limit=site.approachMeters-6;
        if(limit>100)return;
        for(const mesh of group.children){
          const pos=mesh.geometry.attributes.position;
          let changed=false;
          for(let i=0;i<pos.count;i++){
            const x=pos.getX(i),z=pos.getZ(i),radius=Math.hypot(x,z);
            if(radius<=limit)continue;
            pos.setXYZ(i,x*limit/radius,pos.getY(i),z*limit/radius);
            changed=true;
          }
          if(changed){pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
        }
      }
    });
  }
})();
