/* Mağaza kataloğu + ekonomi sabitleri */
export const BOATS = [
  { id: 0, name: 'Kürekli Kayık', price: 0, speed: 3.1, turn: 1.5, desc: 'Sakin, hafif, ilk teknen.' },
  { id: 1, name: 'Geniş Kayık', price: 900, speed: 4.3, turn: 1.3, desc: 'Daha uzun ve hızlı, uzun kürekler.' },
  { id: 2, name: 'Motorlu Tekne', price: 3200, speed: 7.2, turn: 1.05, desc: 'Dıştan motorlu, gölü saniyeler içinde geçer.' },
];
export const DOCK_LV = [
  { lv: 1, name: 'Kazıklı Kulübe', price: 0 },
  { lv: 2, name: 'Yenilenmiş İskele Evi', price: 450, desc: 'Daha geniş ev, sundurma, uzun iskele.' },
  { lv: 3, name: 'Göl Köşkü', price: 1400, desc: 'İki katlı köşk, geniş teras, tekne kulübesi.' },
];
export const ISLE_LV = [
  { lv: 1, name: 'Eski Yosunlu Kulübe', price: 0 },
  { lv: 2, name: 'Onarılmış Orman Evi', price: 300, desc: 'Yeni çatı ve duvarlar, sundurma, bacadan duman.' },
  { lv: 3, name: 'Büyük Orman Köşkü', price: 1100, desc: 'Geniş ev, çatı penceresi, odun deposu, ikinci baca.' },
];
const N = (id, name, price, extra = {}) => ({ id, name, price, ...extra });
export const WARDROBE = {
  hat: { title: 'Şapka', items: [N('safari', 'Safari Hasır', 0, { c: '#cfae62' }), N('bucket', 'Krem Balıkçı Şapkası', 0, { c: '#eadfc2' }), N('cap', 'Kasket', 80, { c: '#2f5d7a' }), N('beanie', 'Bere', 70, { c: '#b2402e' }), N('none', 'Şapkasız', 0)] },
  jacket: { title: 'Ceket', items: [N('shirt', 'Açık Mavi Gömlek', 0, { c: '#8fb6e6' }), N('ochre', 'Hardal Muşamba', 0, { c: '#c8923a' }), N('forest', 'Orman Yeşili', 140, { c: '#4d6b3a' }), N('red', 'Kızıl Kırmızı', 150, { c: '#b2402e' }), N('navy', 'Lacivert', 150, { c: '#2f4a73' }), N('grey', 'Kül Grisi', 120, { c: '#7d8084' })] },
  pants: { title: 'Pantolon', items: [N('cargo', 'Bej Kargo', 0, { c: '#d4c08e' }), N('denim', 'Kot', 0, { c: '#2f4a73' }), N('khaki', 'Haki', 90, { c: '#8a7c54' }), N('black', 'Siyah', 90, { c: '#2a2a2c' }), N('olive', 'Zeytin', 100, { c: '#4d5a32' })] },
  boots: { title: 'Bot', items: [N('brown', 'Kahverengi Bot', 0, { c: '#7a5a3c' }), N('black', 'Siyah Bot', 60, { c: '#232323' }), N('green', 'Yeşil Lastik Bot', 110, { c: '#2f5d3a' }), N('yellow', 'Sarı Lastik Bot', 140, { c: '#d9b02a' })] },
  pack: { title: 'Sırt Çantası', items: [N('olive', 'Zeytin', 0, { c: '#566238' }), N('red', 'Kırmızı', 90, { c: '#a8392c' }), N('blue', 'Mavi', 90, { c: '#2f5d8a' }), N('tan', 'Kum', 80, { c: '#a88a5a' })] },
  scarf: { title: 'Atkı', items: [N('none', 'Yok', 0), N('red', 'Kırmızı Atkı', 110, { c: '#b2402e' }), N('mustard', 'Hardal Atkı', 110, { c: '#d9a02a' }), N('teal', 'Petrol Atkı', 110, { c: '#2f7a7a' })] },
  glasses: { title: 'Gözlük', items: [N('none', 'Yok', 0), N('sun', 'Güneş Gözlüğü', 200)] },
  vest: { title: 'Yelek', items: [N('olive', 'Zeytin Balıkçı Yeleği', 0, { c: '#8a8a4c' }), N('none', 'Yok', 0), N('khaki', 'Haki Balıkçı Yeleği', 250, { c: '#8a7c54' }), N('orange', 'Turuncu Can Yeleği', 300, { c: '#e0652a' })] },
};
export const DEFAULT_OUTFIT = { hat: 'bucket', jacket: 'shirt', pants: 'cargo', boots: 'brown', pack: 'olive', scarf: 'none', glasses: 'none', vest: 'olive' };
export const BASKET_MAX = 24;
export const SELL = { stall: 0.78, chest: 0.5, customer: 1.55, cookedMul: 1.8 };
export const colorOf = (grp, id) => { const it = WARDROBE[grp].items.find(i => i.id === id); return it && it.c; };

export const FRUITS = {
  elma: { id: 'elma', name: 'Elma', price: 14, c: '#d8362f', leaf: '#5aa63f' },
  armut: { id: 'armut', name: 'Armut', price: 16, c: '#c3cf4a', leaf: '#6bae44' },
  erik: { id: 'erik', name: 'Erik', price: 18, c: '#6b2f86', leaf: '#4c9a3c' },
  seftali: { id: 'seftali', name: 'Şeftali', price: 20, c: '#f2a15a', leaf: '#5fae48' },
};
export const FRUIT_MAX = 60; // çantadaki toplam meyve sınırı

/* Av hayvanları (yayla avlanır, tezgahta / sandıkta satılır) */
export const GAME = {
  tavsan: { id: 'tavsan', name: 'Tavşan', price: 48, c: '#a89882' },
  ordek: { id: 'ordek', name: 'Yaban Ördeği', price: 62, c: '#1f6a4a' },
  ceylan: { id: 'ceylan', name: 'Ceylan', price: 150, c: '#d0a36a' },
  geyik: { id: 'geyik', name: 'Geyik', price: 230, c: '#a7764a' },
};
export const GAME_MAX = 12; // av çantası kapasitesi
