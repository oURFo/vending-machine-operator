(() => {
  'use strict';

  const CFG = {
    GAME_TIME: 180,
    SPAWN_MIN: 5.6,
    SPAWN_MAX: 6.4,
    HEAT_TIME: 2.5,
    PATIENCE: 20,
    PATIENCE_RUSH: 12,
    HEATER_SLOTS: 2,
    MAX_VISIBLE_QUEUE: 7,
    PERFECT_TARGET: 24,
    RATE_BIG_BILL: 0.25,
    RATE_HOT_RUSH: 0.20,
    RATE_IMPATIENT: 0.15,
    RATE_UNDERPAY: 0.15,
    HOT_RUSH_LENGTH: 3,
    PEE_AFTER: 3,
    PEE_TIME: 4,
  };

  const $ = (s, root = document) => root.querySelector(s);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  const el = {
    app: $('#app'),
    topView: $('#topView'),
    scene: $('#scene'),
    crowd: $('#crowd'),
    queueMore: $('#queueMore'),
    timer: $('#timer'),
    queueCount: $('#queueCount'),
    btnMute: $('#btnMute'),
    orderBody: $('#orderBody'),
    coinBody: $('#coinBody'),
    shelf: $('#shelf'),
    drinkSlot: $('#drinkSlot'),
    peeOverlay: $('#peeOverlay'),
    peeTime: $('#peeTime'),
    coach: $('#coach'),
    coachLesson: $('#coachLesson'),
    coachText: $('#coachText'),
    coachNext: $('#coachNext'),
    coachSkip: $('#coachSkip'),
    btnTutorial: $('#btnTutorial'),
    heater: $('#heater'),
    chute: $('#chuteSlot'),
    btnShip: $('#btnShip'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    pages: { drink: $('#tabDrink'), cash: $('#tabCash') },
    drinkBadge: $('#drinkBadge'),
    trayTotal: $('#trayTotal'),
    trayCoins: $('#trayCoins'),
    coinBtns: $('#coinBtns'),
    btnReset: $('#btnReset'),
    btnChange: $('#btnChange'),
    toast: $('#toast'),
    timeUp: $('#timeUp'),
    start: $('#startScreen'),
    btnStart: $('#btnStart'),
    result: $('#resultScreen'),
    resultBody: $('#resultBody'),
  };

  let S = null;
  let rafId = 0;
  let lastTs = 0;
  let toastTimer = 0;

  function freshStats() {
    return {
      served: 0, perfect: 0, complaints: 0, eaten: 0, loss: 0,
      wrong: 0, wrongLoss: 0, unheated: 0, tempWrong: 0,
      short: 0, shortAmount: 0, over: 0, overLoss: 0, spawned: 0,
      underpaid: 0, underLoss: 0, topUps: 0, falseClaim: 0,
      drank: 0, drinkLoss: 0, pee: 0,
    };
  }

  function newState() {
    return {
      running: false,
      timeLeft: CFG.GAME_TIME,
      elapsed: 0,
      spawnTimer: 0,
      tutorial: false,
      stepDelay: 0.9,
      nextId: 1,
      queue: [],
      active: null,
      selected: null,
      chute: null,
      bladder: 0,
      peeing: 0,
      heater: new Array(CFG.HEATER_SLOTS).fill(null),
      tray: [],
      hotRush: 0,
      tab: 'drink',
      lastSec: CFG.GAME_TIME,
      stats: freshStats(),
    };
  }

  /* ---------- 金額 ---------- */

  function coinsFor(amount, loose) {
    const out = [];
    let rest = amount;
    const coins = [50, 10, 5, 1];
    while (rest > 0) {
      let idx = coins.findIndex(c => c <= rest);
      if (loose && idx < coins.length - 1 && coins[idx] !== 1 && Math.random() < 0.3) idx++;
      out.push(coins[idx]);
      rest -= coins[idx];
    }
    return out;
  }

  function makePayment(price) {
    const r = Math.random();
    if (r < 0.22) return coinsFor(price, true);
    if (r < 0.45) return coinsFor((Math.floor(price / 10) + 1) * 10, true);
    if (r < 0.78) return Math.random() < 0.7 ? [50] : coinsFor(50, true);
    return [100];
  }

  function makeUnderPayment(price) {
    const shortBy = pick([1, 5, 5, 10, 10, 15].filter(s => s < price));
    return coinsFor(price - shortBy, true);
  }

  function makeTopUp(shortBy) {
    if (Math.random() < 0.5) return coinsFor(shortBy, false);
    const coin = [5, 10, 50].find(v => v >= shortBy);
    return coin ? [coin] : coinsFor(shortBy, false);
  }

  function moneyChips(list) {
    const counts = {};
    list.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => b - a)
      .map(v => {
        const img = v === 100
          ? '<img class="bill" src="assets/ui/bill100.webp" alt="100">'
          : `<img src="assets/ui/coin${v}.webp" alt="${v}">`;
        return `<span class="mchip">${img}${counts[v] > 1 ? `<b>×${counts[v]}</b>` : ''}</span>`;
      })
      .join('');
  }

  /* ---------- 飲料圖像 ---------- */

  function drinkHTML(d, { heated = false, size = '' } = {}) {
    const steam = heated ? '<div class="steam"><i></i><i></i><i></i></div>' : '';
    return `<div class="dk ${size} ${heated ? 'heated' : ''}"><img src="assets/drinks/${d.id}.webp" alt="${d.name}" draggable="false">${steam}</div>`;
  }

  function itemHTML(item) {
    return drinkHTML(DRINK_MAP[item.drinkId], { heated: item.heated });
  }

  /* ---------- 顧客 ---------- */

  function spawnCustomer(script) {
    const progress = Math.min(1, S.elapsed / CFG.GAME_TIME);
    const mult = 0.6 + 0.8 * progress;
    let drink = script ? DRINK_MAP[script.drinkId] : null;
    let bigBill = false;

    if (script) {
      // 教學顧客：品項與投幣固定
    } else if (S.hotRush > 0) {
      S.hotRush--;
      drink = pick(HOT_DRINKS);
    } else if (S.stats.spawned > 0 && Math.random() < CFG.RATE_HOT_RUSH * mult) {
      S.hotRush = CFG.HOT_RUSH_LENGTH - 1;
      drink = pick(HOT_DRINKS);
    }
    if (!drink) {
      if (Math.random() < CFG.RATE_BIG_BILL * mult) {
        bigBill = true;
        drink = pick(CHEAP_DRINKS);
      } else {
        drink = pick(DRINKS);
      }
    }

    const impatient = !script && S.stats.spawned > 0 && Math.random() < CFG.RATE_IMPATIENT * mult;
    const underpay = !bigBill && S.stats.spawned > 0 && Math.random() < CFG.RATE_UNDERPAY * mult;
    const payment = script ? script.payment.slice()
      : bigBill ? [100] : underpay ? makeUnderPayment(drink.price) : makePayment(drink.price);
    const paid = sum(payment);

    const c = {
      id: S.nextId++,
      drink,
      payment,
      paid,
      due: paid - drink.price,
      impatient,
      patienceMax: impatient ? CFG.PATIENCE_RUSH : CFG.PATIENCE,
      patience: 0,
      delivered: null,
      changeGiven: null,
      state: 'queue',
      char: pickChar(),
    };
    S.stats.spawned++;
    buildCustomerEl(c);
    S.queue.push(c);
    layoutCrowd();
  }

  function pickChar() {
    const last = S.queue.length ? S.queue[S.queue.length - 1].char : (S.active ? S.active.char : 0);
    const pool = CHARACTERS.filter(n => n !== last);
    return pick(pool);
  }

  function buildCustomerEl(c) {
    const e = document.createElement('div');
    e.className = 'cust';
    e.innerHTML = `
      <div class="fig">
        <div class="pbar"><i></i></div>
        <div class="bubble"></div>
        <div class="think"></div>
        <img class="sprite" src="${charSrc(c.char, c.impatient ? 'annoyed' : 'neutral')}" alt="" draggable="false">
        ${c.impatient ? '<b class="tag-rush">⚡急驚風</b>' : ''}
      </div>`;
    e.style.left = '112%';
    e.style.bottom = '12%';
    e.style.setProperty('--s', '0.3');
    el.crowd.appendChild(e);
    void e.offsetWidth;
    c.el = e;
    c.face = c.impatient ? 'annoyed' : 'neutral';
    c.refs = {
      fig: $('.fig', e),
      pbar: $('.pbar i', e),
      sprite: $('.sprite', e),
      bubble: $('.bubble', e),
      think: $('.think', e),
    };
  }

  function setFace(c, expr) {
    if (c.face === expr) return;
    c.face = expr;
    c.refs.sprite.src = charSrc(c.char, expr);
  }

  function setWalking(c) {
    c.refs.fig.classList.add('walking');
    clearTimeout(c.walkTimer);
    c.walkTimer = setTimeout(() => c.refs.fig.classList.remove('walking'), 750);
  }

  function placeCustomer(c, left, bottom, scale, z, opacity) {
    const newLeft = left + '%';
    if (c.el.style.left !== newLeft) setWalking(c);
    c.el.style.left = newLeft;
    c.el.style.bottom = bottom;
    c.el.style.setProperty('--s', scale.toFixed(3));
    c.el.style.zIndex = z;
    c.el.style.opacity = opacity;
  }

  function layoutCrowd() {
    if (S.active) placeCustomer(S.active, 1, 'calc(var(--ch) * -0.36)', 1, 50, 1);
    S.queue.forEach((c, i) => {
      const vi = Math.min(i, CFG.MAX_VISIBLE_QUEUE);
      const hidden = i >= CFG.MAX_VISIBLE_QUEUE;
      placeCustomer(c, 56 + vi * 5.5, (12 + vi * 3.2) + '%', Math.max(0.22, 0.44 - vi * 0.035), 40 - vi, hidden ? 0 : 1);
      if (i === 0) {
        c.refs.think.innerHTML = drinkHTML(c.drink, { size: 'mini' });
        c.refs.think.classList.add('show');
      } else {
        c.refs.think.classList.remove('show');
      }
    });
    const extra = S.queue.length - CFG.MAX_VISIBLE_QUEUE;
    el.queueMore.classList.toggle('hidden', extra <= 0);
    if (extra > 0) el.queueMore.textContent = `+${extra} 人`;
    el.queueCount.textContent = `排隊 ${S.queue.length} 人`;
    el.queueCount.classList.toggle('jam', S.queue.length >= 5);
  }

  function activateNext() {
    const c = S.queue.shift();
    c.state = 'active';
    c.patience = c.patienceMax;
    c.refs.think.classList.remove('show');
    c.el.classList.add('active');
    S.active = c;
    Sfx.insert(c.payment);
    layoutCrowd();
    renderOrder();
  }

  function renderPatience() {
    const c = S.active;
    if (!c) return;
    const r = Math.max(0, c.patience / c.patienceMax);
    c.refs.pbar.style.width = (r * 100).toFixed(1) + '%';
    c.refs.pbar.style.background = r > 0.5 ? '#3ddc84' : r > 0.25 ? '#ffc107' : '#ff3b30';
    if (S.elapsed >= (c.faceHold || 0)) setFace(c, r > 0.5 && !c.impatient ? 'neutral' : 'annoyed');
    c.refs.fig.classList.toggle('tap', r <= 0.3);
  }

  function showBubble(c, text, kind) {
    c.refs.bubble.className = 'bubble show' + (kind ? ' b-' + kind : '');
    c.refs.bubble.textContent = text;
  }

  function flashBubble(c, text, kind, face, sec) {
    showBubble(c, text, kind);
    if (face) setFace(c, face);
    c.faceHold = S.elapsed + sec;
    clearTimeout(c.bubbleTimer);
    c.bubbleTimer = setTimeout(() => {
      if (c.state === 'active') c.refs.bubble.classList.remove('show');
    }, sec * 1000);
  }

  /* ---------- 交易判定 ---------- */

  function checkDone() {
    const c = S.active;
    if (c && c.delivered && (c.changeGiven !== null || c.due <= 0)) finishTransaction(false);
  }

  function finishTransaction(timeout) {
    const c = S.active;
    const st = S.stats;
    let result;

    if (timeout && !c.delivered) {
      st.eaten++;
      st.complaints += 2;
      result = 'eaten';
    } else {
      const issues = [];
      const d = c.delivered;
      const gave = c.changeGiven ?? 0;

      if (d.drinkId !== c.drink.id) {
        const cost = DRINK_MAP[d.drinkId].price;
        st.wrong++; st.complaints++; st.loss += cost; st.wrongLoss += cost;
        issues.push('wrong');
      } else if (c.drink.hot && !d.heated) {
        st.unheated++; st.complaints++;
        issues.push('unheated');
      } else if (!c.drink.hot && d.heated) {
        st.tempWrong++; st.complaints++;
        issues.push('tempWrong');
      }

      if (c.due < 0) {
        st.underpaid++; st.underLoss += -c.due; st.loss += -c.due;
        issues.push('underpaid');
        if (gave > 0) {
          st.over++; st.overLoss += gave; st.loss += gave;
          issues.push('over');
        }
      } else if (gave < c.due) {
        st.short++; st.complaints++; st.shortAmount += c.due - gave;
        issues.push('short');
      } else if (gave > c.due) {
        st.over++; st.overLoss += gave - c.due; st.loss += gave - c.due;
        issues.push('over');
      }

      st.served++;
      if (!issues.length) st.perfect++;
      const priority = ['short', 'unheated', 'tempWrong', 'wrong', 'underpaid', 'over'];
      result = priority.find(p => issues.includes(p)) || 'perfect';
    }

    const stay = react(c, result);
    S.active = null;
    S.stepDelay = stay + 0.15;
    renderOrder();
    layoutCrowd();
  }

  function react(c, result) {
    const R = REACTIONS[result];
    c.state = 'leaving';
    c.el.classList.remove('active');
    c.el.classList.add('leaving');
    c.el.style.zIndex = 60;
    clearTimeout(c.bubbleTimer);
    setFace(c, R.face);
    c.refs.fig.className = 'fig ' + R.cls;
    if (R.text) showBubble(c, R.text, result);
    else c.refs.bubble.classList.remove('show');

    switch (result) {
      case 'eaten':
        [0, 380, 760].forEach(ms => setTimeout(() => { Sfx.kick(); shake('shake-hard'); }, ms));
        break;
      case 'short':
        [0, 260, 520].forEach(ms => setTimeout(() => { Sfx.bang(); shake('shake'); }, ms));
        break;
      case 'unheated':
      case 'tempWrong':
        Sfx.shiver();
        break;
      case 'over':
      case 'underpaid':
        Sfx.giggle();
        break;
      case 'wrong':
        Sfx.error();
        break;
      default:
        break;
    }

    const stay = result === 'eaten' ? 1.3 : result === 'perfect' ? 0.5 : 0.95;
    const run = result === 'over' || result === 'underpaid';
    setTimeout(() => {
      c.refs.bubble.classList.remove('show');
      c.el.classList.add(run ? 'run' : 'walk-out');
      c.refs.fig.classList.add('walking');
      c.el.style.left = '-70%';
    }, stay * 1000);
    setTimeout(() => c.el.remove(), (stay + 1.3) * 1000);
    return stay;
  }

  function shake(cls) {
    el.topView.classList.remove('shake', 'shake-hard');
    void el.topView.offsetWidth;
    el.topView.classList.add(cls);
  }

  /* ---------- 玩家操作 ---------- */

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1100);
  }

  function onShelf(id) {
    S.selected = S.selected === id ? null : id;
    Sfx.pick();
    renderStations();
  }

  function onHeater(i) {
    const slot = S.heater[i];
    if (!slot) {
      if (!S.selected) { toast('先點選要加熱的飲料'); return; }
      S.heater[i] = { drinkId: S.selected, t: 0, done: false, hum: Sfx.hum() };
      S.selected = null;
      Sfx.pick();
    } else if (!slot.done) {
      toast('還在加熱中…');
      return;
    } else {
      if (S.chute) { toast('出貨槽已有飲料，先出貨或喝掉'); Sfx.error(); return; }
      S.chute = { drinkId: slot.drinkId, heated: true };
      S.heater[i] = null;
      Sfx.pick();
    }
    renderStations();
  }

  function onChute() {
    if (!S.selected) {
      if (S.chute) toast('不要的飲料可以點「喝掉」');
      return;
    }
    if (S.chute) { toast('出貨槽已有飲料，先出貨或喝掉'); Sfx.error(); return; }
    S.chute = { drinkId: S.selected, heated: false };
    S.selected = null;
    Sfx.pick();
    renderStations();
  }

  function onDrink() {
    let id = null;
    if (S.selected) { id = S.selected; S.selected = null; }
    else if (S.chute) { id = S.chute.drinkId; S.chute = null; }
    else {
      const i = S.heater.findIndex(h => h && h.done);
      if (i >= 0) { id = S.heater[i].drinkId; S.heater[i] = null; }
    }
    if (!id) { toast('沒有飲料可以喝'); return; }
    const d = DRINK_MAP[id];
    const st = S.stats;
    st.drank++; st.drinkLoss += d.price; st.loss += d.price;
    S.bladder++;
    Sfx.gulp();
    toast(`咕嚕咕嚕…${d.name} 營業損失 $${d.price}`);
    renderStations();
    if (!S.tutorial && S.bladder >= CFG.PEE_AFTER) setTimeout(() => S.running && startPee(), 450);
  }

  function startPee() {
    S.bladder = 0;
    S.peeing = CFG.PEE_TIME;
    S.stats.pee++;
    S.selected = null;
    el.peeOverlay.classList.remove('hidden');
    el.peeTime.textContent = Math.ceil(S.peeing);
    Sfx.flush();
    renderStations();
  }

  function onClaimShort() {
    const c = S.active;
    if (!c || c.state !== 'active') return;
    const price = c.drink.price;
    if (c.paid < price) {
      const add = S.tutorial ? coinsFor(price - c.paid, false) : makeTopUp(price - c.paid);
      c.payment = c.payment.concat(add);
      c.paid += sum(add);
      c.due = c.paid - price;
      S.stats.topUps++;
      Sfx.insert(add);
      flashBubble(c, '啊，不好意思…', 'topup', 'confused', 1.1);
    } else {
      S.stats.falseClaim++;
      S.stats.complaints++;
      Sfx.bang();
      shake('shake');
      flashBubble(c, '我明明有投夠！', 'false', 'furious', 1.3);
    }
    renderOrder();
  }

  function onShip() {
    const c = S.active;
    if (!S.chute) { toast('出貨槽是空的'); Sfx.error(); return; }
    if (!c) { toast('目前沒有顧客'); Sfx.error(); return; }
    if (c.delivered) { toast('這位顧客已經拿到飲料了'); Sfx.error(); return; }
    c.delivered = S.chute;
    S.chute = null;
    Sfx.drop();
    renderStations();
    renderOrder();
    checkDone();
  }

  function onCoin(v) {
    S.tray.push(v);
    Sfx.coin();
    renderTray();
  }

  function onReset() {
    if (!S.tray.length) return;
    S.tray = [];
    Sfx.pick();
    renderTray();
  }

  function onGiveChange() {
    const c = S.active;
    if (!c) { toast('目前沒有顧客'); Sfx.error(); return; }
    if (c.changeGiven !== null) { toast('已經找過零了'); Sfx.error(); return; }
    const total = sum(S.tray);
    c.changeGiven = total;
    if (total > 0) Sfx.cascade(S.tray.length); else Sfx.pick();
    S.tray = [];
    renderTray();
    renderOrder();
    checkDone();
  }

  function setTab(tab) {
    S.tab = tab;
    el.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    el.pages.drink.classList.toggle('hidden', tab !== 'drink');
    el.pages.cash.classList.toggle('hidden', tab !== 'cash');
    if (tab === 'drink') el.drinkBadge.classList.add('hidden');
  }

  /* ---------- 繪製 ---------- */

  function renderShelf() {
    el.shelf.innerHTML = DRINKS.map(d => `
      <button class="shelf-card ${d.hot ? 'is-hot' : 'is-cold'}" data-id="${d.id}">
        <span class="tt">${d.hot ? '熱' : '冷'}</span>
        ${drinkHTML(d)}
        <div class="nm">${d.name}</div>
        <div class="pr">$${d.price}</div>
      </button>`).join('');
  }

  function renderStations() {
    const sel = S.selected;
    const drops = Array.from({ length: CFG.PEE_AFTER }, (_, i) => `<i class="${i < S.bladder ? 'on' : ''}"></i>`).join('');
    el.drinkSlot.innerHTML = `<span class="gulp-ico">🥤</span><span class="gulp-tx">喝掉</span><span class="bladder">${drops}</span>`;
    el.drinkSlot.classList.toggle('armed', !!sel || !!S.chute || S.heater.some(h => h && h.done));

    el.heater.innerHTML = S.heater.map((h, i) => {
      if (!h) return `<div class="hslot ${sel ? 'target' : ''}" data-i="${i}"><span class="ph">空</span></div>`;
      const d = DRINK_MAP[h.drinkId];
      return `<div class="hslot ${h.done ? 'done' : 'heating'}" data-i="${i}">
        ${drinkHTML(d, { heated: h.done })}
        ${h.done ? '<span class="hdone">叮！熱騰騰</span>' : '<div class="hprog"><i></i></div>'}
      </div>`;
    }).join('');

    el.chute.innerHTML = S.chute ? itemHTML(S.chute) : '<span class="ph">空</span>';
    el.chute.classList.toggle('filled', !!S.chute);
    el.chute.classList.toggle('target', !!sel && !S.chute);

    el.shelf.querySelectorAll('.shelf-card').forEach(b => b.classList.toggle('selected', b.dataset.id === sel));
    renderHeaterProgress();
  }

  function renderHeaterProgress() {
    S.heater.forEach((h, i) => {
      if (!h || h.done) return;
      const bar = el.heater.querySelector(`.hslot[data-i="${i}"] .hprog i`);
      if (bar) bar.style.width = Math.min(100, (h.t / CFG.HEAT_TIME) * 100).toFixed(1) + '%';
    });
  }

  function renderTray() {
    el.trayTotal.textContent = sum(S.tray);
    el.trayCoins.innerHTML = S.tray.length ? moneyChips(S.tray) : '<span class="ph">尚未放入硬幣</span>';
  }

  function renderOrder() {
    const c = S.active;
    if (!c) {
      el.orderBody.innerHTML = '<div class="idle">等待顧客…</div>';
      el.coinBody.innerHTML = '<div class="coin-led dim">$0</div>';
      return;
    }
    const d = c.drink;
    el.orderBody.innerHTML = `
      <div class="order-lamp">
        ${drinkHTML(d, { size: 'mini' })}
        <div class="order-text">
          <div class="oname">${d.name}</div>
          <div class="ometa"><span class="temp ${d.hot ? 'hot' : 'cold'}">${d.hot ? '熱' : '冷'}</span><span class="oprice">$${d.price}</span></div>
        </div>
        <div class="ostatus">
          <span class="${c.delivered ? 'ok' : ''}">出貨${c.delivered ? '✓' : ''}</span>
          <span class="${c.changeGiven !== null ? 'ok' : ''}">找零${c.changeGiven !== null ? '✓' : ''}</span>
        </div>
      </div>`;
    el.coinBody.innerHTML = `
      <div class="coin-main">
        <div class="coin-led">投入 $${c.paid}</div>
        <div class="money-chips">${moneyChips(c.payment)}</div>
      </div>
      <button class="btn-short">金錢<br>不足</button>`;
  }

  function renderHud() {
    if (S.tutorial) { el.timer.textContent = '教學'; el.timer.classList.remove('urgent'); return; }
    const t = Math.max(0, Math.ceil(S.timeLeft));
    el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    el.timer.classList.toggle('urgent', t <= 30);
  }

  function renderAll() {
    renderShelf();
    renderStations();
    renderTray();
    renderOrder();
    renderHud();
    layoutCrowd();
  }

  /* ---------- 主迴圈 ---------- */

  function update(dt) {
    S.elapsed += dt;

    if (!S.tutorial) {
      S.timeLeft -= dt;
      const sec = Math.ceil(S.timeLeft);
      if (sec !== S.lastSec) {
        S.lastSec = sec;
        if (sec <= 10 && sec > 0) Sfx.tick();
      }
      if (S.timeLeft <= 0) { endGame(); return; }

      S.spawnTimer -= dt;
      if (S.spawnTimer <= 0) {
        S.spawnTimer += rand(CFG.SPAWN_MIN, CFG.SPAWN_MAX);
        spawnCustomer();
      }
    }

    if (S.peeing > 0) {
      S.peeing -= dt;
      el.peeTime.textContent = Math.max(0, Math.ceil(S.peeing));
      if (S.peeing <= 0) {
        el.peeOverlay.classList.add('hidden');
        Sfx.ding();
      }
    }

    if (!S.active) {
      S.stepDelay -= dt;
      if (S.stepDelay <= 0 && S.queue.length) activateNext();
    } else {
      if (!S.tutorial) S.active.patience -= dt;
      if (S.active.patience <= 0) finishTransaction(true);
    }

    let heaterChanged = false;
    S.heater.forEach(h => {
      if (h && !h.done) {
        h.t += dt;
        if (h.t >= CFG.HEAT_TIME) {
          h.done = true;
          h.hum.stop();
          Sfx.ding();
          heaterChanged = true;
          if (S.tab !== 'drink') el.drinkBadge.classList.remove('hidden');
        }
      }
    });
    if (heaterChanged) renderStations();
  }

  function loop(ts) {
    if (!S.running) return;
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    if (!S.running) return;
    if (S.tutorial) tutTick();
    if (!S.running) return;
    renderHud();
    renderPatience();
    renderHeaterProgress();
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    Sfx.init();
    tutCleanup();
    cancelAnimationFrame(rafId);
    if (S) S.heater.forEach(h => h && h.hum && h.hum.stop());
    el.crowd.innerHTML = '';
    S = newState();
    S.running = true;
    setTab('drink');
    updateSceneScale();
    renderAll();
    el.start.classList.add('hidden');
    el.result.classList.add('hidden');
    el.timeUp.classList.add('hidden');
    el.peeOverlay.classList.add('hidden');
    lastTs = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    S.running = false;
    S.timeLeft = 0;
    renderHud();
    S.heater.forEach(h => h && h.hum && h.hum.stop());
    el.peeOverlay.classList.add('hidden');
    Sfx.whistle();
    el.timeUp.classList.remove('hidden');
    setTimeout(() => {
      el.timeUp.classList.add('hidden');
      showResult();
    }, 1400);
  }

  /* ---------- 結算 ---------- */

  function computeGrade(st) {
    const reasons = [];
    if (st.eaten >= 3) reasons.push(`吃錢 ${st.eaten} 次`);
    if (st.complaints >= 5) reasons.push(`客訴 ${st.complaints} 次`);
    if (st.loss > 500) reasons.push(`營業損失 $${st.loss}`);
    if (reasons.length) return { grade: 'F', reasons };
    if (st.complaints === 0 && st.loss === 0 && st.perfect >= CFG.PERFECT_TARGET) return { grade: 'S', reasons };
    if (st.complaints <= 1 && st.loss <= 50 && st.served >= 12) return { grade: 'A', reasons };
    if (st.complaints <= 3 && st.loss <= 200) return { grade: 'B', reasons };
    return { grade: 'C', reasons };
  }

  function pickNews(st, grade) {
    if (grade === 'S') return 'perfect';
    const scores = {
      eaten: st.eaten * 1.5,
      pee: st.pee * 4 + st.drank * 0.5,
      over: (st.overLoss + st.underLoss) / 80,
      unheated: st.unheated + st.tempWrong * 0.5,
      wrong: st.wrong,
      short: st.short * 0.9,
    };
    const qualifies = {
      eaten: st.eaten >= 2,
      pee: st.pee >= 1,
      over: st.overLoss + st.underLoss >= 150,
      unheated: st.unheated >= 3,
      wrong: st.wrong >= 3,
      short: st.short >= 3,
    };
    const keys = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const extreme = keys.find(k => qualifies[k]);
    if (extreme) return extreme;
    if (grade === 'F' && scores[keys[0]] > 0) return keys[0];
    return null;
  }

  function rocDate() {
    const d = new Date();
    return `中華民國 ${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }

  function newsHTML(key, st) {
    const n = NEWS[key];
    return `
      <div class="newspaper ${key === 'perfect' ? 'good' : ''}">
        <div class="np-mast">
          <span class="np-name">販賣機日報</span>
          <span class="np-date">${rocDate()}・突發快報</span>
        </div>
        <div class="np-breaking">BREAKING NEWS</div>
        <h2 class="np-title"><em>《${n.tag}》</em>${n.title}</h2>
        <div class="np-row">
          <img class="np-photo" src="assets/news/${key}.webp" alt="">
          <div class="np-text">
            <p class="np-sub">${n.sub}</p>
            <p class="np-body">${n.body(st)}</p>
          </div>
        </div>
      </div>`;
  }

  function showResult() {
    const st = S.stats;
    const g = computeGrade(st);
    const info = GRADES[g.grade];
    const newsKey = pickNews(st, g.grade);
    const waiting = S.queue.length + (S.active ? 1 : 0);
    const fired = g.grade === 'F';

    el.resultBody.innerHTML = `
      <div class="report ${fired ? 'fired' : ''}">
        <div class="rp-head">
          <div class="rp-title">本日營業結算報告</div>
          <div class="rp-sub">販賣機「人工核心」員工考核表</div>
        </div>
        <div class="rp-stats">
          <div class="stat"><b>${st.served}</b><span>完成顧客數</span><em>完美交易 ${st.perfect}</em></div>
          <div class="stat ${st.loss > 0 ? 'bad' : ''}"><b>$${st.loss}</b><span>營業損失 (NTD)</span></div>
          <div class="stat ${st.complaints > 0 ? 'bad' : ''}"><b>${st.complaints}</b><span>客訴總次數</span></div>
          <div class="stat ${st.eaten > 0 ? 'bad' : ''}"><b>${st.eaten}</b><span>吃錢次數</span></div>
        </div>
        <div class="rp-detail">
          <span>給錯飲料 ${st.wrong}</span>
          <span>熱飲沒加熱 ${st.unheated}</span>
          <span>冷飲被加熱 ${st.tempWrong}</span>
          <span>少找錢 ${st.short}</span>
          <span>多找錢 ${st.over}（$${st.overLoss}）</span>
          <span>錢沒收夠就出貨 ${st.underpaid}（$${st.underLoss}）</span>
          <span>成功叫顧客補錢 ${st.topUps}</span>
          <span>誤會顧客沒投夠 ${st.falseClaim}</span>
          <span>偷喝飲料 ${st.drank}（$${st.drinkLoss}）</span>
          <span>跑去尿尿 ${st.pee} 次</span>
          <span>下班仍在排隊 ${waiting} 人</span>
        </div>
        <div class="grade g-${g.grade}">
          <div class="g-letter">${g.grade}</div>
          <div>
            <div class="g-name">${g.grade} 級・${info.name}</div>
            <div class="g-desc">${info.desc}</div>
          </div>
        </div>
        ${fired ? `<div class="fire-reason">解雇事由：${g.reasons.join('、')}</div><div class="stamp">解雇通知書</div>` : ''}
      </div>
      ${newsKey ? newsHTML(newsKey, st) : ''}
      <button id="btnRetry" class="big-btn">再上一班</button>`;

    el.result.classList.remove('hidden');
    el.result.scrollTop = 0;
    $('#btnRetry').addEventListener('click', startGame);
    if (fired) setTimeout(() => Sfx.stamp(), 550);
    else if (g.grade === 'S' || g.grade === 'A') Sfx.fanfare();
  }

  /* ---------- 新手教學 ---------- */

  let T = null;

  const custReady = () => S.active && S.active.state === 'active';
  const custGone = () => !S.active;
  const picked = id => () => S.selected === id;
  const inChute = id => () => S.chute && S.chute.drinkId === id;
  const inHeater = id => () => S.heater[0] && S.heater[0].drinkId === id;
  const heaterDone = () => S.heater[0] && S.heater[0].done;
  const card = id => `.shelf-card[data-id="${id}"]`;
  const HEATER0 = '#heater .hslot[data-i="0"]';

  function tutSteps() {
    return [
      { lesson: '1 / 3　正確交易', text: '歡迎上班！你是躲在販賣機裡的<b>人工核心</b>。先來完成一筆正確的交易。', next: true },
      { spawn: { drinkId: 'wintermelon', payment: [10, 10] }, text: '顧客來了，等他投幣…', wait: custReady },
      { text: '看上方燈號：他要<b>冬瓜茶 $15</b>（冷飲），投入 <b>$20</b>。', focus: '#infoBar', next: true },
      { text: '點選<b>冬瓜茶</b>，讓它亮起來。', target: card('wintermelon'), wait: picked('wintermelon') },
      { text: '冷飲不用加熱，點<b>出貨槽</b>放進去。', target: '#chuteSlot', wait: inChute('wintermelon') },
      { text: '按<b>確認出貨</b>，把飲料交給顧客。', target: '#btnShip', wait: () => S.active && S.active.delivered },
      { text: '接著找零。切換到<b>收銀找零區</b>。', target: '.tab-btn[data-tab="cash"]', wait: () => S.tab === 'cash' },
      { text: '心算：投入 $20 − 售價 $15 = <b>$5</b>。點一枚 <b>5 元</b>。', target: '.coin-btn[data-v="5"]', wait: () => sum(S.tray) === 5 },
      { text: '退幣槽是 $5，按<b>確認找零</b>。', target: '#btnChange', wait: custGone },
      { text: '完美交易！系統<b>不會提醒你算錯</b>，多找、少找都要自己負責喔。', next: true },

      { lesson: '2 / 3　金錢不足', enter: () => setTab('drink'), spawn: { drinkId: 'greentea', payment: [10, 5] }, text: '下一位顧客來了…', wait: custReady },
      { text: '他要<b>綠茶 $20</b>，可是只投了 <b>$15</b>！', focus: '#infoBar', next: true },
      { text: '錢不夠時，按投幣顯示器的<b>金錢不足</b>，叫顧客補錢。', target: '.btn-short', wait: () => S.active && S.active.paid >= S.active.drink.price },
      { text: '顧客補了 $5，現在剛好 $20，<b>不用找零</b>。點選<b>綠茶</b>。', target: card('greentea'), wait: picked('greentea') },
      { text: '點<b>出貨槽</b>。', target: '#chuteSlot', wait: inChute('greentea') },
      { text: '按<b>確認出貨</b>，剛好付清交易就完成了。', target: '#btnShip', wait: custGone },
      { text: '注意：顧客明明投夠還按金錢不足會被<b>客訴</b>；沒發現就出貨則算<b>營業損失</b>。', next: true },

      { lesson: '3 / 3　加熱失誤與喝掉', spawn: { drinkId: 'cocoa', payment: [10, 10, 10, 5] }, text: '最後一位顧客來了…', wait: custReady },
      { text: '他要<b>熱可可 $35</b>（熱飲），投入剛好 $35。熱飲要先加熱。', focus: '#infoBar', next: true },
      { text: '先示範手滑拿錯：點選<b>玉米濃湯</b>。', target: card('cornsoup'), wait: picked('cornsoup') },
      { text: '放進<b>加熱爐</b>。', target: HEATER0, wait: inHeater('cornsoup') },
      { text: '加熱中…（約 2.5 秒）', focus: '#heater', wait: heaterDone },
      { text: '糟糕，熱錯了！點<b>喝掉</b>把它處理掉（喝掉的飲料算<b>營業損失</b>）。', target: '#drinkSlot', wait: () => !S.heater[0] },
      { text: '喝太多會<b>跑去尿尿</b>喔！現在點選正確的<b>熱可可</b>。', target: card('cocoa'), wait: picked('cocoa') },
      { text: '放進<b>加熱爐</b>重新加熱。', target: HEATER0, wait: inHeater('cocoa') },
      { text: '加熱中…', focus: '#heater', wait: heaterDone },
      { text: '叮！點<b>加熱好的熱可可</b>，它會移到出貨槽。', target: HEATER0, wait: inChute('cocoa') },
      { text: '按<b>確認出貨</b>。剛好付清，不用找零。', target: '#btnShip', wait: custGone },

      { lesson: '教學完成', text: '你學會了<b>正確交易</b>、<b>金錢不足</b>、<b>喝掉重新加熱</b>！準備好正式上班了嗎？', next: true, nextLabel: '開始上班 ▶', finish: true },
    ];
  }

  function startTutorial() {
    startGame();
    S.tutorial = true;
    T = { steps: tutSteps(), i: -1, focusEl: null };
    el.coach.classList.remove('hidden');
    renderHud();
    tutGo(0);
  }

  function tutGo(i) {
    T.i = i;
    const st = T.steps[i];
    if (st.enter) st.enter();
    if (st.spawn) spawnCustomer(st.spawn);
    if (st.lesson) el.coachLesson.textContent = st.lesson;
    el.coachText.innerHTML = st.text;
    el.coachNext.classList.toggle('hidden', !st.next);
    el.coachNext.textContent = st.nextLabel || '下一步 ▶';
    el.coachSkip.textContent = st.finish ? '回主畫面' : '跳過教學';
    el.coach.classList.remove('pop');
    void el.coach.offsetWidth;
    el.coach.classList.add('pop');
    tutFocus(st);
  }

  function tutTick() {
    const st = T && T.steps[T.i];
    if (!st) return;
    if (st.wait && st.wait()) { tutGo(T.i + 1); return; }
    tutFocus(st);
  }

  function tutFocus(st) {
    const sel = st.target || st.focus;
    const fe = sel ? $(sel) : null;
    if (fe !== T.focusEl) {
      if (T.focusEl) T.focusEl.classList.remove('tut-focus');
      if (fe) fe.classList.add('tut-focus');
      T.focusEl = fe;
    }
    el.coach.classList.toggle('at-bottom', !!fe && !!fe.closest('#topView'));
  }

  function tutAllows(e) {
    if (!S || !S.tutorial || !T) return true;
    const st = T.steps[T.i];
    const t = st && st.target ? $(st.target) : null;
    return !!t && t.contains(e.target);
  }

  function onCoachNext() {
    const st = T && T.steps[T.i];
    if (!st || !st.next) return;
    Sfx.pick();
    if (st.finish) startGame();
    else tutGo(T.i + 1);
  }

  function tutCleanup() {
    if (T && T.focusEl) T.focusEl.classList.remove('tut-focus');
    T = null;
    el.coach.classList.add('hidden');
  }

  function exitTutorial() {
    if (!S) return;
    S.running = false;
    cancelAnimationFrame(rafId);
    S.heater.forEach(h => h && h.hum && h.hum.stop());
    tutCleanup();
    el.crowd.innerHTML = '';
    el.peeOverlay.classList.add('hidden');
    el.start.classList.remove('hidden');
  }

  /* ---------- 事件綁定 ---------- */

  function updateSceneScale() {
    const h = el.scene.clientHeight || 190;
    el.crowd.style.setProperty('--ch', Math.round(h * 1.3) + 'px');
  }

  function preloadImages() {
    const srcs = [];
    CHARACTERS.forEach(n => EXPRESSIONS.forEach(e => srcs.push(charSrc(n, e))));
    DRINKS.forEach(d => srcs.push(`assets/drinks/${d.id}.webp`));
    Object.keys(NEWS).forEach(k => srcs.push(`assets/news/${k}.webp`));
    srcs.push('assets/ui/bill100.webp');
    srcs.forEach(src => { const img = new Image(); img.src = src; });
  }

  function onPress(target, handler) {
    target.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      handler(e);
    });
  }

  function bind() {
    const live = fn => e => { if (S && S.running && S.peeing <= 0 && tutAllows(e)) fn(e); };

    onPress(el.shelf, live(e => {
      const card = e.target.closest('.shelf-card');
      if (card) onShelf(card.dataset.id);
    }));
    onPress(el.drinkSlot, live(onDrink));
    onPress(el.coinBody, live(e => {
      if (e.target.closest('.btn-short')) onClaimShort();
    }));
    onPress(el.heater, live(e => {
      const slot = e.target.closest('.hslot');
      if (slot) onHeater(Number(slot.dataset.i));
    }));
    onPress(el.chute, live(onChute));
    onPress(el.btnShip, live(onShip));
    onPress(el.coinBtns, live(e => {
      const btn = e.target.closest('.coin-btn');
      if (btn) {
        btn.classList.remove('pop');
        void btn.offsetWidth;
        btn.classList.add('pop');
        onCoin(Number(btn.dataset.v));
      }
    }));
    onPress(el.btnReset, live(onReset));
    onPress(el.btnChange, live(onGiveChange));
    el.tabBtns.forEach(b => onPress(b, e => { if (S && tutAllows(e)) setTab(b.dataset.tab); }));
    onPress(el.coachNext, onCoachNext);
    onPress(el.coachSkip, exitTutorial);

    el.btnStart.addEventListener('click', startGame);
    el.btnTutorial.addEventListener('click', startTutorial);
    el.btnMute.addEventListener('click', () => {
      Sfx.init();
      el.btnMute.textContent = Sfx.toggleMute() ? '🔇' : '🔊';
    });

    window.addEventListener('resize', updateSceneScale);
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => {
      if (!e.target.closest('.overlay')) e.preventDefault();
    }, { passive: false });
  }

  bind();
  preloadImages();
  S = newState();
  updateSceneScale();
  renderAll();
})();
