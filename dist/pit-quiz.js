'use strict';
window.createPitQuiz=function(dialog,onWrong,onReady){
  const $=selector=>dialog.querySelector(selector);
  let deck=[],last;
  function draw(){
    if(!deck.length){
      deck=[...window.driveBank];
      for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
      if(deck.at(-1).id===last)deck.reverse();
    }
    const q=deck.pop();last=q.id;return q;
  }
  $('#repair').onclick=()=>{dialog.close();onReady();};
  dialog.oncancel=e=>e.preventDefault();
  return function show(kind){
    const q=draw(),img=$('#pitImage');
    $('#remark').textContent=kind==='car'?'Cản sau đâu phải nút bấm còi!':kind==='curve'?'Cua trái, cản trước đi thẳng.':kind==='downhill'?'Đổ đèo, đừng đổ phụ tùng!':'Lề đường vừa xin chữ ký.';
    $('#prompt').textContent=q.prompt;img.hidden=!q.image;
    if(q.image){img.src=q.image;img.alt='Hình minh họa câu '+q.id;}else img.removeAttribute('src');
    $('#reply').textContent='Chú Tư đang mở nắp ca-pô. Trả lời câu này để chú ráp xe.';
    const choices=$('#choices');choices.replaceChildren();$('#repair').hidden=true;
    q.choices.forEach((text,i)=>{
      const b=document.createElement('button');b.textContent=text;b.onclick=()=>{
        if(i!==q.correct){b.disabled=true;$('#reply').textContent=onWrong();return;}
        for(const item of choices.children)item.disabled=true;
        $('#reply').textContent='Chuẩn bài! Cản trước đã về với chính chủ.';$('#repair').hidden=false;$('#repair').focus();
      };choices.append(b);
    });dialog.showModal();
  };
};
