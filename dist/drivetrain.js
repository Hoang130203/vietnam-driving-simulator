'use strict';
// The chassis moves in world metres. Navigation may measure its pose, but never supplies a steering angle.
window.DriveBody={
 recordDent(body,hit,speed,heading){
   if(speed<=4)return;
   body.dent={side:-hit.nx*Math.cos(heading)-hit.nz*Math.sin(heading),
     front:-hit.nx*Math.sin(heading)+hit.nz*Math.cos(heading),strength:Math.min(1,speed/22)};
 },
 strikeTraffic(actor,hit,speed,yaw,attackerX,attackerZ,targetX,targetZ){
   if(speed<1.1||actor.recoil?.braking>.25)return;
   const s=Math.sin(yaw),c=Math.cos(yaw),side=-hit.nx*c-hit.nz*s,front=-hit.nx*s+hit.nz*c;
   const dx=attackerX-targetX,dz=attackerZ-targetZ,lever=dx*s-dz*c,lateral=dx*c+dz*s;
   const a=actor.recoil??={x:0,z:0,angle:0,vx:0,vz:0,spin:0,age:0};
   const force=Math.min(actor.bike||actor.kind==='scooter'?17:12,speed*.51);
   a.vx-=hit.nx*force;a.vz-=hit.nz*force;
   a.spin+=Math.max(-2.2,Math.min(2.2,(lever*side-lateral*front)*speed*.055));
   a.age=0;a.side=side;a.front=front;a.force=Math.min(1,speed/22);a.braking=.45+a.force*1.5;
   this.recordDent(actor,{nx:-hit.nx,nz:-hit.nz},speed,yaw);
 },
 advanceRecoil(actor,dt){
   const a=actor.recoil;if(!a)return;
   a.braking=Math.max(0,a.braking-dt);a.age+=dt;
   // Tyres scrub off the initial impulse before the driver recovers the lane.
   for(const [p,v] of [['x','vx'],['z','vz'],['angle','spin']]){
     a[v]+=(a.braking?0:-a[p]*3.2)*dt;a[v]*=Math.exp(-dt*(a.braking?3.8:3.2));a[p]+=a[v]*dt;
   }
   const wave=Math.sin(a.age*12)*Math.exp(-a.age*3.3)*a.force;
   a.roll=a.side*wave*(actor.bike||actor.kind==='scooter'?.65:.21);a.pitch=a.front*wave*.14;
   if(a.age>7)delete actor.recoil;
 },
 reset(c){
   delete c.dent;
   c.vx=0;c.vz=0;c.speed=0;c.steer=0;c.spin=0;c.slip=0;c.pitch=0;c.roll=0;c.boost=false;c.brake=false;c.offroad=false;c.reverseDelay=0;
 },
 settle(c,dt){
   const drag=Math.exp(-dt*8);
   c.vx*=drag;c.vz*=drag;c.spin*=drag;
   c.x+=c.vx*dt;c.z+=c.vz*dt;c.yaw+=c.spin*dt;
   c.speed=c.vx*Math.sin(c.yaw)-c.vz*Math.cos(c.yaw);
 },
 step(c,input,dt){
   if(!(dt>0))return;
   const sx=Math.sin(c.yaw),cz=Math.cos(c.yaw),forward=c.vx*sx-c.vz*cz,side=c.vx*cz+c.vz*sx;
   const grip=c.offroad?4.2:c.model==='rally'?9:7.2;
   c.steer+=(input.steer-c.steer)*(1-Math.exp(-dt*8));
   const limit=input.top+(input.boost?9:0);
   let drive=input.gas?input.power:0;
   if(input.boost&&forward>=-.3)drive+=13;
   c.brake=input.brake||input.reverse&&forward>.35;c.boost=input.boost&&!c.brake&&forward>=-.3;
   c.reverseDelay=input.reverse&&forward<.35?c.reverseDelay+dt:0;
   if(input.reverse&&c.reverseDelay>.28&&!input.gas&&forward>-5)drive=-4.4;
   if(forward>=limit&&drive>0)drive=0;
   const drag=(c.offroad?1.65:.48)+(c.offroad?.013:.0031)*forward*forward+(c.brake?17:0);
   const next=forward+drive*dt-Math.sign(forward)*Math.min(Math.abs(forward),drag*dt);
   const wheel=c.steer*.52/(1+Math.abs(next)*.056);
   const yawRate=Math.max(-1.8,Math.min(1.8,next*Math.tan(wheel)/2.68));
   const settle=1-Math.exp(-dt*5);
   c.pitch+=(Math.max(-.065,Math.min(.045,(next-forward)/dt*.003))-c.pitch)*settle;
   c.roll+=(Math.max(-.072,Math.min(.072,yawRate*next*.004))-c.roll)*settle;
   c.spin*=Math.exp(-dt*3.6);c.yaw+=(yawRate+c.spin)*dt;
   const sin=Math.sin(c.yaw),cos=Math.cos(c.yaw);
   // Tyres gain grip progressively. Hard braking in a turn lets the tail step out.
   const lateral=(side-Math.sin(yawRate*dt)*forward)*Math.exp(-dt*grip*(c.brake?.65:1));
   c.vx=sin*next+cos*lateral;c.vz=-cos*next+sin*lateral;c.speed=next;
   c.x+=c.vx*dt;c.z+=c.vz*dt;
   c.slip=Math.min(1,Math.abs(lateral)*.19+(c.brake?Math.abs(next)*.012:0));
 },
 // Separating-axis contact between two oriented car footprints.
 contact(c,other,halfWidth=.91,halfLength=1.98){
   const dx=c.x-other.x,dz=c.z-other.z;
   if(Math.abs(dx)>5.5||Math.abs(dz)>5.5)return null;
   const side=[Math.cos(c.yaw),Math.sin(c.yaw)],front=[side[1],-side[0]];
   const os=[Math.cos(other.yaw),Math.sin(other.yaw)],of=[os[1],-os[0]];
   const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];let hit;
   for(const a of [side,front,os,of]){
     const center=dx*a[0]+dz*a[1],depth=.91*Math.abs(dot(side,a))+1.98*Math.abs(dot(front,a))+halfWidth*Math.abs(dot(os,a))+halfLength*Math.abs(dot(of,a))-Math.abs(center);
     if(depth<=0)return null;
     if(!hit||depth<hit.depth){const s=center<0?-1:1;hit={nx:a[0]*s,nz:a[1]*s,depth};}
   }
   hit.axle=Math.max(-1.8,Math.min(1.8,-dx*front[0]-dz*front[1]));
   return hit;
 },
 resolve(c,hit,otherVX=0,otherVZ=0,mobile=false){
   const {nx,nz,depth}=hit,closing=Math.max(0,-((c.vx-otherVX)*nx+(c.vz-otherVZ)*nz));
   const right=nx*Math.cos(c.yaw)+nz*Math.sin(c.yaw),ahead=nx*Math.sin(c.yaw)-nz*Math.cos(c.yaw);
   c.x+=nx*(depth+.015);c.z+=nz*(depth+.015);
   const impulse=closing*(mobile?.88:1.18);
   c.vx+=nx*impulse;c.vz+=nz*impulse;
   const lever=hit.axle??0;
   c.spin+=Math.max(-1.4,Math.min(1.4,right*lever*closing*.075));
   c.pitch=Math.max(-.1,Math.min(.09,c.pitch+ahead*closing*.004));
   c.roll=Math.max(-.11,Math.min(.11,c.roll-right*closing*.004));
   c.speed=c.vx*Math.sin(c.yaw)-c.vz*Math.cos(c.yaw);
   return closing;
 }
};
