(() => {
  const law = 'https://vanban.chinhphu.vn/?classid=0&docid=217295&pageid=27160';
  const questions = [
    ['Đèn tín hiệu', 'Đèn đỏ trước mặt, bạn định đi thẳng. Không có hiệu lệnh khác. Bạn làm gì?', ['Dừng trước vạch dừng', 'Đi tiếp nếu đường vắng', 'Dừng giữa vạch qua đường'], 0, 'Chừa trống phần đường dành cho người đi bộ và chờ tín hiệu cho phép.', 11],
    ['Quan sát', 'Đèn vừa xanh nhưng một người đi bộ vẫn đang qua đường. Bạn sẽ làm gì?', ['Bấm còi để họ chạy nhanh', 'Giảm tốc hoặc dừng để nhường đường', 'Lách qua sát phía sau họ'], 1, 'Hãy để người đang đi trên phần đường qua đường hoàn tất việc sang đường.', 11],
    ['Chuyển làn', 'Bạn cần chuyển từ làn ngoài cùng vào làn trong cùng trên đường ba làn. Bạn xử lý thế nào?', ['Cắt ngang hai làn khi xe sau còn xa', 'Bật đèn cảnh báo nguy hiểm rồi chuyển', 'Báo hiệu, quan sát và chuyển từng làn liền kề ở nơi được phép'], 2, 'Kiểm tra khoảng trống phía trước, sau và hai bên cho từng lần chuyển làn.', 13],
    ['Giao lộ', 'Ở ngã tư đồng cấp, không có tín hiệu, biển ưu tiên hay vòng xuyến, một ô tô đến từ bên phải cùng lúc. Ai đi trước?', ['Xe của bạn', 'Ô tô bên phải', 'Xe bấm còi trước'], 1, 'Giảm tốc và nhường xe đến từ phía tay phải tại giao lộ này.', 22],
    ['Vòng xuyến', 'Khi vào nơi giao nhau có biển báo vòng xuyến, bạn phải nhường xe đến từ phía nào?', ['Bên trái', 'Bên phải', 'Phía sau'], 0, 'Quan sát bên trái và chờ khoảng trống an toàn trước khi nhập vòng xuyến.', 22],
    ['Dây an toàn', 'Một người ngồi ghế sau có dây an toàn. Trước khi xe chạy, họ cần làm gì?', ['Chỉ thắt dây khi ra cao tốc', 'Giữ tay vào ghế trước', 'Thắt dây an toàn tại chỗ ngồi'], 2, 'Người ngồi ở vị trí có trang bị dây phải thắt dây khi tham gia giao thông.', 10],
    ['Hiệu lệnh', 'Đèn xanh, nhưng người điều khiển giao thông ra hiệu cho xe bạn dừng. Bạn làm gì?', ['Đi theo đèn xanh', 'Dừng theo hiệu lệnh', 'Đi theo xe phía trước'], 1, 'Hiệu lệnh của người điều khiển giao thông được ưu tiên hơn tín hiệu đèn.', 11],
    ['Đèn tín hiệu', 'Xe còn cách xa vạch dừng khi đèn chuyển sang vàng sáng liên tục. Bạn làm gì?', ['Giảm tốc và dừng trước vạch', 'Tăng tốc qua nút giao', 'Đi tiếp như đèn vàng nhấp nháy'], 0, 'Xe chưa đến vạch phải dừng. Xe đang trên vạch hoặc đã qua vạch khi đèn vàng sáng được đi tiếp.', 11],
    ['Mở cửa xe', 'Bạn vừa đỗ sát lề, một xe máy đang áp sát cửa bên trái. Bạn xử lý thế nào?', ['Hé cửa ngay để báo hiệu', 'Mở cửa thật nhanh', 'Chờ xe máy qua, quan sát lại rồi mở khi an toàn'], 2, 'Quan sát phía trước, phía sau và bên mở cửa để tránh gây nguy hiểm.', 19],
    ['Chuyển hướng', 'Bạn chuẩn bị rẽ phải qua phần đường có người đi bộ đang sang. Bạn làm gì?', ['Báo rẽ rồi tăng ga', 'Giảm tốc, báo rẽ và nhường người đi bộ', 'Dùng còi để xin đi trước'], 1, 'Di chuyển chậm và chỉ rẽ khi đường đi của xe đã an toàn.', 15]
  ];
  const key = 'vn-drive.quiz.v1';
  const all = questions.map((_, id) => id);
  const fresh = (ids) => ({ ids, answers: [], index: 0 });
  let session = fresh(all);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.ids?.length && saved.ids.every(id => all.includes(id)) &&
        Array.isArray(saved.answers) && saved.answers.every(a => [0, 1, 2].includes(a)) &&
        Number.isInteger(saved.index) && saved.index >= 0 && saved.index <= saved.ids.length &&
        saved.answers.length >= saved.index && saved.answers.length <= Math.min(saved.index + 1, saved.ids.length)) session = saved;
  } catch {}

  function draw(dialog) {
    const {ids, index, answers} = session;
    const missed = ids.filter((id, i) => answers[i] !== questions[id][3]);
    let body;
    if (index === ids.length) {
      body = `<h2 id="quiz-title">Hoàn thành lượt ôn</h2><p class="q-score">${ids.length - missed.length} / ${ids.length} câu đúng</p>
        ${missed.length ? '<button class="q-primary" data-action="retry">Ôn lại ' + missed.length + ' câu sai</button>' : ''}
        <button class="q-option" data-action="restart">Luyện lại toàn bộ</button><button class="q-option" data-action="close">Trở về buồng lái</button>`;
    } else {
      const [topic, prompt, choices, correct, explanation, article] = questions[ids[index]];
      const chosen = answers[index];
      body = `<p class="q-count">${topic} · Câu ${index + 1}/${ids.length}</p><progress value="${index + 1}" max="${ids.length}"></progress>
        <h2 id="quiz-title">${prompt}</h2>${choices.map((choice, i) => {
          const result = chosen === undefined ? '' : i === correct ? 'right' : i === chosen ? 'wrong' : '';
          return `<button class="q-option ${result}" data-choice="${i}" ${chosen !== undefined ? 'disabled' : ''}><b>${'ABC'[i]}</b>${choice}</button>`;
        }).join('')}${chosen === undefined ? '' : `<div class="q-feedback" role="status"><strong>${chosen === correct ? 'Chính xác' : 'Đáp án đúng là ' + 'ABC'[correct]}</strong><p>${explanation}</p><a href="${law}" target="_blank" rel="noopener">Điều ${article} · Luật Trật tự, an toàn giao thông đường bộ ↗</a></div>
        <button class="q-primary" data-action="next">${index + 1 === ids.length ? 'Xem kết quả' : 'Câu tiếp theo'} →</button>`}`;
    }
    dialog.innerHTML = `<div class="q-top"><strong>Ôn lý thuyết</strong><button aria-label="Đóng bài ôn" data-action="close">×</button></div>${body}`;
    dialog.onclick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'close') return dialog.close();
      if (action === 'next') session.index++;
      if (action === 'retry') session = fresh(missed);
      if (action === 'restart') session = fresh(all);
      if (button.hasAttribute('data-choice') && answers[index] === undefined) answers.push(Number(button.dataset.choice));
      try { localStorage.setItem(key, JSON.stringify(session)); } catch {}
      draw(dialog);
      dialog.querySelector('.q-primary, .q-option:not(:disabled)')?.focus();
    };
  }
  window.openQuiz = () => {
    const dialog = document.getElementById('quiz');
    dialog.setAttribute('aria-labelledby','quiz-title');
    draw(dialog);
    if (!dialog.open) dialog.showModal();
  };
})();
