'use strict';

// Road footprints are capsules. Test the whole proposed beam, including its
// ends, against each nearby carriageway (metres in the same local frame).
function guardrailFits(ax,az,bx,bz,roads,margin,own){
  const dx=bx-ax,dz=bz-az,length2=dx*dx+dz*dz;
  function endDistance2(x,z){
    const t=length2?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length2)):0;
    return (x-ax-dx*t)**2+(z-az-dz*t)**2;
  }
  for(const r of roads){
    if(r===own)continue;
    const au=(ax-r.ax)*r.fx+(az-r.az)*r.fz,av=(az-r.az)*r.fx-(ax-r.ax)*r.fz;
    const bu=au+dx*r.fx+dz*r.fz,bv=av+dz*r.fx-dx*r.fz;
    const limit=(r.w+margin)**2;
    if(av*bv<0){
      const u=au+(bu-au)*av/(av-bv);
      if(u>=0&&u<=r.len)return false;
    }
    const ad=au-Math.max(0,Math.min(r.len,au)),bd=bu-Math.max(0,Math.min(r.len,bu));
    if(ad*ad+av*av<limit||bd*bd+bv*bv<limit||
      endDistance2(r.ax,r.az)<limit||endDistance2(r.bx,r.bz)<limit)return false;
  }
  return true;
}
