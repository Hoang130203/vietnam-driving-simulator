'use strict';
(window.VietnamSights??=[]).push({
  id:'lung-cu',name:'Cột cờ Lũng Cú',city:'Lũng Cú',lon:105.316333,lat:23.363457,start:[105.31619,23.36254],
  width:19,depth:19,yaw:-.14,map:'https://www.openstreetmap.org/way/504649258',
  photo:'https://tgroup.vn/tours/tour-ha-giang-kham-pha-quan-ba-dong-van-lung-cu-ngoi-thuyen-tren-song-nho-que-chiem-nguong-hem-vuc-tu-san',
  source:'https://worldmatetravel.com/travel-guide/lung-cu-flag-tower-vietnam%E2%80%99s-northernmost-symbol-of-national-pride',
  build(T,{stamp,box,round,tapered,wavingFlag}){
    const grey=0xb0ac9e,slate=0x746f67,bronze=0x8a6751;
    for(let i=0;i<4;i++)tapered(i%2?grey:slate,0,.26+i*.35,0,10.6-i*.48,10.6-i*.48,.36,1,8);
    tapered(slate,0,2.05,0,8.65,8.15,1.5,1,8);
    tapered(bronze,0,4.65,0,8.12,4.89,3.8,1,8);
    tapered(0x84766b,0,7.28,0,4.96,4.3,1.55,1,8);
    tapered(grey,0,14.88,0,3.48,3.25,13.8,1,8);
    for(const [y,r,h] of [[8.05,3.72,.35],[21.89,3.6,.55],[22.45,4.13,.55],[22.88,4.38,.35]])tapered(slate,0,y,0,r,r,h,1,8);
    for(let side=0;side<8;side++){
      const a=(side+.5)*Math.PI/4,s=Math.sin(a),c=Math.cos(a);
      box(0x706f69,s*3.08,14.9,c*3.08,.65,11.83,.15,a);
      const medallion=new T.TorusGeometry(.75,.092,6,24);
      stamp(medallion,0xc6a98b,s*6.52,4.53,c*6.52,1,1,1,a,-.64);medallion.dispose();
      for(let i=-1;i<=1;i++){
        const t=i*1.04;
        box(grey,s*3.96+c*t,23.42,c*3.96-s*t,.12,1.13,.13,a);
      }
      box(slate,s*3.96,23.98,c*3.96,3.3,.13,.13,a);
    }
    stamp(round,0xa7a498,0,28.4,0,.17,11,.17);
    wavingFlag(9,6,.16,33.84,0);
  }
},{
  id:'thap-doi',name:'Tháp Đôi',city:'Quy Nhơn',lon:109.211083,lat:13.786253,start:[109.210773,13.786349],width:24,depth:13,yaw:Math.PI/2,
  map:'https://www.openstreetmap.org/node/1534828632',photo:'https://benthanhtourist.com/tour/du-lich-quy-nhon-ky-co-eo-gio-bao-tang-quang-trung',
  source:'https://dulichquynhon.binhdinh.gov.vn/en/thapdoiquynhon',
  solids:[[-6.3,0,4.35,4.65],[6,0,4.75,5]],
  build(T,{box,outline,tapered,random}){
    function tower(x,w,h,aged){
      const clay=aged?0x9a5c43:0xa65a3c,trim=0x964a31,dark=0x694635;
      for(let j=0;j<4;j++)box(j%2?trim:clay,x,j*.24+.12,0,w+1.2-j*.24,.25,w+1.3-j*.24);
      box(clay,x,h*.335,0,w,h*.59,w);
      for(let face=0;face<4;face++){
        const a=face*Math.PI/2,s=Math.sin(a),c=Math.cos(a);
        for(const t of [-.43,-.33,.33,.43])box(trim,x+c*w*t+s*w*.5,h*.34,-s*w*t+c*w*.5,w*.065,h*.54,.42,a);
        const z=w*.51,door=w*.23,base=1.02,high=h*.32;
        outline([[-door*.83,0],[-door*.83,high*.77],[0,high*1.39],[door*.83,high*.77],[door*.83,0]],trim,x+s*z,base,c*z,.32,a);
        outline([[-door*.54,0],[-door*.54,high*.68],[0,high*1.07],[door*.54,high*.68],[door*.54,0]],face?dark:0x342d28,x+s*(z+.36),base,c*(z+.36),.09,a);
      }
      for(let tier=0;tier<8;tier++){
        const level=h*(.63+tier*.043),size=w*(1.08-tier*.068);
        box(tier%2?clay:trim,x,level,0,size,h*.046,size);
        for(let j=0;j<5;j++){
          const off=(j-2)*size*.18;
          for(const side of [-1,1]){
            box(j%2===0?dark:clay,x+off,level+h*.017,side*size*.5,size*.095,h*.028,.25);
            box(clay,x+side*size*.5,level+h*.009,off,.26,h*.036,size*.11);
          }
        }
        if(tier===0||tier===2)for(const dx of [-1,1])for(const dz of [-1,1]){
          tapered(0x8e8071,x+dx*size*.48,level+.52,dz*size*.48,.5,.14,1.12,1,6);
          for(const wing of [-1,1])box(0x9a8973,x+dx*size*.48+wing*.34,level+.61,dz*size*.49,.68,.16,.35,0,0,wing*.5);
        }
      }
      for(let i=0;i<34;i++){const ox=(random()-.5)*w*.52,oz=(random()-.5)*w*.52;box(i%3?0x836344:0x646437,x+ox,h*.964+random()*.15,oz,.4+random()*.58,.2+random()*.3,.6,random());}
      for(let j=0;j<7;j++)box(trim,x,.09*(7-j),w*.53+j*.32,w*.26,.18*(7-j),.38);
    }
    tower(-6.3,8.7,18,true);tower(6,9.45,20,false);
  }
},{
  id:'tam-quan-rach-gia',name:'Cổng Tam Quan',city:'Rạch Giá',lon:105.091878,lat:9.997803,start:[105.09217,9.99742],width:21.6,depth:3.1,yaw:.645,
  map:'https://www.openstreetmap.org/node/5563291701',photo:'https://mia.vn/cam-nang-du-lich/du-lich-rach-gia-12808',
  source:'https://dulich.petrotimes.vn/cong-lang-tam-quan-doc-dao-nhat-viet-nam-561919.html',
  solids:[[-10.27,0,.46,1.06],[-4.45,0,.60,1.12],[4.45,0,.60,1.12],[10.27,0,.46,1.06]],
  build(T,{box,profile,outline}){
    function span(x,w,spring,rise,depth){
      const half=w*.40,shape=new T.Shape();
      shape.moveTo(-w/2,0);shape.lineTo(-half,0);shape.lineTo(-half,spring);shape.absellipse(0,spring,half,rise,Math.PI,0,true,0);
      shape.lineTo(half,0);shape.lineTo(w/2,0);shape.lineTo(w/2,spring+.35);
      shape.bezierCurveTo(w/2,spring+rise+.92,w*.29,spring+rise+1.6,0,spring+rise+1.6);
      shape.bezierCurveTo(-w*.29,spring+rise+1.6,-w/2,spring+rise+.92,-w/2,spring+.35);shape.closePath();
      profile(shape,0xd89681,x,0,-depth/2,depth);
      for(const side of [-1,1]){
        const trim=new T.Shape(),a=spring,rad=half+.26;
        trim.moveTo(-rad,0);trim.lineTo(-rad,a);trim.absellipse(0,a,rad,rise+.24,Math.PI,0,true,0);
        trim.lineTo(rad,0);trim.lineTo(half,0);trim.lineTo(half,a);
        trim.absellipse(0,a,half,rise,0,Math.PI,false,0);trim.lineTo(-half,0);trim.closePath();
        profile(trim,0xb75e4e,x,0,side*(depth/2+.015),.035);
      }
      const y=spring+rise+1.32;
      for(let tier=0;tier<2;tier++){
        const roof=w*(.80-tier*.13),d=depth+1.15-tier*.35,level=y+tier*.88;
        box(0xd78f75,x,level+.31,0,roof*.84,.66,d*.73);
        for(const side of [-1,1]){
          box(0xab5340,x,level+.58,side*d*.27,roof,.17,d*.56,0,side*.32);
          for(let i=0;i<Math.round(roof*3);i++)box(0xc17a53,x-roof*.49+i*.33,level+.67,side*d*.27,.072,.095,d*.55,0,side*.32);
          for(const end of [-1,1])outline([[0,0],[end*.51,.11],[end*.74,.58],[end*.61,.03],[end*.22,-.12]],0xa55942,x+end*roof*.48,level+.47,side*d*.46,.11);
        }
        box(0x99523d,x,level+.88,0,roof*.94,.15,.24);
      }
    }
    span(0,9.9,2.25,3.55,2.05);span(-7.52,6.05,1.95,2.1,1.65);span(7.52,6.05,1.95,2.1,1.65);
  }
});
