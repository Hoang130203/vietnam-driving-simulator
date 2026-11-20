'use strict';

// Directed OSM edges from the Ba Sao start on QL21 to the lakeside viewing road.
// Negative IDs traverse the edge in reverse. The first and last edges are partial.
const tamChucDrive = {
  id: 'ba-sao-tam-chuc',
  title: 'Ba Sao → Tam Chúc',
  start: [105.815695, 20.550735],
  finish: [105.79650, 20.555945],
  edges: [-3659234,-3659233,-3659232,-3659231,-3659230,-3659229,-3659228,-3659227,
    -3659226,-3659225,-3659224,3707468,3659245,3659246,-796632,3659266,3423547,
    -3707472,3423578,840257,2281253]
};

function guidedLegPoints(graph, edge, from, to) {
  const at = s => graph.sample({edge, s, dir:1});
  const middle = edge.points.filter((_, i) => edge.dist[i] > Math.min(from,to) && edge.dist[i] < Math.max(from,to));
  if (from > to) middle.reverse();
  return [at(from), ...middle, at(to)];
}

// Find a legal return to the last part of the route actually driven. Search only
// the streamed road graph, on edge+direction states to respect turn restrictions.
function findGuidedReturn(graph, cursor, target) {
  const queue = [], best = new Map(), goal = graph.sample(target);
  function offer(c, cost, parent) {
    const arrives = c.edge.id === target.edge.id && (target.s-c.s)*c.dir >= 0;
    const to = arrives ? target.s : c.dir > 0 ? c.edge.length : 0;
    const key = c.edge.id+':'+c.dir+':'+arrives;
    const distance = cost+Math.abs(to-c.s);
    if (distance >= (best.get(key) ?? Infinity)) return;
    best.set(key,distance);
    const p = graph.sample({...c,s:to});
    const estimate = distance+Math.hypot(p.x-goal.x,p.z-goal.z);
    queue.push({c,to,distance,estimate,parent,arrives,key});
  }
  if (cursor.dir > 0 || !cursor.edge.oneway) offer(cursor,0,null);
  if (cursor.dir < 0 || !cursor.edge.oneway) offer({...cursor,dir:-cursor.dir},0,null);
  while (queue.length) {
    queue.sort((a,b)=>b.estimate-a.estimate);
    const step = queue.pop();
    if (step.distance !== best.get(step.key)) continue;
    if (step.arrives) {
      const legs = [];
      for (let p=step;p;p=p.parent) legs.unshift(p);
      return {turnAround:legs[0].c.dir!==cursor.dir,
        points:legs.flatMap(p=>guidedLegPoints(graph,p.c.edge,p.c.s,p.to))};
    }
    for (const option of graph.options(step.c)) offer(option,step.distance,step);
  }
  return null;
}

function createTamChucDrive(graph) {
  let length = 0;
  const endpoint = (edge, coords) => {
    const p = graph.point(...coords);
    return graph.nearest(p.x,p.z,[edge]).s;
  };
  const legs = tamChucDrive.edges.map((id,i,ids)=>{
    const edge = graph.edges.get(Math.abs(id)), dir = Math.sign(id);
    if (!edge) throw Error('Chưa tải đủ đường Ba Sao – Tam Chúc. Hãy thử tải lại.');
    const from = i===0 ? endpoint(edge,tamChucDrive.start) : dir>0 ? 0 : edge.length;
    const to = i===ids.length-1 ? endpoint(edge,tamChucDrive.finish) : dir>0 ? edge.length : 0;
    const leg = {edge,dir,from,to,offset:length};
    length += Math.abs(to-from);
    return leg;
  });
  const points = legs.flatMap(l=>guidedLegPoints(graph,l.edge,l.from,l.to));
  const turns = [];
  for (let i=1;i<legs.length;i++) {
    const prev=legs[i-1], next=legs[i], options=graph.options({...prev,s:prev.to});
    const turn=options.find(o=>o.edge.id===next.edge.id && o.dir===next.dir);
    if (!turn) throw Error('Dữ liệu giao lộ đã thay đổi. Chưa thể mở tuyến Tam Chúc.');
    if (options.length>1 || Math.abs(turn.angle)>.55)
      turns.push({at:next.offset,angle:turn.angle});
  }
  const byId = new Map(legs.map(l=>[l.edge.id,l]));
  let progress=0, anchor={edge:legs[0].edge,dir:legs[0].dir,s:legs[0].from};
  let offRoute=false, wrongWay=false, returnKey='', detour=null;
  return {
    points, length, start:anchor, finish:points.at(-1), timeMs:null,
    get detour(){return detour;},
    get remaining(){return Math.max(0,length-progress);},
    update(cursor, onRoad) {
      if (this.timeMs!==null) return false;
      const leg=byId.get(cursor.edge.id);
      const along=leg ? leg.offset+(cursor.s-leg.from)*leg.dir : Infinity;
      // Only credit continuous travel. Rejoining much farther ahead must lead
      // back to the missed section, even if it happens to be on the same road.
      offRoute=!onRoad || !leg || along>progress+45 || along<progress-65;
      wrongWay=!offRoute && cursor.dir!==leg.dir;
      if (!offRoute) {
        detour=null;returnKey='';
        if (!wrongWay && along>progress) {
          progress=Math.min(length,along);anchor={edge:leg.edge,dir:leg.dir,s:cursor.s};
        }
        return !wrongWay && leg===legs.at(-1) && Math.abs(cursor.s-leg.to)<=12 && progress>=length-12;
      }
      const key=cursor.edge.id+':'+cursor.dir+':'+String(graph.signature);
      if (onRoad && key!==returnKey) {
        returnKey=key;detour=findGuidedReturn(graph,cursor,anchor);
      }
      return false;
    },
    instruction() {
      if (offRoute) return detour ? (detour.turnAround?'↶ Quay đầu khi an toàn':'Lệch tuyến')+' · Theo nét đứt về tuyến' : 'Lệch tuyến · Trở về vệt xanh trên bản đồ';
      if (wrongWay) return '↶ Sai hướng · Quay đầu khi an toàn';
      const turn=turns.find(t=>t.at>progress+3);
      if (turn && turn.at-progress<=160) {
        const label=turn.angle<-.38?'← Rẽ trái':turn.angle>.38?'→ Rẽ phải':'↑ Đi thẳng';
        return label+' sau '+Math.ceil(turn.at-progress)+' m';
      }
      return length-progress<160?'⚑ Điểm ngắm ven hồ phía trước':'↑ Tiếp tục theo vệt xanh';
    }
  };
}
