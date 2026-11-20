'use strict';
function createSightFinishes(T){
  const damp={value:0},pending=new Map();
  let worker,sequence=0;
  function occlude(g){
    const p=g.attributes.position,n=g.attributes.normal,color=g.attributes.color;
    if(!color||!n||!p||p.count<60||!window.Worker)return;
    if(!worker){
      worker=new Worker('sight-occlusion.js');
      worker.onmessage=({data:{id,light}})=>{
        const target=pending.get(id);pending.delete(id);
        if(!target||target.count!==light.length)return;
        for(let i=0;i<light.length;i++){
          const f=light[i]/255;target.setXYZ(i,target.getX(i)*f,target.getY(i)*f,target.getZ(i)*f);
        }
        target.needsUpdate=true;
      };
      worker.onerror=()=>{pending.clear();worker.terminate();worker=null;};
    }
    const id=++sequence,positions=p.array.slice(),normals=n.array.slice(),indices=g.index?.array.slice();
    pending.set(id,color);g.addEventListener('dispose',()=>pending.delete(id));
    const buffers=[positions.buffer,normals.buffer];if(indices)buffers.push(indices.buffer);
    worker.postMessage({id,positions,normals,indices},buffers);
  }
  function apply(group){
    const brick=['ponagar','thap-doi','thap-vinh-hung','my-son','pho-minh','phuoc-duyen'].includes(group.name);
    const seen=new Set();
    group.traverse(obj=>{
      const m=obj.material,g=obj.geometry;
      if(!m?.isMeshStandardMaterial||m.transparent||m.alphaTest||!g)return;
      if(!seen.has(g)){occlude(g);seen.add(g);}
      if(m.userData.sightFinish)return;
      m.userData.sightFinish=true;
      const previous=m.onBeforeCompile,program=m.customProgramCacheKey();
      m.customProgramCacheKey=()=>program+'-sight-'+brick;
      m.onBeforeCompile=function(shader,renderer){
        previous.call(this,shader,renderer);shader.uniforms.rainOnSight=damp;
        const vary='varying vec3 finishPoint; varying vec3 finishNormal;\n';
        shader.vertexShader=vary+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n finishPoint=position;finishNormal=normal;');
        shader.fragmentShader=vary+`uniform float rainOnSight;
          float stoneHash(vec2 p){vec3 h=fract(p.xyx*.1031);h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);}
          float stoneNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(stoneHash(i),stoneHash(i+vec2(1,0)),f.x),mix(stoneHash(i+vec2(0,1)),stoneHash(i+1.),f.x),f.y);}
        `+shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          vec3 fn=normalize(finishNormal);
          vec2 face=abs(fn.y)>.68?finishPoint.xz:vec2(abs(fn.x)>abs(fn.z)?finishPoint.z:finishPoint.x,finishPoint.y);
          float stain=stoneNoise(face*vec2(.69,.19))*.65+stoneNoise(face*2.9)*.35;
          float wet=rainOnSight*(.25+.64*max(0.,fn.y)+.10*stain);
          diffuseColor.rgb*=1.+(stain-.5)*.18-wet*.23;
          roughnessFactor=mix(roughnessFactor,min(.29,roughnessFactor),wet);
          ${brick?`if(diffuseColor.r>diffuseColor.g*1.38 && abs(fn.y)<.8){
            vec2 course=face/vec2(.31,.095);course.x+=mod(floor(course.y),2.)*.5;
            vec2 edge=min(fract(course),1.-fract(course)),aa=max(fwidth(course),vec2(.005));
            vec2 body=smoothstep(vec2(.026)-aa*.5,vec2(.055)+aa*.5,edge);
            float detail=1.-smoothstep(.24,.91,max(aa.x,aa.y));
            diffuseColor.rgb*=1.+detail*((stoneHash(floor(course))-.5)*.21-(1.-body.x*body.y)*.24);
          }`:''}`);
      };
    });
  }
  return {apply,weather(value){damp.value=value;}};
}
