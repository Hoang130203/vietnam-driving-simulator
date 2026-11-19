'use strict';
// The baked imagery and elevation share the bounds of Web Mercator z8 tiles
// x=200..206, y=110..122. Heights are metres above sea level.
function createVietnamRelief(T,scene,compact){
  const urls='streetscape/surfaces/vietnam-',imagery=new T.TextureLoader().load(urls+'landcover.webp');
  imagery.colorSpace=T.SRGBColorSpace;
  const datum={value:0},eye={value:new T.Vector2()},anchor={value:new T.Vector2()};
  const mat=new T.MeshLambertMaterial({name:'Vietnam relief',map:imagery,side:T.DoubleSide,color:0xc9d5bc});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.terrainDatum=datum;shader.uniforms.terrainEye=eye;shader.uniforms.terrainAnchor=anchor;
    shader.vertexShader='uniform float terrainDatum;uniform vec2 terrainEye,terrainAnchor;varying float horizonDistance;varying vec2 canopy;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n canopy=terrainAnchor+position.xz; horizonDistance=distance(terrainEye,position.xz); transformed.y=mix(-.45,position.y-terrainDatum,smoothstep(1300.,2200.,horizonDistance));');
    shader.fragmentShader=`varying float horizonDistance;
      varying vec2 canopy;
      float standHash(vec2 i){vec3 p=fract(vec3(i.xyx)*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float standNoise(vec2 x){
        vec2 cell=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        return mix(mix(standHash(cell),standHash(cell+vec2(1,0)),f.x),mix(standHash(cell+vec2(0,1)),standHash(cell+vec2(1,1)),f.x),f.y);
      }\n`+shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n float mottling=(standNoise(canopy*.028)-.5)*.46+(standNoise(canopy*.083)-.5)*.23; diffuseColor.rgb*=1.+mottling*(1.-smoothstep(3500.,11000.,horizonDistance));')
      .replace('#include <fog_fragment>',
      '#ifdef USE_FOG\n gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,.17+.79*(1.-exp(-horizonDistance*.00009)));\n #endif');
  };
  const texels=Float32Array.from({length:256},(_,v)=>3500*(v/255)**1.6);
  // Fixed geographic lattice: shared ridgelines retain exactly the same vertices
  // when the streaming window moves by one cell.
  const geometry=new T.BufferGeometry(),cells=compact?96:128,spacing=compact?400:345,stride=cells+1;
  const count=stride*stride,pos=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
  for(let j=0;j<cells;j++)for(let k=0;k<cells;k++){
    const a=j*stride+k,b=a+stride;indices.push(a,b,a+1,a+1,b,b+1);
  }
  geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(indices);
  const mesh=new T.Mesh(geometry,mat);mesh.name='Vietnam terrain horizon';mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
  let graph=null,originX=0,originZ=0,anchorX=NaN,anchorZ=NaN,pixels=null,width=0,height=0;
  function uvAt(x,z){
    const [lon,lat]=graph.geo(x,z),r=lat*Math.PI/180;
    return [((lon+180)/360*256-200)/7,((1-Math.asinh(Math.tan(r))/Math.PI)*128-110)/13];
  }
  function elevation(u,v){
    const px=Math.max(0,Math.min(width-1,u*width-.5)),py=Math.max(0,Math.min(height-1,v*height-.5));
    const x=Math.floor(px),y=Math.floor(py),right=Math.min(x+1,width-1),down=Math.min(y+1,height-1),fx=px-x,fy=py-y;
    const a=texels[pixels[y*width+x]],b=texels[pixels[y*width+right]],c=texels[pixels[down*width+x]],d=texels[pixels[down*width+right]];
    return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
  }
  const heights=new Image();heights.onload=()=>{
    width=heights.naturalWidth;height=heights.naturalHeight;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(heights,0,0);
    const rgba=ctx.getImageData(0,0,width,height).data;pixels=new Uint8Array(width*height);
    for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4];
    canvas.width=canvas.height=1;heights.onload=null;heights.removeAttribute('src');
  };heights.src=urls+'elevation.png';
  function setOrigin(g,x,z){
    if(graph!==g){graph=g;anchorX=anchorZ=NaN;}
    originX=x;originZ=z;
  }
  function update(x,z){
    if(!graph||!pixels)return;
    const [u,v]=uvAt(x,z);mesh.visible=u>=0&&u<1&&v>=0&&v<1;if(!mesh.visible)return;
    const ax=Math.round(x/spacing)*spacing,az=Math.round(z/spacing)*spacing;
    if(ax!==anchorX||az!==anchorZ){
      anchorX=ax;anchorZ=az;anchor.value.set(ax,az);let i=0;
      for(let j=0;j<=cells;j++)for(let k=0;k<=cells;k++,i++){
        const dx=(k-cells/2)*spacing,dz=(j-cells/2)*spacing;
        const [u,v]=uvAt(ax+dx,az+dz);
        pos.set([dx,elevation(u,v),dz],i*3);uv.set([u,1-v],i*2);
      }
      geometry.attributes.position.needsUpdate=geometry.attributes.uv.needsUpdate=true;geometry.computeVertexNormals();
    }
    mesh.position.set(anchorX-originX,0,anchorZ-originZ);eye.value.set(x-anchorX,z-anchorZ);datum.value=elevation(u,v);
  }
  return {setOrigin,update};
}
