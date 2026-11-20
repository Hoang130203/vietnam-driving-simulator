'use strict';

// The fixed four-metre lattice serves both the visible bed and the tyre immersion query.
// Its outer land vertices keep the same height and diagonal as the large terrain mesh.
function buildMappedShore(T, options){
  const {mask,field,size,scale,maskX,maskZ,cx,cz,gx,gz,landWidth,land,landIndex,ground,pools,group,waterMaterial}=options;
  const metres=1/scale,coarse=landWidth/32,steps=coarse/metres;
  const active=new Uint8Array(32*32),count=size*size,dry=new Float32Array(count),ids=new Uint8Array(count);
  const left=gx-cx-landWidth/2,top=gz-cz-landWidth/2;
  for(let j=0,i=0;j<size;j++)for(let k=0;k<size;k++,i++){
    const a=mask[4*i+3]/255;
    dry[i]=a>0?(1-a)*metres:32;ids[i]=mask[4*i];
    if(a<=0)continue;
    const x=maskX+(k+.5)*metres-left,z=maskZ+(j+.5)*metres-top;
    // Include the dry bank outside the silhouette.
    for(let v=Math.max(0,Math.floor((z-10)/coarse));v<=Math.min(31,Math.floor((z+10)/coarse));v++)
      for(let u=Math.max(0,Math.floor((x-10)/coarse));u<=Math.min(31,Math.floor((x+10)/coarse));u++){
        const c=v*32+u;
        if(field[i*4+2]<240)active[c]=1;
        else if(!active[c])active[c]=2;
      }
  }
  function spread(to,from,step){
    const d=dry[from]+step;
    if(d<dry[to]){dry[to]=d;ids[to]=ids[from];}
  }
  for(const dir of [1,-1])for(let k=0;k<count;k++){
    const i=dir===1?k:count-1-k,x=i%size,prev=i-size*dir;
    if(x-dir>=0&&x-dir<size)spread(i,i-dir,metres);
    if(prev>=0&&prev<count){
      spread(i,prev,metres);
      if(x>0)spread(i,prev-1,metres*Math.SQRT2);
      if(x<size-1)spread(i,prev+1,metres*Math.SQRT2);
    }
  }
  const signed=new Float32Array(count);
  for(let i=0;i<count;i++){
    const a=mask[i*4+3]/255;
    signed[i]=a>.98?field[i*4+2]*(24/255)-metres*.5:a<.02?metres*.5-dry[i]:(a-.5)*metres;
  }
  function cell(x,z){return x>=0&&z>=0&&x<size&&z<size?z*size+x:-1;}
  function distance(i){return i<0?-32:signed[i];}
  const heights=new Map(),key=(x,z)=>Math.round((x-left)/metres)+Math.round((z-top)/metres)*1024;
  function node(x,z){
    const index=key(x,z),known=heights.get(index);if(known)return known;
    const col=Math.round((x-maskX)*scale),row=Math.round((z-maskZ)*scale);
    const samples=[cell(col-1,row-1),cell(col,row-1),cell(col-1,row),cell(col,row)];
    let nearest=samples[0],d=0;
    for(const s of samples){d+=distance(s)*.25;if(distance(s)>distance(nearest))nearest=s;}
    const natural=ground(x,z)-.17,id=nearest<0?0:ids[nearest];
    // The DEM records embankments as land. Keep the surface below surrounding roads
    // while a named lake shares a level across its OSM islands and polygon cuts.
    const level=id&&pools[id]!==undefined?Math.min(natural-.12,Math.max(natural-3.2,pools[id])):natural-.42;
    const depth=Math.min(5.6,Math.max(0,d)*.33),dryWidth=Math.min(1,Math.max(0,-d/8));
    const blend=dryWidth*dryWidth*(3-2*dryWidth);
    const bed=d>0?level-depth:level+(natural-level)*blend;
    const n={x,z,bed,level,d,sediment:1-blend};heights.set(index,n);return n;
  }
  const verts=[],uv=[],silt=[],indices=[],remaining=[],water=[],waterIndices=[];
  const waterVertex=(x,y,z)=>{const i=water.length/3;water.push(x,y,z);return i;};
  function waterTriangle(a,b,c,ia,ib,ic){
    if(a.d<=0&&b.d<=0&&c.d<=0)return;
    if(a.d>=0&&b.d>=0&&c.d>=0){waterIndices.push(ia,ib,ic);return;}
    const ring=[],ns=[a,b,c],vs=[ia,ib,ic];
    let p=c;
    for(let i=0;i<3;i++){
      const n=ns[i];
      if((p.d>0)!==(n.d>0)){
        const u=p.d/(p.d-n.d);
        ring.push(waterVertex(p.x+u*(n.x-p.x),p.level+u*(n.level-p.level),p.z+u*(n.z-p.z)));
      }
      if(n.d>0)ring.push(vs[i]);p=n;
    }
    for(let i=2;i<ring.length;i++)waterIndices.push(ring[0],ring[i-1],ring[i]);
  }
  for(let j=0;j<32;j++)for(let i=0;i<32;i++){
    const c=j*32+i;
    if(!active[c]){for(let k=c*6;k<c*6+6;k++)remaining.push(landIndex.array[k]);continue;}
    // Open water has a level surface and a saturated bed profile; shoreline
    // refinement there would produce many duplicate triangles on coastal maps.
    const divisions=active[c]===2?2:steps,spacing=coarse/divisions;
    const first=verts.length/3,ns=[],ws=[];
    for(let v=0;v<=divisions;v++)for(let u=0;u<=divisions;u++){
      const x=left+i*coarse+u*spacing,z=top+j*coarse+v*spacing,n=node(x,z);ns.push(n);
      const px=x+cx-gx,pz=z+cz-gz;
      verts.push(px,-pz,n.bed+.17);uv.push(px/landWidth+.5,.5-pz/landWidth);silt.push(n.sediment);
      ws.push(n.d>=0?waterVertex(x,n.level,z):-1);
      if(!v||!u)continue;
      const d=v*(divisions+1)+u,a=d-divisions-2,b=d-divisions-1,k=d-1;
      indices.push(first+a,first+k,first+b,first+k,first+d,first+b);
      waterTriangle(ns[a],ns[k],ns[b],ws[a],ws[k],ws[b]);waterTriangle(ns[k],ns[d],ns[b],ws[k],ws[d],ws[b]);
    }
  }
  land.geometry.setIndex(remaining);
  const patch=new T.BufferGeometry();
  patch.setAttribute('position',new T.Float32BufferAttribute(verts,3));patch.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  patch.setAttribute('shoreSediment',new T.Float32BufferAttribute(silt,1));patch.setIndex(indices);patch.computeVertexNormals();
  const bank=new T.Mesh(patch,land.material);bank.name='Mapped banks and bed';bank.receiveShadow=true;land.add(bank);
  // The shared materials are picked for the current biome by the main renderer.
  bank.onBeforeRender=()=>{bank.material=land.material;};
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(water,3));g.setIndex(waterIndices);g.computeVertexNormals();
  const surface=new T.Mesh(g,waterMaterial);surface.name='Mapped water';surface.receiveShadow=true;group.add(surface);
  function sample(x,z,includeBank=false){
    const tx=Math.floor((x-left)/coarse),tz=Math.floor((z-top)/coarse);
    if(tx<0||tx>=32||tz<0||tz>=32||!active[tz*32+tx])return null;
    const stride=active[tz*32+tx]===2?steps/2:1,u=(x-left)/(metres*stride),v=(z-top)/(metres*stride);
    const i=Math.floor(u),j=Math.floor(v),f=u-i,h=v-j,k=(i+j*1024)*stride;
    const a=heights.get(k),b=heights.get(k+stride),c=heights.get(k+stride*1024),d=heights.get(k+stride*1025);
    if(!a||!b||!c||!d)return null;
    const height=k=>f+h<=1?a[k]+f*(b[k]-a[k])+h*(c[k]-a[k]):d[k]+(1-f)*(c[k]-d[k])+(1-h)*(b[k]-d[k]);
    if(!includeBank&&height('d')<=0)return null;
    return {level:height('level'),bed:height('bed')};
  }
  return {sample,dispose(){land.remove(bank);patch.dispose();land.geometry.setIndex(landIndex);}};
}
