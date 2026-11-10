/** Görevler: istatistik sayaçları save.quest.stats içinde; hedef dolunca ödül otomatik verilir. */
export const QUESTS = [
  { id: 'q_fish3', title: 'İlk Av', desc: '3 balık tut (olta ya da zıpkın)', stat: 'fish', goal: 3, reward: 60 },
  { id: 'q_run', title: 'Hızlı Adım', desc: '500 metre koş (Shift / Koş düğmesi)', stat: 'run', goal: 500, reward: 80 },
  { id: 'q_cook', title: 'Kamp Ateşi', desc: 'Bir balığı ateşte pişir', stat: 'cooked', goal: 1, reward: 70 },
  { id: 'q_rabbit', title: 'Tavşan Avcısı', desc: 'Yayınla 2 tavşan avla', stat: 'tavsan', goal: 2, reward: 90 },
  { id: 'q_fruit', title: 'Meyve Hasadı', desc: 'Ağaçlardan 12 meyve topla', stat: 'fruit', goal: 12, reward: 100 },
  { id: 'q_hill', title: 'Tepeye Çık', desc: 'Dağ yamacında 40 metre yüksekliğe ulaş', stat: 'alt', goal: 40, reward: 140 },
  { id: 'q_duck', title: 'Göl Ördeği', desc: '2 yaban ördeği avla', stat: 'ordek', goal: 2, reward: 110 },
  { id: 'q_spear', title: 'Zıpkıncı', desc: 'Dalışta zıpkınla 3 balık vur', stat: 'speared', goal: 3, reward: 150 },
  { id: 'q_gaz', title: 'Hızlı Av', desc: 'Bir ceylan avla', stat: 'ceylan', goal: 1, reward: 180 },
  { id: 'q_serve', title: 'Müşteri Memnuniyeti', desc: '3 müşteriye balık sat', stat: 'served', goal: 3, reward: 160 },
  { id: 'q_deer', title: 'Büyük Geyik', desc: 'Bir geyik avla (2 isabet gerekir)', stat: 'geyik', goal: 1, reward: 260 },
  { id: 'q_treasure', title: 'Hazine Avcısı', desc: 'Göl dibindeki hazine sandığını bul', stat: 'treasure', goal: 1, reward: 300 },
  { id: 'q_peak', title: 'Zirve', desc: 'Dağın zirvesine, 100 metreye tırman', stat: 'alt', goal: 100, reward: 400 },
  { id: 'q_fish15', title: 'Balık Ustası', desc: 'Toplam 15 balık tut', stat: 'fish', goal: 15, reward: 350 },
  { id: 'q_hunt10', title: 'Usta Avcı', desc: 'Toplam 10 hayvan avla', stat: 'hunt', goal: 10, reward: 450 },
];
export function createQuests({ save, onReward, onChange }) {
  const Q = save.quest = save.quest || { stats: {}, done: {} }; Q.stats = Q.stats || {}; Q.done = Q.done || {};
  const val = (q) => Math.min(q.goal, Math.floor(Q.stats[q.stat] || 0));
  function check() { for (const q of QUESTS) { if (!Q.done[q.id] && (Q.stats[q.stat] || 0) >= q.goal) { Q.done[q.id] = true; save.coins += q.reward; onReward && onReward(q); } } }
  return {
    add(stat, n = 1) { Q.stats[stat] = (Q.stats[stat] || 0) + n; const before = Object.keys(Q.done).length; check(); if (onChange) onChange(Object.keys(Q.done).length !== before); },
    max(stat, v) { if (v > (Q.stats[stat] || 0)) { Q.stats[stat] = v; const before = Object.keys(Q.done).length; check(); if (onChange) onChange(Object.keys(Q.done).length !== before); } },
    val, done: (q) => !!Q.done[q.id], active() { return QUESTS.find(q => !Q.done[q.id]) || null; },
    doneCount: () => QUESTS.filter(q => Q.done[q.id]).length, stats: Q.stats,
  };
}
