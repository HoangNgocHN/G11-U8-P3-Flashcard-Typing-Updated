// ══════════════════════════════════
//TODO  DATA 
// ══════════════════════════════════
const allCards = [


  // NOUNS



  { cat: "Nouns", type: "Noun", word: "to-do list", phonetic: "/təˈduː lɪst/" },
  { cat: "Nouns", type: "Noun", word: "time management", phonetic: "/taɪm ˈmænɪdʒmənt/" },
  { cat: "Nouns", type: "Noun", word: "tools", phonetic: "/tuːlz/" },
  { cat: "Nouns", type: "Noun", word: "apps", phonetic: "/æps/" },
  { cat: "Nouns", type: "Noun", word: "diaries", phonetic: "/ˈdaɪəriːz/" },
  { cat: "Nouns", type: "Noun", word: "task", phonetic: "/tɑːsk/" },
  { cat: "Nouns", type: "Noun", word: "brain development", phonetic: "/breɪn dɪˈveləpmənt/" },
  { cat: "Nouns", type: "Noun", word: "decision", phonetic: "/dɪˈsɪʒən/" },



  // VERBS


  { cat: "Verbs", type: "Verb", word: "get into the habit of", phonetic: "" },
  { cat: "Verbs", type: "Verb", word: "make use of", phonetic: "/meɪk juːs əv/" },
  { cat: "Verbs", type: "Verb", word: "decide", phonetic: "/dɪˈsaɪd/" },
  { cat: "Verbs", type: "Verb", word: "make sure", phonetic: "/meɪk ʃɔː/" },
  { cat: "Verbs", type: "Verb", word: "complete", phonetic: "/kəmˈpliːt/" },
  { cat: "Verbs", type: "Verb", word: "schedule", phonetic: "/ˈʃedjuːl/" },
  { cat: "Verbs", type: "Verb", word: "relax", phonetic: "/rɪˈlæks/" },
  { cat: "Verbs", type: "Verb", word: "spend", phonetic: "/spend/" },


  // ADJECTIVES



  { cat: "Adjectives", type: "Adjective", word: "challenging", phonetic: "/ˈtʃælɪndʒɪŋ/" },
  { cat: "Adjectives", type: "Adjective", word: "useful", phonetic: "/ˈjuːsfl/" },


  // ADVERBS




];

const CATS = ["All", "Nouns", "Verbs", "Adjectives", "Adverbs"];

// ══════════════════════════════════
//  STATE
// ══════════════════════════════════
let S = {
  cat: "All", mode: "hard",
  deck: [], idx: 0,
  checked: false, result: null,   // result: 'correct'|'hint-correct'|'wrong'
  known: 0, again: 0, againList: [], done: false, reviewMode: false,
  // Hints
  hints: 0,
  revealed: new Set(),            // Set<number> — flat char indices (spaces excluded)
  // Easy mode
  easyTiles: [],                  // [{char, id, used, isHint}]
  easyAnswer: [],                 // [{char, tileId, isHint} | null]
  // XP & Streak
  xp: 0, streak: 0,
};

// ══════════════════════════════════
//  UTILITY: flat char index helpers
// ══════════════════════════════════

/** Build array of non-space chars with their index in the ORIGINAL string (including spaces).
 *  e.g. "a tour" → [{char:'a', origIdx:0}, {char:'t', origIdx:2}, ...] */
function getFlatChars(word) {
  return word.split('').reduce((acc, c, i) => {
    if (c !== ' ') acc.push({ char: c, origIdx: i });
    return acc;
  }, []);
}

/** Split word into word-groups: "a virtual tour" → [['a'],['v','i','r','t','u','a','l'],['t','o','u','r']]
 *  Also tracks each char's origIdx (index in full string). */
function getWordGroups(word) {
  let idx = 0;
  return word.split(' ').map(w => {
    const chars = w.split('').map(c => ({ char: c, origIdx: idx++ }));
    idx++; // skip space
    return chars;
  });
}

function norm(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s\-]/g, '').replace(/\s+/g, ' ');
}

