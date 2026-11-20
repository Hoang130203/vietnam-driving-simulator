'use strict';

// XY stores surface current in map coordinates, Z stores distance from the bank.
window.createDrivingWater = function(T, mapped) {
  const time = {value: 0}, origin = {value: new T.Vector2()};
  const field = {value: null}, bounds = {value: new T.Vector3()};
  const mirrorMap={value:null},mirrorMatrix={value:new T.Matrix4()},mirrorStrength={value:0};
  const reflected=new T.PerspectiveCamera(),direction=new T.Vector3(),up=new T.Vector3();
  const plane=new T.Plane(),clip=new T.Vector4(),corner=new T.Vector4();
  const mobile=matchMedia('(pointer:coarse)').matches;
  let target=null,lastReflection=-Infinity;
  const material = new T.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .17, metalness: 0, ior: 1.333,
    envMapIntensity: 1.25, side: T.DoubleSide
  });
  material.customProgramCacheKey = () => 'inland-water-' + mapped;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {waterTime: time, waterOrigin: origin, bankField: field, bankBounds: bounds, mirrorMap, mirrorMatrix, mirrorStrength});
    const varying = 'varying vec4 mirrorUV; varying vec2 waterMetres; varying vec2 localWater; varying vec3 waterProfile;\n';
    shader.vertexShader = varying + 'uniform vec2 waterOrigin; uniform mat4 mirrorMatrix;\n' +
      (mapped ? '' : 'attribute vec3 riverProfile;\n') + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmirrorUV=mirrorMatrix*modelMatrix*vec4(position,1.0); localWater=position.xz; waterMetres=localWater+waterOrigin; waterProfile=' +
      (mapped ? 'vec3(0.0);' : 'riverProfile;'));
    shader.fragmentShader = varying + `
      uniform sampler2D mirrorMap; uniform float mirrorStrength; uniform float waterTime;
      uniform sampler2D bankField;
      uniform vec3 bankBounds;
      // Suppress wavelengths smaller than a screen pixel at low viewing angles.
      float band(vec2 p, vec2 k, float phase) {
        float a=dot(p,k);
        return cos(a+phase)*(1.0-smoothstep(.45,2.7,fwidth(a)));
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 profile=waterProfile;
      ` + (mapped ? `vec4 atlas=texture2D(bankField,(localWater-bankBounds.xy)*bankBounds.z);
      profile=vec3(atlas.rg*2.0-1.0,atlas.b*24.0);` : '') + `
      float flow=clamp(length(profile.xy),0.0,1.0);
      vec2 drift=profile.xy+vec2(.12,.065);
      vec2 p=waterMetres-drift*waterTime;
      float bend=sin(dot(p,vec2(.19,.14)))*1.6+sin(dot(p,vec2(-.37,.23)))*.64;
      vec2 crosswind=normalize(mix(vec2(.84,.54),drift/max(length(drift),.01),flow));
      vec2 across=vec2(-crosswind.y,crosswind.x);
      vec2 channel=vec2(dot(p,crosswind),dot(p,across));
      vec2 slope=crosswind*(.062*band(channel,vec2(2.3,.64),bend-waterTime*.9)
                             +.037*band(channel,vec2(7.9,-1.65),bend*1.6-waterTime*1.45))
                +across*(.044*band(channel,vec2(.72,3.7),-bend-waterTime*.54)
                         +.027*band(channel,vec2(2.72,12.1),bend*.64+waterTime));
      float depth=max(profile.z,0.0);
      float shallows=exp(-depth*.55);
      vec3 deep=mix(vec3(.023,.077,.074),vec3(.070,.090,.055),smoothstep(.15,.7,flow));
      deep=mix(deep,vec3(.023,.09,.083),smoothstep(.72,1.0,flow));
      float bed=.5+.25*band(waterMetres,vec2(2.1,1.15),bend*.18)+.25*band(waterMetres,vec2(-3.7,4.2),.4);
      diffuseColor.rgb=mix(deep,vec3(.12,.14,.096)*(.68+.55*bed),shallows);
      float crest=band(channel,vec2(4.2,.72),bend-waterTime*.77);
      float broken=smoothstep(.38,.85,sin(channel.y*1.8+bend)*sin(channel.x*.53-bend));
      diffuseColor.rgb+=vec3(.19,.24,.22)*smoothstep(.76,.98,crest)*broken
                      *smoothstep(.25,.85,flow)*(.25+.75*shallows);
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      normal=normalize(mat3(viewMatrix)*vec3(-slope.x,1.0,-slope.y));
    `).replace('#include <opaque_fragment>', `
      vec2 reflectionUV=mirrorUV.xy/max(.001,mirrorUV.w)*.5+.5;
      reflectionUV+=slope*.026;
      float edge=min(min(reflectionUV.x,reflectionUV.y),min(1.0-reflectionUV.x,1.0-reflectionUV.y));
      float fresnel=.021+.979*pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),5.0);
      float blend=mirrorStrength*smoothstep(0.0,.045,edge)*step(.01,mirrorUV.w)*fresnel;
      outgoingLight=mix(outgoingLight,texture2D(mirrorMap,clamp(reflectionUV,0.0,1.0)).rgb,blend);
      #include <opaque_fragment>
    `);
  };
  function setField(pixels,size,x,z,scale,cx,cz) {
    if(!field.value){
      field.value=new T.DataTexture(pixels,size,size);
      field.value.minFilter=field.value.magFilter=T.LinearFilter;
    }else field.value.image.data=pixels;
    field.value.needsUpdate=true;
    bounds.value.set(x,z,scale/size);
    origin.value.set(cx,cz);lastReflection=-Infinity;
  }
  function reflect(renderer,scene,camera,level,now,near){
    if(!near||camera.position.y<=level){mirrorStrength.value=0;lastReflection=-Infinity;return;}
    if(now-lastReflection<(mobile?260:130))return;
    lastReflection=now;
    if(!target){
      target=new T.WebGLRenderTarget(mobile?256:480,mobile?144:270);
      mirrorMap.value=target.texture;
    }
    camera.updateMatrixWorld();
    camera.getWorldDirection(direction);direction.y*=-1;
    up.set(0,1,0).applyQuaternion(camera.quaternion);up.y*=-1;
    reflected.position.copy(camera.position);reflected.position.y=2*level-camera.position.y;
    reflected.up.copy(up);reflected.lookAt(direction.add(reflected.position));
    reflected.updateMatrixWorld();reflected.projectionMatrix.copy(camera.projectionMatrix);
    // Oblique near plane keeps the ground beneath the water out of the reflection.
    plane.normal.set(0,1,0);plane.constant=-level-.015;plane.applyMatrix4(reflected.matrixWorldInverse);
    clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const m=reflected.projectionMatrix.elements;
    corner.set((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
    clip.multiplyScalar(2/clip.dot(corner));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1;m[14]=clip.w;
    reflected.projectionMatrixInverse.copy(reflected.projectionMatrix).invert();
    mirrorMatrix.value.multiplyMatrices(reflected.projectionMatrix,reflected.matrixWorldInverse);
    const previous=renderer.getRenderTarget(),shadow=renderer.shadowMap.needsUpdate;
    material.visible=false;renderer.shadowMap.needsUpdate=false;
    try{renderer.setRenderTarget(target);renderer.render(scene,reflected);}
    finally{renderer.setRenderTarget(previous);material.visible=true;renderer.shadowMap.needsUpdate=shadow;}
    mirrorStrength.value=1;
  }
  return {material,setField,reflect,update(seconds){time.value=seconds;}};
};

// Two chamfer passes estimate the distance to the dry bank on the merged mask.
// Shared polygon cuts, map tile seams and islands therefore need no special edges.
window.waterBankField = function(mask,current,size,metres) {
  const depth=new Float32Array(size*size),out=new Uint8Array(size*size*4);
  for(let i=0;i<depth.length;i++)depth[i]=mask[i*4+3]/255;
  for(let i=0;i<depth.length;i++)depth[i]=depth[i]>=.98?24:depth[i]*metres*.5;
  for(const step of [1,-1]){
    for(let n=0;n<depth.length;n++){
      const i=step===1?n:depth.length-1-n,x=i%size,j=i-size*step;
      if(x-step>=0&&x-step<size)depth[i]=Math.min(depth[i],depth[i-step]+metres);
      if(j<0||j>=depth.length)continue;
      depth[i]=Math.min(depth[i],depth[j]+metres);
      for(const dx of [-1,1])if(x+dx>=0&&x+dx<size)depth[i]=Math.min(depth[i],depth[j+dx]+1.414*metres);
    }
  }
  for(let i=0;i<depth.length;i++){
    const j=i*4,a=current[j+3]/255;
    out[j]=128+(current[j]-128)*a;out[j+1]=128+(current[j+1]-128)*a;
    out[j+2]=Math.round(depth[i]*255/24);out[j+3]=255;
  }
  return out;
};
