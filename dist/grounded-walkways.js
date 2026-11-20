'use strict';
// The tops share the ground triangulation used by the road. The vertical faces
// extend into the bank, including on the downhill side of a raised road.
function createGroundedWalkways(T,{cx,cz,step,height,ground,wet,needsDetail}){
  const tops=[],coping=[],frontages=[],faces=[],cells=new Map();
  const cell=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16);
  function face(ax,az,bx,bz,lift){
    const dx=bx-ax,dz=bz-az,breaks=[0,1];
    for(const [start,delta] of [[cx+ax,dx],[cz+az,dz],[cx+cz+ax+az,dx+dz]]){
      if(Math.abs(delta)<.0001)continue;
      const end=start+delta;
      for(let v=(Math.floor(Math.min(start,end)/step)+1)*step;v<Math.max(start,end);v+=step)breaks.push((v-start)/delta);
    }
    breaks.sort((a,b)=>a-b);
    let x=ax,z=az,h=height(x,z)+lift,low=Math.min(h-.15,ground(x,z)-.20);
    for(let i=1;i<breaks.length;i++){
      if(breaks[i]-breaks[i-1]<.000001)continue;
      const u=ax+dx*breaks[i],v=az+dz*breaks[i],high=height(u,v)+lift,bottom=Math.min(high-.15,ground(u,v)-.20);
      faces.push(x,h,z,u,high,v,u,bottom,v,x,h,z,u,bottom,v,x,low,z);
      x=u;z=v;h=high;low=bottom;
    }
  }
  function ribbon(s,start,end,left,right,target,lift,skipWet){
    // On ordinary dry ground, face() and surface() already split at every
    // terrain triangle. Only a bank or a graded road needs closer samples.
    const x0=s.ax+s.fx*start,z0=s.az+s.fz*start,x1=s.ax+s.fx*end,z1=s.az+s.fz*end;
    const pad=Math.max(Math.abs(left),Math.abs(right));
    const fine=needsDetail(Math.min(x0,x1)-pad,Math.min(z0,z1)-pad,Math.max(x0,x1)+pad,Math.max(z0,z1)+pad);
    const count=Math.ceil((end-start)/(fine?4:32));
    let open=false;
    for(let i=0;i<count;i++){
      const a=start+(end-start)*i/count,b=start+(end-start)*(i+1)/count;
      const x=s.ax+s.fx*a,z=s.az+s.fz*a,u=s.ax+s.fx*b,v=s.az+s.fz*b;
      const ax=x+s.nx*left,az=z+s.nz*left,bx=x+s.nx*right,bz=z+s.nz*right;
      const ex=u+s.nx*left,ez=v+s.nz*left,fx=u+s.nx*right,fz=v+s.nz*right;
      if(skipWet&&wet((ax+fx)/2,(az+fz)/2)){
        if(open)face(ax,az,bx,bz,lift);
        open=false;continue;
      }
      target.push(ax,az,bx,bz,ex,ez,ex,ez,bx,bz,fx,fz);
      const slab={x,z,fx:s.fx,fz:s.fz,nx:s.nx,nz:s.nz,length:b-a,lo:Math.min(left,right),hi:Math.max(left,right),lift};
      for(let col=Math.floor(Math.min(ax,bx,ex,fx)/16);col<=Math.floor(Math.max(ax,bx,ex,fx)/16);col++){
        for(let row=Math.floor(Math.min(az,bz,ez,fz)/16);row<=Math.floor(Math.max(az,bz,ez,fz)/16);row++){
          const key=col+','+row;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(slab);
        }
      }
      face(ax,az,ex,ez,lift);face(fx,fz,bx,bz,lift);
      if(!open)face(bx,bz,ax,az,lift);
      if(i===count-1)face(ex,ez,fx,fz,lift);
      open=true;
    }
  }
  function sidewalk(s,start,end,side,width){
    const edge=side*s.w,seam=edge+side*.16,outer=edge+side*width;
    ribbon(s,start,end,seam,outer,tops,.108,true);
    ribbon(s,start,end,edge,seam,coping,.12,true);
  }
  function porch(s,x,z,width){
    ribbon({...s,ax:x,az:z},-width/2,width/2,-1.35,1.35,frontages,.105,false);
  }
  function build(group,surface,pavers,stone){
    surface(tops,pavers,.108,1);
    surface(coping,stone,.12,1);
    surface(frontages,pavers,.105,1);
    tops.length=coping.length=frontages.length=0;
    if(!faces.length)return;
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(faces,3));geometry.computeVertexNormals();
    faces.length=0;
    const mesh=new T.Mesh(geometry,stone);mesh.name='Curb and pavement edges';mesh.receiveShadow=true;group.add(mesh);
  }
  function liftAt(x,z){
    let lift=0;
    for(const slab of cells.get(cell(x,z))||[]){
      const dx=x-slab.x,dz=z-slab.z,along=dx*slab.fx+dz*slab.fz,across=dx*slab.nx+dz*slab.nz;
      if(along>=0&&along<=slab.length&&across>=slab.lo&&across<=slab.hi)lift=Math.max(lift,slab.lift);
    }
    return lift;
  }
  return {sidewalk,porch,build,liftAt};
}