// ══════════════════════════════════
//  CARD INIT PER MODE
// ══════════════════════════════════
function initCard() {
  const card = S.deck[S.idx];
  if (!card) return;
  S.hints = 0;
  S.checked = false;
  S.result = null;

  if (S.mode === 'medium') {
    // Pre-reveal: localIdx % 2 === 0 within each word (first + every other)
    S.revealed = new Set();
    let globalIdx = 0;
    card.word.split(' ').forEach((w, wi) => {
      if (wi > 0) globalIdx++; // skip space char
      w.split('').forEach((c, localIdx) => {
        if (localIdx % 2 === 0) S.revealed.add(globalIdx);
        globalIdx++;
      });
    });
  } else if (S.mode === 'easy') {
    S.revealed = new Set();
    initEasyMode(card.word);
  } else {
    S.revealed = new Set();
  }
}

function initEasyMode(word) {
  // Build tiles from all non-space chars, shuffle them
  const flat = getFlatChars(word);
  const shuffled = [...flat].sort(() => Math.random() - .5);
  S.easyTiles = shuffled.map(t => ({ char: t.char, id: t.origIdx, used: false, isHint: false }));
  S.easyAnswer = new Array(flat.length).fill(null);
}

// ══════════════════════════════════
//  DECK / INIT
// ══════════════════════════════════
function getDeck(cat) {
  const base = cat === "All" ? allCards : allCards.filter(c => c.cat === cat);
  return [...base].sort(() => Math.random() - .5);
}

function init(cat, review) {
  const deck = review ? [...S.againList].sort(() => Math.random() - .5) : getDeck(cat);
  const { mode, xp, streak } = S;
  S = {
    cat, mode, deck, idx: 0,
    checked: false, result: null,
    known: 0, again: 0, againList: [], done: false, reviewMode: !!review,
    hints: 0, revealed: new Set(),
    easyTiles: [], easyAnswer: [],
    xp, streak,
  };
  initCard();
  fullRender();
}

function setMode(mode) {
  if (S.mode === mode) return;
  S.mode = mode;
  initCard();
  cardRender();
}

// ══════════════════════════════════
//  TTS
// ══════════════════════════════════
let curUtter = null;

function speak(text, btnId, slow) {
  if (!window.speechSynthesis) return;
  if (curUtter && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.speak-btn, .speak-slow-btn').forEach(b => b.classList.remove('speaking'));
    if (curUtter._key === text + slow) { curUtter = null; return; }
  }
  const clean = text.replace(/<[^>]+>/g, '').replace(/\(.*?\)/g, '').trim();
  const u = new SpeechSynthesisUtterance(clean);
  u._key = text + slow;
  u.lang = 'en-GB';
  u.rate = slow ? 0.58 : 0.88;
  u.pitch = 1;
  const vs = window.speechSynthesis.getVoices();
  const v = vs.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
    || vs.find(v => v.lang === 'en-GB')
    || vs.find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  const btn = document.getElementById(btnId);
  u.onstart = () => { if (btn) btn.classList.add('speaking'); };
  u.onend = u.onerror = () => {
    document.querySelectorAll('.speak-btn, .speak-slow-btn').forEach(b => b.classList.remove('speaking'));
    curUtter = null;
  };
  curUtter = u;
  window.speechSynthesis.speak(u);
}

function speakWord(slow) {
  const c = S.deck[S.idx];
  if (c) speak(c.word, slow ? 'speakSlow' : 'speakFront', !!slow);
}

// ══════════════════════════════════
//  HINT
// ══════════════════════════════════
function useHint() {
  if (S.checked) return;
  const card = S.deck[S.idx];

  if (S.mode === 'easy') {
    const emptySlot = S.easyAnswer.indexOf(null);
    if (emptySlot === -1) return;
    const flat = getFlatChars(card.word);
    const correctChar = flat[emptySlot].char;
    const tile = S.easyTiles.find(t => !t.used && t.char === correctChar);
    if (!tile) return;
    tile.used = true;
    tile.isHint = true;
    S.easyAnswer[emptySlot] = { char: tile.char, tileId: tile.id, isHint: true };
    S.hints++;
  } else {
    // Reveal a random unrevealed non-space char (by origIdx)
    const flat = getFlatChars(card.word);
    const unrevealed = flat.filter(f => !S.revealed.has(f.origIdx));
    if (unrevealed.length <= 1) return; // keep at least 1 unknown
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    S.revealed.add(pick.origIdx);
    S.hints++;
  }
  cardRender();
}

