'use strict';
// The catalogue keeps stable OSM IDs for saved trips. Bucket its positions so
// moving the render origin examines only nearby destinations.
(()=>{
  const atlas=window.VietnamTourism,grid=32,cells=new Map();
  atlas.byId=new Map(atlas.entries.map(site=>[site.id,site]));
  for(const site of atlas.entries){
    const key=Math.floor(site.lon*grid)+','+Math.floor(site.lat*grid);
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(site);
  }
  atlas.nearby=(lon,lat,dx,dy)=>{
    const found=[];
    for(let i=Math.floor((lon-dx)*grid);i<=Math.floor((lon+dx)*grid);i++)
      for(let j=Math.floor((lat-dy)*grid);j<=Math.floor((lat+dy)*grid);j++)
        for(const s of cells.get(i+','+j)||[])
          if(Math.abs(s.lon-lon)<=dx&&Math.abs(s.lat-lat)<=dy)found.push(s);
    return found;
  };
})();
