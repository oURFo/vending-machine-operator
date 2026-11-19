'use strict';

const DRINKS = [
  { id: 'maixiang',    name: '麥香紅茶', price: 10, hot: false },
  { id: 'wintermelon', name: '冬瓜茶',   price: 15, hot: false },
  { id: 'greentea',    name: '綠茶',     price: 20, hot: false },
  { id: 'soda',        name: '檸檬汽水', price: 25, hot: false },
  { id: 'milktea',     name: '鮮奶茶',   price: 25, hot: false },
  { id: 'coffee',      name: '罐裝咖啡', price: 30, hot: false },
  { id: 'cocoa',       name: '熱可可',   price: 35, hot: true },
  { id: 'cornsoup',    name: '玉米濃湯', price: 40, hot: true },
];

const DRINK_MAP = Object.fromEntries(DRINKS.map(d => [d.id, d]));
const HOT_DRINKS = DRINKS.filter(d => d.hot);
const CHEAP_DRINKS = DRINKS.filter(d => d.price <= 15);

const CHARACTERS = [1, 2, 3, 4];
const EXPRESSIONS = ['neutral', 'annoyed', 'confused', 'cold', 'furious', 'grin'];
const charSrc = (char, expr) => `assets/chars/c${char}_${expr}.webp`;

const REACTIONS = {
  perfect:   { face: 'neutral',  text: '',                cls: '' },
  wrong:     { face: 'confused', text: '這不是我按的…',   cls: 'confused' },
  unheated:  { face: 'cold',     text: '冰的？！',        cls: 'shiver' },
  tempWrong: { face: 'furious',  text: '怎麼是燙的？！',  cls: 'shiver' },
  short:     { face: 'furious',  text: '錢呢？！少找啦！', cls: 'pound' },
  over:      { face: 'grin',     text: '嘿嘿…賺到',       cls: 'sneak' },
  underpaid: { face: 'grin',     text: '錢沒投夠也給？讚啦～', cls: 'sneak' },
  eaten:     { face: 'furious',  text: '#@$%！吃錢喔！',  cls: 'kick' },
};

const GRADES = {
  S: { name: 'AI 級精算師', desc: '零客訴、零損失！店長：「你確定你不是機器？」獲得加薪肯定。' },
  A: { name: '資深機台長', desc: '極少失誤，順利過關。今天的你是可靠的販賣機。' },
  B: { name: '血汗工讀生', desc: '有部分客訴或小額虧損。店長口頭警告：「下次給我注意點。」' },
  C: { name: '賠償預備軍', desc: '客訴過多或虧損嚴重，這個月薪水直接扣光。' },
  F: { name: '解雇／社會新聞', desc: '公司已發出解雇通知，你的豐功偉業登上了新聞版面。' },
};

const NEWS = {
  eaten: {
    tag: '獨家',
    title: '街頭驚見「吸金黑洞」！惡質販賣機狂吞民眾血汗錢',
    sub: '民眾氣炸狂踹機台，消保官已介入調查，業者急切切割：已開除內部員工。',
    body: st => `據了解，該機台短短 3 分鐘內就「吃錢」${st.eaten} 次，現場民眾怒踹機台畫面曝光，網友笑稱：「投幣前請先拜拜。」`,
  },
  over: {
    tag: '奇聞',
    title: '佛心販賣機？買 10 元鋁箔包竟狂吐零錢，引爆排隊潮',
    sub: '網友戲稱「合法印鈔機」，台主單日慘賠，崩潰宣布即刻停機。',
    body: st => `統計該機台今日多吐出 $${st.overLoss} 元零錢，還有 ${st.underpaid} 人錢沒投夠照樣拿到飲料，有人笑說：「比發票中獎還快。」`,
  },
  pee: {
    tag: '荒唐',
    title: '販賣機人上班跑去尿尿！整排民眾苦等「無人機台」',
    sub: '機台內傳出沖水聲，業者澄清：員工狂喝庫存飲料「實在憋不住」。',
    body: st => `據了解，該員工上班期間偷喝 ${st.drank} 瓶庫存飲料，跑了 ${st.pee} 趟廁所，排隊民眾怒問：「機器也會尿急？」`,
  },
  unheated: {
    tag: '投訴',
    title: '買熱可可變冰沙？民眾怒批販賣機根本「詐騙集團」',
    sub: '寒風中想喝熱飲卻拿到冰塊，苦主怒嗆：裡面的人是不是睡著了？',
    body: st => `今日共有 ${st.unheated} 位民眾買熱飲卻拿到冰涼飲品，有苦主一口喝下當場發抖，揚言提告。`,
  },
  wrong: {
    tag: '傻眼',
    title: '盲盒販賣機？按咖啡掉綠茶，民眾痛批像在抽卡',
    sub: '想要什麼永遠買不到，民眾無奈表示「比手遊轉蛋還坑」。',
    body: st => `今日共 ${st.wrong} 人拿錯飲料，業者光是商品成本就賠了 $${st.wrongLoss} 元。`,
  },
  short: {
    tag: '爆料',
    title: '販賣機「黑吃黑」？硬幣永遠少找一枚，民眾拍機怒吼',
    sub: '苦主狂按退幣桿無效，網友嘆：「現在連機器都會坑錢。」',
    body: st => `今日共 ${st.short} 位民眾被少找錢，累計短少 $${st.shortAmount} 元，帳目異常已移送稽核。`,
  },
  perfect: {
    tag: '神技',
    title: '地表最快販賣機！出餐找零零失誤，網讚：比 AI 還強',
    sub: '業者驕傲表示機台運轉極度順暢，絕無壓榨勞工情事。',
    body: st => `該機台 3 分鐘內完美服務 ${st.perfect} 位顧客，零客訴、零損失。（記者走近時，機台內部隱約傳出喘氣聲）`,
  },
};