// ══════════════════════════════════
//  CHECK
// ══════════════════════════════════
function checkTyped() {
  if (S.checked) return;
  if (S.mode === 'easy') { checkEasy(); return; }

  const inp = document.getElementById('typeInput');
  if (!inp || !inp.value.trim()) { speakWord(false); return; }

  const card = S.deck[S.idx];
  const ok = norm(inp.value) === norm(card.word);
  S.checked = true;
  S.result = ok ? (S.hints > 0 ? 'hint-correct' : 'correct') : 'wrong';

  inp.disabled = true;
  inp.classList.add(ok ? 'correct' : 'wrong');

  // Reveal all blanks
  getFlatChars(card.word).forEach(f => S.revealed.add(f.origIdx));

  document.getElementById('rateKnow').disabled = false;
  document.getElementById('rateAgain').disabled = false;

  // Update blanks + feedback without full re-render
  const blanksEl = document.getElementById('blanksDisplay');
  if (blanksEl) blanksEl.innerHTML = renderBlanks(card.word);
  const fb = document.getElementById('typeFeedback');
  if (fb) {
    if (ok) {
      fb.className = 'type-feedback ok';
      fb.innerHTML = S.hints > 0
        ? `✓ Correct! <span class="hint-note">(${S.hints} hint${S.hints > 1 ? 's' : ''} used)</span>`
        : '✓ Correct! 🌟';
    } else {
      fb.className = 'type-feedback bad';
      fb.textContent = '✗  Answer: ' + card.word;
    }
  }
  const hintRow = document.getElementById('hintRow');
  if (hintRow) hintRow.innerHTML = '';
}

function checkEasy() {
  const card = S.deck[S.idx];
  const flat = getFlatChars(card.word);
  const answered = S.easyAnswer.map(s => s?.char || '');
  const ok = answered.join('') === flat.map(f => f.char).join('');
  S.checked = true;
  S.result = ok ? (S.hints > 0 ? 'hint-correct' : 'correct') : 'wrong';
  // Reveal all
  flat.forEach(f => S.revealed.add(f.origIdx));
  document.getElementById('rateKnow').disabled = false;
  document.getElementById('rateAgain').disabled = false;
  cardRender();
}

// ══════════════════════════════════
//  EASY MODE INTERACTIONS
// ══════════════════════════════════
function easyClickTile(id) {
  if (S.checked) return;
  const tile = S.easyTiles.find(t => t.id === id && !t.used);
  if (!tile) return;
  const emptyIdx = S.easyAnswer.indexOf(null);
  if (emptyIdx === -1) return;
  tile.used = true;
  S.easyAnswer[emptyIdx] = { char: tile.char, tileId: id, isHint: false };
  cardRender();
}

function easyClickSlot(slotIdx) {
  if (S.checked) return;
  const slot = S.easyAnswer[slotIdx];
  if (!slot || slot.isHint) return;
  const tile = S.easyTiles.find(t => t.id === slot.tileId);
  if (tile) tile.used = false;
  S.easyAnswer[slotIdx] = null;
  cardRender();
}

// ══════════════════════════════════
//  RATE / NAV
// ══════════════════════════════════
function rate(knew) {
  if (!S.checked) return;
  if (knew) {
    S.known++;
    if (S.hints === 0) {
      S.streak++;
      S.xp += 10 + Math.min(S.streak - 1, 4) * 2; // bonus for streak
    } else {
      S.streak = 0;
      S.xp += 5; // partial XP for hint-correct
    }
  } else {
    S.again++;
    S.againList.push(S.deck[S.idx]);
    S.streak = 0;
  }
  S.idx++;
  if (S.idx >= S.deck.length) { S.done = true; fullRender(); return; }
  initCard();
  cardRender();
  updateStats();
}

function prev() {
  if (S.idx <= 0) return;
  S.idx--;
  initCard();
  cardRender();
  updateStats();
}

