'use strict';

// Terrain and route coordinates here are metres in the course frame.
const mountainRails=new Map();
function buildMountainVerges(){
  const loader=new T.TextureLoader(),disturbed=surfaces.scanned('verge',0xc8c4a7,.48);
  disturbed.side=T.DoubleSide;
  const shoulders=[],uv=[],rail=[],railIndices=[];
  const section=[[-.052,.49],[.052,.545],[.068,.595],[-.042,.666],[.067,.728],[.052,.77],[-.049,.811]];
  function shoulder(side){
    let prev=null;
    for(let d=0;d<=route.finish;d+=4){
      if(!route.stage&&d>=bridgeStart-3&&d<=bridgeEnd+3){prev=null;continue;}
      const span=1.15+.24*Math.sin(d*.066+side)+.12*Math.cos(d*.19);
      const points=[roadHalfWidth+.01,roadHalfWidth+.37,roadHalfWidth+.7+span].map((l,i)=>{
        const p=at(d,l*side);
        return [p.x,i===0?p.y-.025:i===1?p.y-.085:renderedGround(p.x,p.z)+.03,p.z];
      });
      if(prev)for(let row=0;row<2;row++){
        for(const v of [prev[row],points[row],prev[row+1],prev[row+1],points[row],points[row+1]]){
          shoulders.push(...v);uv.push(v[0]/2.7,v[2]/2.7);
        }
      }
      prev=points;
    }
  }
  function beam(side){
    const spans=[];
    let run=null;
    for(let d=4;d<route.finish-4;d+=4){
      const p=at(d),far=at(d,side*16),turn=(heading(d+12)-heading(d-12))/24;
      const interrupted=!route.stage&&(Math.abs(d-route.junction)<18||d>bridgeStart-12&&d<bridgeEnd+12);
      if(interrupted){run=null;continue;}
      if(d<48||turn*side>=-.0035&&renderedGround(far.x,far.z)>=p.y-1.45)continue;
      if(!run||d-run.end>16){run={start:d,end:d};spans.push(run);}
      else run.end=d;
    }
    const runs=spans.filter(line=>line.end-line.start>=16);
    mountainRails.set(side,runs);
    for(const {start,end} of runs){
      let prev=-1;
      for(let d=start;d<=end;d+=4){
        const terminal=Math.min(1,(d-start)/4,(end-d)/4);
        const l=side*(roadHalfWidth+1.05+(1-terminal)*.46);
        const p=at(d,l),floor=Math.min(renderedGround(p.x,p.z),p.y-.08);
        const index=rail.length/3;
        for(const [out,h] of section){
          const q=at(d,l+side*out);rail.push(q.x,p.y+h-(1-terminal)*.36,q.z);
        }
        if(prev>=0)for(let k=1;k<section.length;k++)railIndices.push(prev+k-1,index+k-1,prev+k,index+k-1,index+k,prev+k);
        if((d-start)%8===0||d===end){
          const top=p.y+.75-(1-terminal)*.36;
          scatter('box',0x7d8180,p.x,(floor+top)/2,p.z,.11,top-floor,.12,-p.h);
          if(d%24===0&&terminal===1){
            const q=at(d,l-side*.09);
            scatter('box',0xd0aa71,q.x,p.y+.69,q.z,.085,.095,.05,-p.h);
          }
        }
        prev=index;
      }
    }
  }
  for(const side of [-1,1]){shoulder(side);beam(side);}
  function mesh(vertices,indices,coords,mat){
    if(!vertices.length)return;
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    if(indices)geo.setIndex(indices);
    if(coords)geo.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
    geo.computeVertexNormals();
    const obj=new T.Mesh(geo,mat);obj.receiveShadow=true;obj.castShadow=!!indices;scene.add(obj);
  }
  mesh(shoulders,null,uv,disturbed);
  mesh(rail,railIndices,null,new T.MeshStandardMaterial({color:0xb0b3ad,metalness:.54,roughness:.55,side:T.DoubleSide}));
  const fern=loader.load('streetscape/surfaces/bank-fern.webp');fern.colorSpace=T.SRGBColorSpace;
  foliage.undergrowth=new T.MeshLambertMaterial({map:fern,side:T.DoubleSide,alphaTest:.34,color:0xd4d8be,emissive:0x89906c,emissiveMap:fern,emissiveIntensity:.8});
  geom.undergrowth=geom.tree;
  const pine=loader.load('streetscape/surfaces/mountain-pine.webp');pine.colorSpace=T.SRGBColorSpace;
  foliage.pine=new T.MeshLambertMaterial({map:pine,side:T.DoubleSide,alphaTest:.31,
    color:0xf1f2e8,emissive:0x858b7a,emissiveMap:pine,emissiveIntensity:.5});
  geom.pine=geom.tree;
  // Conifers occur in pockets. Retain broadleaf vegetation on low coastal stages.
  const conifers=!route.stage||/o-quy-ho|khanh-le|prenn|mimosa|dran|dai-ninh|sacom|pha-din|khau-pha/.test(route.id);
  const compact=matchMedia('(pointer:coarse)').matches;
  // Scatter irregular stands beyond the verge, with staggered crowns and a low understory.
  for(let d=18;d<route.finish-12;d+=compact?39:28){
    const side=random()<.5?-1:1,centre=at(d,side*(24+random()*97));
    const pineStand=conifers&&random()<.68;
    for(let k=0;k<(compact?9:15);k++){
      const x=centre.x+(random()-.5)*49,z=centre.z+(random()-.5)*46;
      const n=nearest(x,z),y=renderedGround(x,z);
      if(n.dist<12||besideWater(n.d)&&y<waterLevel+.7)continue;
      const kind=pineStand&&random()<.84?'pine':'tree';
      const h=(kind==='pine'?10:6.2)+random()**.8*12,w=h*(kind==='pine'?.5:.56+random()*.38),yaw=random()*Math.PI;
      for(let v=0;v<2;v++)scatter(kind,0xffffff,x,y+h*.49,z,w,h,1,yaw+v*Math.PI/2);
    }
    for(let j=0;j<(compact?3:7);j++){
      const p=at(d+random()*22,side*(9+random()*15)),y=renderedGround(p.x,p.z);
      if(nearest(p.x,p.z).dist<8||besideWater(d)&&y<waterLevel+.6)continue;
      const h=.7+random()*1.05,w=h*(2.05+random()*.34),a=random()*Math.PI;
      for(let k=0;k<2;k++)scatter('undergrowth',0xffffff,p.x,y+h*.47,p.z,w,h,1,a+k*Math.PI/2);
    }
  }
}
