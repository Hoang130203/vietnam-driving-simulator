'use strict';
// Player cars in Xuyên Việt. Dimensions are in metres and speeds in m/s.
const worldGarage={
  supercar:{asset:'streetscape/race-car.glb',length:4.6,paint:0xc63322,power:8.4,top:48},
  gt:{asset:'streetscape/gt-coupe.glb',length:4.65,paint:0xb7b4a5,power:6.4,top:43},
  rally:{asset:'streetscape/rally-car.glb',length:4.25,paint:0x246397,power:7.7,top:40},
  'family-sedan':{
    worldOnly:true,asset:'streetscape/sedan.json.gz',length:4.58,width:1.80,height:1.45,paint:0x7194a7,
    power:4.8,top:36,braking:11.5,wheelbase:2.67,steerLock:.57,mass:1410,seatLift:.14
  },
  suv:{
    worldOnly:true,asset:'streetscape/family-suv.glb',length:4.98,width:1.93,height:1.78,paint:0x416d62,
    power:4.3,top:34,braking:10.2,wheelbase:2.96,steerLock:.50,mass:2020,seatLift:.44
  }
};

function tripVehicleChoice(vehicle){
  let previousVehicle=null;
  try{
    previousVehicle=localStorage.getItem('taylai.world.lastDriven');
    localStorage.setItem('taylai.world.lastDriven',vehicle);
  }catch{}
  return {vehicle,previousVehicle};
}