function next() {
  if (S.idx >= S.deck.length - 1) return;
  S.idx++;
  initCard();
  cardRender();
  updateStats();
}

// ══════════════════════════════════
//  RENDER: BLANKS
// ══════════════════════════════════
function renderBlanks(word) {
  const groups = getWordGroups(word);
  let html = '<div class="blanks-display">';
  groups.forEach((group, gi) => {
    if (gi > 0) html += '<span class="blank-word-sep">·</span>';
    html += '<span class="blank-word-group">';
    group.forEach(({ char, origIdx }) => {
      const shown = S.revealed.has(origIdx);
      html += `<span class="blank-cell${shown ? ' revealed' : ''}">${shown ? char : '_'}</span>`;
    });
    html += '</span>';
  });
  html += '</div>';
  return html;
}

// ══════════════════════════════════
//  RENDER: EASY MODE
// ══════════════════════════════════
function renderEasyMode(card) {
  const flat = getFlatChars(card.word);
  const groups = getWordGroups(card.word);

  // ── Slots (answer area) ──
  let slotHTML = '<div class="easy-slots">';
  let flatIdx = 0;
  groups.forEach((group, gi) => {
    if (gi > 0) slotHTML += '<span class="easy-slot-sep">·</span>';
    slotHTML += '<span class="easy-word-group">';
    group.forEach(() => {
      const slot = S.easyAnswer[flatIdx];
      let cls = 'easy-slot';
      if (slot) cls += ' filled';
      if (slot?.isHint) cls += ' is-hint';
      if (S.checked && slot) cls += flat[flatIdx].char === slot.char ? ' correct' : ' wrong';
      if (S.checked && !slot) cls += ' wrong';
      slotHTML += `<span class="${cls}" onclick="easyClickSlot(${flatIdx})">${slot ? slot.char : ''}</span>`;
      flatIdx++;
    });
    slotHTML += '</span>';
  });
  slotHTML += '</div>';

  // ── Tiles (pool) ──
  const tileHTML = `
    <div class="easy-tiles">
      ${S.easyTiles.map(t => `
        <button class="easy-tile${t.used ? ' used' : ''}${t.isHint ? ' hint-placed' : ''}"
          onclick="easyClickTile(${t.id})"
          ${t.used ? 'disabled' : ''}>${t.char}</button>
      `).join('')}
    </div>
  `;

  // ── Feedback / Check button ──
  let extra = '';
  if (!S.checked) {
    const filled = S.easyAnswer.filter(Boolean).length;
    extra = `
      <button class="easy-check-btn${filled === flat.length ? ' ready' : ''}"
        onclick="checkEasy()">
        ${checkSVG()} Check
      </button>`;
  } else {
    const cls = (S.result === 'correct' || S.result === 'hint-correct') ? 'ok' : 'bad';
    extra = `<div class="type-feedback ${cls}">
      ${S.result === 'correct' ? '✓ Correct! 🌟'
        : S.result === 'hint-correct' ? `✓ Correct! <span class="hint-note">(${S.hints} hint${S.hints > 1 ? 's' : ''} used)</span>`
          : '✗  Answer: ' + card.word}
    </div>`;
  }

  return slotHTML + tileHTML + extra;
}

// ══════════════════════════════════
//  RENDER: GAME HTML
// ══════════════════════════════════
function modeBarHTML() {
  const modes = [
    { id: 'easy', icon: '🟢', label: 'Easy', sub: 'Xếp chữ' },
    { id: 'medium', icon: '🟡', label: 'Medium', sub: 'Có gợi ý' },
    { id: 'hard', icon: '🔴', label: 'Hard', sub: 'Gõ tự do' },
  ];
  return `<div class="mode-bar">
    ${modes.map(m => `
      <button class="mode-btn${S.mode === m.id ? ' active active-' + m.id : ''}"
        onclick="setMode('${m.id}')">
        <span class="mode-icon">${m.icon}</span>
        <span class="mode-label">${m.label}</span>
        <span class="mode-sub">${m.sub}</span>
      </button>
    `).join('')}
  </div>`;
}

