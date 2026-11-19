'use strict';
// Scanned material channels share a UV transform, including after an origin rebase.
function createRoadSurfaces(T,renderer){
  const loader=new T.TextureLoader(),anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  function scanned(name,tint,strength){
    function channel(kind){
      const tex=loader.load('streetscape/surfaces/'+name+'-'+kind+'.webp');
      tex.name=name+' '+kind;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=anisotropy;
      if(kind==='color')tex.colorSpace=T.SRGBColorSpace;
      return tex;
    }
    return new T.MeshStandardMaterial({name:'Scanned '+name,color:tint,map:channel('color'),roughnessMap:channel('rough'),
      normalMap:channel('normal'),normalScale:new T.Vector2(strength,strength),metalness:0,roughness:.94,envMapIntensity:.36});
  }
  function transform(material,repeatX,repeatY,offsetX=0,offsetY=0){
    for(const tex of [material.map,material.normalMap,material.roughnessMap]){
      tex.repeat.set(repeatX,repeatY);tex.offset.set(offsetX,offsetY);
    }
  }
  return {scanned,transform};
}
