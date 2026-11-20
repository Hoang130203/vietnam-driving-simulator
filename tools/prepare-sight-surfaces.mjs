import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';

// The archive retains the editable source PNGs. Omit only a source page
// whose atlas slot has a complete, matching lossless WebP in the release.
export async function prepareSightSurfaces(client){
  const dir=path.join(client,'sight-landscapes');
  const index=JSON.parse(await readFile(path.join(dir,'index.json'),'utf8'));
  const replace=[];
  for(const [tag,slots] of Object.entries(index)){
    if(!/^N\d{2}E\d{3}$/.test(tag)||!Array.isArray(slots))throw Error('Invalid surface atlas index');
    for(let n=0;n<slots.length;n+=32){
      const stem=path.join(dir,tag+'-'+Math.floor(n/32)),count=Math.min(32,slots.length-n);
      const width=Math.min(8,count)*96,height=Math.ceil(count/8)*96;
      const data=await readFile(stem+'.surface.webp');
      if(data.length<25||data.toString('ascii',0,4)!=='RIFF'||data.readUInt32LE(4)+8!==data.length||
         data.toString('ascii',8,16)!=='WEBPVP8L'||data[20]!==0x2f)
        throw Error('Invalid lossless surface page '+stem);
      const dimensions=data.readUInt32LE(21);
      if((dimensions&0x3fff)+1!==width||((dimensions>>>14)&0x3fff)+1!==height)
        throw Error('Incorrect surface page dimensions '+stem);
      replace.push(stem+'.png');
    }
  }
  for(const original of replace)await rm(original,{force:true});
  return replace.length;
}