function hintBtnHTML() {
  if (S.checked) return '';
  const card = S.deck[S.idx];
  let remaining;
  if (S.mode === 'easy') {
    remaining = S.easyAnswer.filter(s => s === null).length;
  } else {
    const flat = getFlatChars(card.word);
    remaining = flat.filter(f => !S.revealed.has(f.origIdx)).length;
  }
  if (remaining <= 1) return '';
  return `
    <button class="hint-btn" onclick="useHint()" title="Press H for hint">
      💡 Hint
      ${S.hints > 0 ? `<span class="hint-count">${S.hints} used</span>` : ''}
    </button>`;
}

function gameHTML() {
  const card = S.deck[S.idx];
  const isEasy = S.mode === 'easy';

  let content = '';
  if (isEasy) {
    content = renderEasyMode(card);
  } else {
    // Medium & Hard: blanks + input
    const feedbackVal = S.result === 'correct' ? `<span class="ok">✓ Correct! 🌟</span>`
      : S.result === 'hint-correct' ? `<span class="ok">✓ Correct! <span class="hint-note">(${S.hints} hint${S.hints > 1 ? 's' : ''} used)</span></span>`
        : S.result === 'wrong' ? `<span class="bad">✗  Answer: ${card.word}</span>`
          : '';
    content = `
      <div id="blanksDisplay">${renderBlanks(card.word)}</div>
      <div class="type-wrap">
        <input class="type-input${S.result === 'correct' || S.result === 'hint-correct' ? ' correct' : S.result === 'wrong' ? ' wrong' : ''}"
          id="typeInput" type="text"
          placeholder="Type the word…"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          ${S.checked ? 'disabled' : ''}
          onkeydown="if(event.key==='Enter'){event.preventDefault();checkTyped();}">
        <button class="check-btn" onclick="checkTyped()" title="Check">${checkSVG()}</button>
      </div>
      <div class="type-feedback" id="typeFeedback">${feedbackVal}</div>
    `;
  }

  return `
    ${modeBarHTML()}
    <div class="card-face card-front-face">
      <div class="card-type-badge">${card.type}</div>
      <div class="card-num">${S.idx + 1} / ${S.deck.length}</div>

      <div class="speak-row">
        <button class="speak-btn" id="speakFront" onclick="speakWord(false)" title="Nghe từ">
          ${speakerSVG()}
        </button>
        <button class="speak-slow-btn" id="speakSlow" onclick="speakWord(true)" title="Nghe chậm">
          🐢
        </button>
      </div>

      ${card.phonetic ? `<div class="card-phonetic">${card.phonetic}</div>` : ''}

      ${content}

      <div id="hintRow" class="hint-row">${hintBtnHTML()}</div>
    </div>

    <div class="rate-row">
      <button class="rate-btn again" id="rateAgain" onclick="rate(false)" ${!S.checked ? 'disabled' : ''}>🔁 Study again</button>
      <button class="rate-btn know"  id="rateKnow"  onclick="rate(true)"  ${!S.checked ? 'disabled' : ''}>✅ Got it!</button>
    </div>
    <div class="nav-row">
      <button class="nav-btn" onclick="prev()" ${S.idx === 0 ? 'disabled' : ''}>← Prev</button>
      <button class="nav-btn" onclick="next()" ${S.idx >= S.deck.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>`;
}

// ══════════════════════════════════
//  COMPLETE SCREEN
// ══════════════════════════════════
function completeHTML() {
  const pct = S.deck.length ? Math.round(S.known / S.deck.length * 100) : 0;
  const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : pct >= 50 ? '📖' : '💪';
  const msg = pct >= 90 ? "Outstanding! You nailed all the words!"
    : pct >= 70 ? "Great job! A little more review and you'll nail it!"
      : pct >= 50 ? "Good effort! Review the ones you missed."
        : "Keep going! Practice makes perfect.";
  return `
  <div class="complete-card">
    <span class="complete-icon">${emoji}</span>
    <div class="complete-title">${pct >= 80 ? 'Well done!' : 'Round complete!'}</div>
    <div class="complete-sub">${msg}</div>
    <div class="result-grid">
      <div class="result-box green"><div class="rb-val">${S.known}</div><div class="rb-label">✅ Known</div></div>
      <div class="result-box orange"><div class="rb-val">${S.again}</div><div class="rb-label">🔁 Review</div></div>
      <div class="result-box purple"><div class="rb-val">${S.xp}</div><div class="rb-label">⚡ XP</div></div>
    </div>
    <div class="action-row">
      ${S.again > 0 ? `<button class="action-btn primary" onclick="init('${S.cat}',true)">🔁 Review ${S.again} cards</button>` : ''}
      <button class="action-btn secondary" onclick="init('${S.cat}',false)">🔄 Shuffle & restart</button>
      <button class="action-btn secondary" onclick="init('All',false)">📚 All words</button>
    </div>
  </div>`;
}

// ══════════════════════════════════
//  FULL / CARD RENDER
// ══════════════════════════════════
function streakXpHTML() {
  const streakCls = S.streak >= 5 ? 'fire' : S.streak >= 3 ? 'hot' : '';
  return `
    ${S.streak >= 2 ? `<div class="stat-chip ${streakCls}"><span>🔥</span><span class="val">${S.streak}</span><span>streak</span></div>` : ''}
    <div class="stat-chip xp-chip"><span>⚡</span><span class="val">${S.xp}</span><span>XP</span></div>
  `;
}

function fullRender() {
  document.getElementById('app').innerHTML = `
    <div class="header">
      <div class="unit-tag">Unit 8 · Paragraph 6</div>
      <div class="title">Becoming Independent</div>
      <div class="subtitle">${S.deck.length} words · ${S.reviewMode ? "Review mode" : "Study mode"}</div>
    </div>
    <div class="cat-row">
      ${CATS.map(c => `<button class="cat-btn ${S.cat === c && !S.reviewMode ? 'active' : ''}" onclick="init('${c}',false)">${c}</button>`).join('')}
    </div>
    <div class="stats-strip">
      <div class="stat-chip"><span>📚</span><span class="val">${S.deck.length}</span><span>cards</span></div>
      <div class="stat-chip"><span>✅</span><span class="val" id="knownCount">${S.known}</span><span>known</span></div>
      <div class="stat-chip"><span>🔁</span><span class="val" id="againCount">${S.again}</span><span>review</span></div>
      ${streakXpHTML()}
    </div>
    <div class="progress-row">
      <span class="prog-label">Progress</span>
      <div class="prog-bar"><div class="prog-fill" id="progFill" style="width:${S.deck.length ? S.idx / S.deck.length * 100 : 0}%"></div></div>
      <span class="prog-count" id="progCount">${S.idx}/${S.deck.length}</span>
    </div>
    <div id="cardArea">${S.done ? completeHTML() : gameHTML()}</div>
  `;
  if (!S.done) {
    if (S.mode !== 'easy') focusInput();
    bindKeys();
  }
}

function cardRender() {
  const area = document.getElementById('cardArea');
  if (area) area.innerHTML = gameHTML();
  if (S.mode !== 'easy') focusInput();
  bindKeys();
  updateStats();
}

function focusInput() {
  const i = document.getElementById('typeInput');
  if (i) setTimeout(() => i.focus(), 50);
}

function bindKeys() {
  document.onkeydown = e => {
    if (e.key === 'Enter' && document.activeElement?.id === 'typeInput') return;
    if (e.key === 'Enter' && !S.checked) checkTyped();
    if ((e.key === 'h' || e.key === 'H') && !S.checked
      && document.activeElement?.id !== 'typeInput') useHint();
  };
}

function updateStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const pf = document.getElementById('progFill');
  if (pf) pf.style.width = (S.deck.length ? S.idx / S.deck.length * 100 : 0) + '%';
  set('progCount', `${S.idx}/${S.deck.length}`);
  set('knownCount', S.known);
  set('againCount', S.again);
}

// ══════════════════════════════════
//  SVG HELPERS
// ══════════════════════════════════
function speakerSVG() { return `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`; }
function checkSVG() { return `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`; }

// ══════════════════════════════════
//  BOOT
// ══════════════════════════════════
window.speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
init("All", false);
