// ============================================================
//  WECODE — TAM OYUN MOTORU
//  3 Mod: Bilgisayara Karşı | Otomatik Eşleşme | Özel Oda
// ============================================================

const BOYUT = 8;
const TAS = {
  wecode: { sembol: 'W', etiket: 'WECODE'   },
  carpi:  { sembol: '✕', etiket: 'Çarpı'    },
  ileri:  { sembol: '↑', etiket: 'İleri ok' },
  sola:   { sembol: '←', etiket: 'Sola dön' },
  saga:   { sembol: '→', etiket: 'Sağa dön' },
};
const YON_DELTA = {
  ileri: { ds: -1, dk: 0 },
  sola:  { ds: 0,  dk: -1 },
  saga:  { ds: 0,  dk: 1  },
};

// ---- OYUN DURUMU ----
let G = {
  tahta: [], piyon: {}, wecode: {}, el: {},
  aktif: 1, faz: 'baslangic', baslangicSira: 1,
  secili: null, bitti: false,
  ad: { 1: 'Oyuncu 1', 2: 'Oyuncu 2' },
};

// ---- MOD DEĞİŞKENLERİ ----
let mod = null;          // 'bilgisayar' | 'esleme' | 'ozel'
let yzSeviye = 'orta';  // 'kolay' | 'orta' | 'zor'
let benimNumaram = 1;
let beniminSiram = true;
let socket = null;
let odaKodum = null;
let eslemeKuyrukta = false;

// ============================================================
//  MOD SEÇİMİ
// ============================================================
function modSec(secilen) {
  const ad = document.getElementById('giris-isim').value.trim();
  if (!ad) { toast('Önce adını gir!'); document.getElementById('giris-isim').focus(); return; }

  mod = secilen;
  if (mod === 'bilgisayar') {
    ekranGoster('ekran-seviye');
  } else if (mod === 'ozel') {
    ekranGoster('ekran-ozel');
  } else if (mod === 'esleme') {
    eslemeBaslat();
  }
}

function bilgisayarOyunuBaslat(seviye) {
  yzSeviye = seviye;
  const ad = document.getElementById('giris-isim').value.trim() || 'Oyuncu';
  benimNumaram = 1;
  beniminSiram = true;
  G.ad[1] = ad;
  G.ad[2] = seviyeAdi(seviye) + ' 🤖';
  _oyunuKur();
  ekranGoster('ekran-oyun');
  toast(`${ad} vs Bilgisayar (${seviyeAdi(seviye)}) — Oyun başladı!`);
}

function seviyeAdi(s) {
  return s === 'kolay' ? 'Kolay Bot' : s === 'orta' ? 'Orta Bot' : 'Zor Bot';
}

// ============================================================
//  SOCKET.IO BAĞLANTISI
// ============================================================
function baglantiKur() {
  if (socket && socket.connected) return;

  socket = io({
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 30000,
  });

  socket.on('connect', () => {
    console.log('Bağlantı kuruldu:', socket.id);
  });

  socket.on('oda_olusturuldu', ({ odaKodu, oyuncuNumarasi }) => {
    odaKodum = odaKodu;
    benimNumaram = oyuncuNumarasi;
    document.getElementById('oda-kodu-goster').textContent = odaKodu;
    ekranGoster('ekran-bekleme');
  });

  socket.on('odaya_katilindi', ({ odaKodu, oyuncuNumarasi, rakipAdi }) => {
    odaKodum = odaKodu;
    benimNumaram = oyuncuNumarasi;
  });

  socket.on('oyun_basladi', ({ oyuncu1Adi, oyuncu2Adi }) => {
    G.ad[1] = oyuncu1Adi;
    G.ad[2] = oyuncu2Adi;
    benimNumaram = benimNumaram;
    _oyunuKur();
    ekranGoster('ekran-oyun');
    toast(benimNumaram === 1 ? 'Oyun başladı! Sıra sende.' : 'Oyun başladı! Rakip başlıyor...');
  });

  socket.on('esleme_bekleniyor', () => {
    ekranGoster('ekran-esleme');
    eslemeKuyrukta = true;
  });

  socket.on('rakip_hamle', ({ hamleTipi, veri }) => {
    rakipHamleUygula(hamleTipi, veri);
  });

  socket.on('oyun_bitti_bildir', ({ kazananNumara }) => {
    G.bitti = true;
    guncelle();
    _kazanEkraniGoster(kazananNumara);
  });

  socket.on('oyun_sifirla', () => {
    _oyunuKur();
    ekranGoster('ekran-oyun');
    toast('Yeni oyun başladı!');
  });

  socket.on('rakip_ayrildi', () => {
    document.getElementById('baglanti-bandi').classList.remove('gizli');
    G.bitti = true;
    guncelle();
  });

  socket.on('hata', ({ mesaj }) => {
    toast('❌ ' + mesaj);
  });
}

// ============================================================
//  ODA İŞLEMLERİ
// ============================================================
function odaOlustur() {
  const ad = document.getElementById('giris-isim').value.trim();
  if (!ad) { toast('Önce adını gir!'); return; }
  baglantiKur();
  setTimeout(() => socket.emit('oda_olustur', { oyuncuAdi: ad }), 300);
}

function odayaKatil() {
  const ad  = document.getElementById('giris-isim').value.trim();
  const kod = document.getElementById('oda-kodu-input').value.trim().toUpperCase();
  if (!ad)  { toast('Önce adını gir!'); return; }
  if (!kod) { toast('Oda kodunu gir!'); return; }
  baglantiKur();
  setTimeout(() => socket.emit('odaya_katil', { odaKodu: kod, oyuncuAdi: ad }), 300);
}

function koduKopyala() {
  const kod = document.getElementById('oda-kodu-goster').textContent;
  navigator.clipboard.writeText(kod).then(() => toast('Kod kopyalandı! ✅'));
}

function eslemeBaslat() {
  const ad = document.getElementById('giris-isim').value.trim();
  if (!ad) { toast('Önce adını gir!'); return; }
  baglantiKur();
  ekranGoster('ekran-esleme');
  setTimeout(() => socket.emit('esleme_katil', { oyuncuAdi: ad }), 300);
}

function eslemeIptal() {
  if (socket) socket.emit('esleme_ayril');
  eslemeKuyrukta = false;
  ekranGoster('ekran-menu');
}

// ============================================================
//  OYUN KURULUMU
// ============================================================
function _oyunuKur() {
  G.aktif = 1;
  G.faz = 'baslangic';
  G.baslangicSira = 1;
  G.secili = null;
  G.bitti = false;
  G.piyon = {};
  G.wecode = {};
  G.tahta = Array.from({ length: BOYUT }, () => Array(BOYUT).fill(null));
  G.el = {
    1: { carpi: 3, ileri: 3, sola: 2, saga: 2 },
    2: { carpi: 3, ileri: 3, sola: 2, saga: 2 },
  };

  beniminSiram = (benimNumaram === 1);

  document.getElementById('adi-oyuncu1').textContent = G.ad[1];
  document.getElementById('adi-oyuncu2').textContent = G.ad[2];
  document.getElementById('baglanti-bandi').classList.add('gizli');

  tahtaOlustur();
  guncelle();

  // Bilgisayar modunda başlangıç mesajı
  if (mod === 'bilgisayar') {
    toast(`${G.ad[1]}: En alt satıra WECODE taşını koy ⭐`);
  }
}

// ============================================================
//  TAHTA
// ============================================================
function tahtaOlustur() {
  const el = document.getElementById('tahta');
  el.innerHTML = '';
  el.style.gridTemplateColumns = `repeat(${BOYUT}, 1fr)`;
  el.style.gridTemplateRows    = `repeat(${BOYUT}, 1fr)`;
  for (let s = 0; s < BOYUT; s++) {
    for (let k = 0; k < BOYUT; k++) {
      const div = document.createElement('div');
      div.className = 'kare';
      div.dataset.satir = s;
      div.dataset.sutun = k;
      if (s === BOYUT - 1) div.classList.add('satir-oyuncu1');
      if (s === 0)         div.classList.add('satir-oyuncu2');
      div.addEventListener('click', () => kareClick(s, k));
      el.appendChild(div);
    }
  }
}

// ============================================================
//  TIKLAMA YÖNLENDİRİCİ
// ============================================================
function kareClick(s, k) {
  if (G.bitti) return;
  if (!beniminSiram) { toast('Şu an rakibinin sırası!'); return; }
  if (G.faz === 'baslangic') { baslangicClick(s, k); }
  else if (G.secili)          { tasKoyClick(s, k); }
  else                        { piyonClick(s, k); }
}

// ============================================================
//  BAŞLANGIÇ
// ============================================================
function baslangicClick(s, k) {
  const o = G.baslangicSira;
  if (o !== benimNumaram) { toast('Şu an rakibinin sırası!'); return; }

  const beklenenSatir = o === 1 ? BOYUT - 1 : 0;
  if (s !== beklenenSatir) {
    toast(`Sadece ${o === 1 ? 'EN ALT' : 'EN ÜST'} satıra koyabilirsin!`);
    sesSal('ses-hata'); return;
  }
  if (G.tahta[s][k] !== null) { toast('Bu kare dolu!'); sesSal('ses-hata'); return; }

  _baslangicUygula(s, k, o);
  _sunucuyaGonder('baslangic', { s, k, oyuncu: o });
}

function _baslangicUygula(s, k, o) {
  G.tahta[s][k] = { tip: 'wecode', oyuncu: o };
  G.wecode[o] = { s, k };
  G.piyon[o] = { s, k };
  sesSal('ses-tas-koy');

  if (G.baslangicSira === 1) {
    G.baslangicSira = 2;
    G.aktif = 2;
    const sonrakiOyuncu = 2;
    beniminSiram = (benimNumaram === sonrakiOyuncu);

    if (mod === 'bilgisayar') {
      beniminSiram = false;
      guncelle();
      setTimeout(() => _yzBaslangic(), 800);
    } else {
      const mesaj = beniminSiram
        ? 'Şimdi sen koy! En üst satıra WECODE taşını yerleştir ⭐'
        : 'Rakip yerleştiriyor...';
      guncelle();
      toast(mesaj);
    }
  } else {
    G.faz = 'oyun';
    G.aktif = 1;
    beniminSiram = (benimNumaram === 1);
    guncelle();
    if (mod === 'bilgisayar') {
      beniminSiram = true;
      toast('Oyun başladı! Sıra sende.');
    } else {
      toast(beniminSiram ? '✅ Oyun başladı! Sıra sende.' : '⏳ Oyun başladı! Rakip hamle yapıyor...');
    }
    guncelle();
  }
}

// ============================================================
//  PİYON HAREKETİ
// ============================================================
function piyonClick(s, k) {
  const o = G.aktif;
  const p = G.piyon[o];
  if (!p) return;

  const ds = s - p.s, dk = k - p.k;
  const aS = Math.abs(ds), aK = Math.abs(dk);
  if (aS === 0 && aK === 0) return;
  if (aS > 1 || aK > 1) { toast('Sadece 1 adım gidebilirsin!'); return; }

  if (aS === 1 && aK === 1) {
    if (!caprazGecerliMi(p.s, p.k)) {
      toast('Çapraz hareket koşulları sağlanmıyor!'); sesSal('ses-hata'); return;
    }
  }

  const hedef = G.tahta[s][k];
  const r = o === 1 ? 2 : 1;

  if (hedef && hedef.tip === 'carpi') { toast('Çarpı taşı! Oradan geçemezsin ✕'); sesSal('ses-hata'); return; }

  if (hedef && hedef.tip === 'piyon' && hedef.oyuncu === r) {
    karsilasmaYonet(p.s, p.k, s, k); return;
  }

  if (hedef && hedef.tip === 'wecode' && hedef.oyuncu === r) {
    _piyonTasiUygula(p.s, p.k, s, k, o);
    _sunucuyaGonder('piyon', { eskiS: p.s, eskiK: p.k, yeniS: s, yeniK: k, oyuncu: o });
    _kazanBildir(o); return;
  }

  if (hedef !== null && hedef.tip !== 'wecode') { toast('Bu kare dolu!'); sesSal('ses-hata'); return; }

  _piyonTasiUygula(p.s, p.k, s, k, o);
  _sunucuyaGonder('piyon', { eskiS: p.s, eskiK: p.k, yeniS: s, yeniK: k, oyuncu: o });
}

function _piyonTasiUygula(eskiS, eskiK, yeniS, yeniK, o) {
  const r = o === 1 ? 2 : 1;
  const wcO = G.wecode[o];
  if (wcO && wcO.s === eskiS && wcO.k === eskiK) {
    G.tahta[eskiS][eskiK] = { tip: 'wecode', oyuncu: o };
  } else {
    G.tahta[eskiS][eskiK] = null;
  }
  G.tahta[yeniS][yeniK] = { tip: 'piyon', oyuncu: o };
  G.piyon[o] = { s: yeniS, k: yeniK };
  sesSal('ses-piyon-hareket');

  const wcR = G.wecode[r];
  if (wcR && wcR.s === yeniS && wcR.k === yeniK) { _kazanBildir(o); return; }
  _siraGecir();
}

// ============================================================
//  KARŞILAŞMA
// ============================================================
function karsilasmaYonet(pS, pK, rS, rK) {
  const o = G.aktif, r = o === 1 ? 2 : 1;
  const ds = rS - pS, dk = rK - pK;
  const arkaS = rS + ds, arkaK = rK + dk;
  const arkaGecerli = arkaS >= 0 && arkaS < BOYUT && arkaK >= 0 && arkaK < BOYUT;
  const arkaH = arkaGecerli ? G.tahta[arkaS][arkaK] : null;
  const arkaBosMu = arkaGecerli && (!arkaH || (arkaH.tip === 'wecode' && arkaH.oyuncu === r));

  if (arkaBosMu) {
    sesSal('ses-karsilasma');
    toast('Rakibin üstünden atladın! 🦘');
    _piyonTasiUygula(pS, pK, arkaS, arkaK, o);
    _sunucuyaGonder('piyon', { eskiS: pS, eskiK: pK, yeniS: arkaS, yeniK: arkaK, oyuncu: o });
    return;
  }
  if (caprazGecerliMi(pS, pK)) {
    toast('Karşılaşma! Çapraz gidebilirsin — köşe kareye tıkla!'); guncelle(); return;
  }
  toast('Karşılaşma! Yana git veya geri çekil.'); guncelle();
}

function caprazGecerliMi(s, k) {
  const o = G.aktif, r = o === 1 ? 2 : 1;
  const rp = G.piyon[r];
  if (!rp) return false;
  const ds = rp.s - s, dk = rp.k - k;
  if (!((Math.abs(ds) === 1 && dk === 0) || (ds === 0 && Math.abs(dk) === 1))) return false;
  let yanlar = ds !== 0 ? [{ ds:0,dk:-1},{ds:0,dk:1}] : [{ds:-1,dk:0},{ds:1,dk:0}];
  let dolu = 0;
  for (const y of yanlar) {
    const ys = s+y.ds, yk = k+y.dk;
    if (ys<0||ys>=BOYUT||yk<0||yk>=BOYUT) { dolu++; continue; }
    if (G.tahta[ys][yk] !== null) dolu++;
  }
  if (dolu < 2) return false;
  const aS = rp.s+ds, aK = rp.k+dk;
  if (aS<0||aS>=BOYUT||aK<0||aK>=BOYUT) return true;
  return G.tahta[aS][aK] !== null;
}

// ============================================================
//  TAŞ KOYMA
// ============================================================
function tasKoyClick(s, k) {
  const o = G.aktif, r = o === 1 ? 2 : 1;
  const tip = G.secili;
  if ((G.el[o][tip] ?? 0) <= 0) { toast('Bu taştan kalmadı!'); return; }

  if (tip === 'carpi') {
    if (G.tahta[s][k] !== null) { toast('Bu kare dolu!'); sesSal('ses-hata'); return; }
    if (!karpiGuvenlimi(s, k)) return;
    G.tahta[s][k] = { tip: 'carpi', oyuncu: o };
    G.el[o].carpi--;
    sesSal('ses-tas-koy');
    _sunucuyaGonder('carpi', { s, k, oyuncu: o });
    G.secili = null;
    _siraGecir(); return;
  }

  if (tip === 'ileri' || tip === 'sola' || tip === 'saga') {
    const rp = G.piyon[r];
    if (!rp) { toast('Rakibin piyonu yok!'); return; }
    const ds = Math.abs(s-rp.s), dk = Math.abs(k-rp.k);
    if (!((ds===1&&dk===0)||(ds===0&&dk===1))) {
      toast('Yön taşını sadece rakip piyonun bitişiğine koy! (ön/arka/sağ/sol)');
      sesSal('ses-hata'); return;
    }
    if (G.tahta[s][k] !== null) { toast('Bu kare dolu!'); sesSal('ses-hata'); return; }

    const delta = YON_DELTA[tip];
    const yeniS = rp.s + delta.ds, yeniK = rp.k + delta.dk;
    if (yeniS<0||yeniS>=BOYUT||yeniK<0||yeniK>=BOYUT) {
      toast('Rakip tahtadan çıkıyor! Geçersiz.'); sesSal('ses-hata'); return;
    }
    const hedefH = G.tahta[yeniS][yeniK];
    if (hedefH !== null && hedefH.tip !== 'wecode') {
      toast('Gideceği kare dolu! Geçersiz.'); sesSal('ses-hata'); return;
    }

    G.tahta[s][k] = { tip, oyuncu: o };
    G.el[o][tip]--;
    const wcR = G.wecode[r];
    if (wcR && wcR.s===rp.s && wcR.k===rp.k) {
      G.tahta[rp.s][rp.k] = { tip:'wecode', oyuncu:r };
    } else {
      G.tahta[rp.s][rp.k] = null;
    }
    G.tahta[yeniS][yeniK] = { tip:'piyon', oyuncu:r };
    G.piyon[r] = { s:yeniS, k:yeniK };
    sesSal('ses-karsilasma');

    _sunucuyaGonder('yon', {
      tasS:s, tasK:k, tip, oyuncu:o,
      rakipEskiS:rp.s, rakipEskiK:rp.k,
      rakipYeniS:yeniS, rakipYeniK:yeniK, rakip:r
    });

    const wcO = G.wecode[o];
    if (wcO && wcO.s===yeniS && wcO.k===yeniK) { _kazanBildir(r); return; }
    G.secili = null;
    _siraGecir();
  }
}

function karpiGuvenlimi(s, k) {
  G.tahta[s][k] = { tip:'carpi', oyuncu:0 };
  for (const o of [1,2]) {
    const wc = G.wecode[o];
    if (wc && !etrafBosMu(wc.s, wc.k)) {
      G.tahta[s][k] = null;
      toast('WECODE taşının etrafı kapanamaz!'); sesSal('ses-hata'); return false;
    }
    const p = G.piyon[o];
    if (p) {
      const r = o===1?2:1;
      const wR = G.wecode[r];
      if (wR && !bfsVarMi(p.s, p.k, wR.s, wR.k)) {
        G.tahta[s][k] = null;
        toast('Bu taşı koyarsan piyon hapsolur!'); sesSal('ses-hata'); return false;
      }
    }
  }
  G.tahta[s][k] = null; return true;
}

function etrafBosMu(s, k) {
  for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const ns=s+ds, nk=k+dk;
    if (ns<0||ns>=BOYUT||nk<0||nk>=BOYUT) continue;
    const h=G.tahta[ns][nk];
    if (!h||h.tip==='piyon'||h.tip==='wecode') return true;
  }
  return false;
}

function bfsVarMi(bS,bK,hS,hK) {
  const z=Array.from({length:BOYUT},()=>Array(BOYUT).fill(false));
  const q=[{s:bS,k:bK}]; z[bS][bK]=true;
  while(q.length){
    const{s,k}=q.shift();
    if(s===hS&&k===hK) return true;
    for(const[ds,dk] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const ns=s+ds,nk=k+dk;
      if(ns<0||ns>=BOYUT||nk<0||nk>=BOYUT||z[ns][nk]) continue;
      const h=G.tahta[ns][nk];
      if(h&&h.tip==='carpi') continue;
      z[ns][nk]=true; q.push({s:ns,k:nk});
    }
  }
  return false;
}

// ============================================================
//  SIRA GEÇİŞİ
// ============================================================
function _siraGecir() {
  G.aktif = G.aktif === 1 ? 2 : 1;
  G.secili = null;
  beniminSiram = (G.aktif === benimNumaram);
  guncelle();

  if (mod === 'bilgisayar' && G.aktif === 2 && !G.bitti) {
    beniminSiram = false;
    guncelle();
    setTimeout(() => _yzHamleYap(), 700 + Math.random() * 600);
  } else if (mod !== 'bilgisayar') {
    toast(beniminSiram ? '✅ Sıra sende!' : '⏳ Rakibinin sırası...');
  }
}

// ============================================================
//  YZ (BİLGİSAYAR) MOTORU
// ============================================================

function _yzBaslangic() {
  // YZ oyuncu 2 — en üst satıra rastgele koy
  const bos = [];
  for (let k = 0; k < BOYUT; k++) {
    if (G.tahta[0][k] === null) bos.push(k);
  }
  const k = bos[Math.floor(Math.random() * bos.length)];
  _baslangicUygula(0, k, 2);
}

function _yzHamleYap() {
  if (G.bitti || G.aktif !== 2) return;

  let hamle = null;

  if (yzSeviye === 'kolay') {
    hamle = _yzKolayHamle();
  } else if (yzSeviye === 'orta') {
    hamle = _yzOrtaHamle();
  } else {
    hamle = _yzZorHamle();
  }

  if (!hamle) hamle = _yzKolayHamle();
  if (!hamle) return;

  _yzHamleUygula(hamle);
  beniminSiram = true;
}

function _yzKolayHamle() {
  // Rastgele geçerli piyon hamlesi veya taş koyma
  const hamleler = _tumGecerliHamleler(2);
  if (!hamleler.length) return null;
  return hamleler[Math.floor(Math.random() * hamleler.length)];
}

function _yzOrtaHamle() {
  // Önce kazanma fırsatı ara, sonra tehlikeyi engelle, yoksa iyi hamle yap
  const hamleler = _tumGecerliHamleler(2);
  if (!hamleler.length) return null;

  // Kazanma hamlesi var mı?
  for (const h of hamleler) {
    if (_hamleKazandirirMi(h, 2)) return h;
  }

  // Rakibi (oyuncu 1) engelle
  const tehlike = _enTehlikeliHamle(1);
  if (tehlike) return tehlike;

  // En iyi pozisyona git
  let enIyi = null, enIyiSkor = -999;
  for (const h of hamleler) {
    const skor = _hamleSkorla(h, 2);
    if (skor > enIyiSkor) { enIyiSkor = skor; enIyi = h; }
  }
  return enIyi;
}

function _yzZorHamle() {
  // Minimax benzeri 2 adım ileriye bak
  const hamleler = _tumGecerliHamleler(2);
  if (!hamleler.length) return null;

  let enIyi = null, enIyiSkor = -999;
  for (const h of hamleler) {
    const skor = _minimax(h, 2, 2);
    if (skor > enIyiSkor) { enIyiSkor = skor; enIyi = h; }
  }
  return enIyi;
}

function _minimax(hamle, oyuncu, derinlik) {
  // Hamleyi geçici uygula
  const yedek = JSON.parse(JSON.stringify({ tahta: G.tahta, piyon: G.piyon, el: G.el }));
  _hamleGeciciUygula(hamle, oyuncu);

  let skor = _pozisyonSkorla(2);

  if (derinlik > 1 && !G.bitti) {
    const rakip = oyuncu === 1 ? 2 : 1;
    const rakipHamleleri = _tumGecerliHamleler(rakip);
    if (rakipHamleleri.length > 0) {
      let enKotuRakip = 999;
      for (const rh of rakipHamleleri.slice(0, 5)) {
        const rs = _minimax(rh, rakip, derinlik - 1);
        if (rs < enKotuRakip) enKotuRakip = rs;
      }
      skor = skor - enKotuRakip * 0.5;
    }
  }

  // Geri al
  G.tahta = yedek.tahta;
  G.piyon = yedek.piyon;
  G.el = yedek.el;

  return skor;
}

function _tumGecerliHamleler(o) {
  const hamleler = [];
  const p = G.piyon[o];
  if (!p) return hamleler;

  // Piyon hareketleri
  for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
    const ns = p.s+ds, nk = p.k+dk;
    if (ns<0||ns>=BOYUT||nk<0||nk>=BOYUT) continue;
    if (Math.abs(ds)===1&&Math.abs(dk)===1) {
      const oncekiAktif = G.aktif;
      G.aktif = o;
      const gecerli = caprazGecerliMi(p.s, p.k);
      G.aktif = oncekiAktif;
      if (!gecerli) continue;
    }
    const h = G.tahta[ns][nk];
    if (h && h.tip === 'carpi') continue;
    if (h && h.tip === 'piyon' && h.oyuncu === o) continue;
    hamleler.push({ tip: 'piyon', s: ns, k: nk });
  }

  // Taş koyma hareketleri
  const r = o === 1 ? 2 : 1;
  const rp = G.piyon[r];

  // Çarpı taşı
  if ((G.el[o].carpi ?? 0) > 0) {
    for (let s=0; s<BOYUT; s++) for (let k=0; k<BOYUT; k++) {
      if (G.tahta[s][k] === null) {
        G.tahta[s][k] = { tip:'carpi', oyuncu:0 };
        let guvenli = true;
        for (const oo of [1,2]) {
          const wc = G.wecode[oo];
          if (wc && !etrafBosMu(wc.s, wc.k)) { guvenli = false; break; }
          const pp = G.piyon[oo];
          if (pp) {
            const rr = oo===1?2:1;
            const wR = G.wecode[rr];
            if (wR && !bfsVarMi(pp.s,pp.k,wR.s,wR.k)) { guvenli = false; break; }
          }
        }
        G.tahta[s][k] = null;
        if (guvenli) hamleler.push({ tip:'tas', tasTip:'carpi', s, k });
      }
    }
  }

  // Yön taşları
  for (const tasTip of ['ileri','sola','saga']) {
    if ((G.el[o][tasTip] ?? 0) <= 0) continue;
    if (!rp) continue;
    for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const ts = rp.s+ds, tk = rp.k+dk;
      if (ts<0||ts>=BOYUT||tk<0||tk>=BOYUT) continue;
      if (G.tahta[ts][tk] !== null) continue;
      const delta = YON_DELTA[tasTip];
      const yeniS = rp.s+delta.ds, yeniK = rp.k+delta.dk;
      if (yeniS<0||yeniS>=BOYUT||yeniK<0||yeniK>=BOYUT) continue;
      const hedefH = G.tahta[yeniS][yeniK];
      if (hedefH !== null && hedefH.tip !== 'wecode') continue;
      hamleler.push({ tip:'tas', tasTip, tasS:ts, tasK:tk, yeniS, yeniK });
    }
  }

  return hamleler;
}

function _hamleKazandirirMi(hamle, o) {
  const r = o === 1 ? 2 : 1;
  const wcR = G.wecode[r];
  if (!wcR) return false;
  if (hamle.tip === 'piyon') {
    return hamle.s === wcR.s && hamle.k === wcR.k;
  }
  if (hamle.tip === 'tas' && (hamle.tasTip==='ileri'||hamle.tasTip==='sola'||hamle.tasTip==='saga')) {
    const wcO = G.wecode[o];
    return wcO && hamle.yeniS===wcO.s && hamle.yeniK===wcO.k;
  }
  return false;
}

function _enTehlikeliHamle(rakip) {
  // Rakibin kazanma hamlesini engelle
  const r = rakip === 1 ? 2 : 1;
  const wcR = G.wecode[r];
  if (!wcR) return null;
  const rp = G.piyon[rakip];
  if (!rp) return null;

  // Rakip 1 adımda kazanabilir mi?
  for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const ns=rp.s+ds, nk=rp.k+dk;
    if (ns===wcR.s && nk===wcR.k) {
      // Oraya çarpı koyabilir miyiz?
      const hamleler = _tumGecerliHamleler(2);
      for (const h of hamleler) {
        if (h.tip==='tas' && h.tasTip==='carpi' && h.s===ns && h.k===nk) return h;
      }
    }
  }
  return null;
}

function _hamleSkorla(hamle, o) {
  const r = o === 1 ? 2 : 1;
  const wcR = G.wecode[r];
  const wcO = G.wecode[o];
  const p = G.piyon[o];
  const rp = G.piyon[r];
  if (!wcR || !p) return 0;

  let skor = 0;

  if (hamle.tip === 'piyon') {
    // Rakibin wecode'una yaklaşıyor mu?
    const eskiMesafe = Math.abs(p.s-wcR.s) + Math.abs(p.k-wcR.k);
    const yeniMesafe = Math.abs(hamle.s-wcR.s) + Math.abs(hamle.k-wcR.k);
    skor += (eskiMesafe - yeniMesafe) * 10;
  }

  if (hamle.tip === 'tas' && hamle.tasTip === 'carpi' && rp) {
    // Rakibi yoldan uzaklaştırıyor mu?
    const wcRakipWecode = G.wecode[r];
    if (wcRakipWecode) {
      const rMesafe = Math.abs(rp.s-wcRakipWecode.s) + Math.abs(rp.k-wcRakipWecode.k);
      if (hamle.s >= Math.min(rp.s, wcRakipWecode.s) && hamle.s <= Math.max(rp.s, wcRakipWecode.s)) skor += 5;
    }
  }

  return skor + Math.random() * 2;
}

function _pozisyonSkorla(o) {
  const r = o === 1 ? 2 : 1;
  const wcR = G.wecode[r];
  const p = G.piyon[o];
  const rp = G.piyon[r];
  if (!wcR || !p) return 0;

  const bizimMesafe = Math.abs(p.s-wcR.s) + Math.abs(p.k-wcR.k);
  const wcO = G.wecode[o];
  const rakipMesafe = (rp && wcO) ? Math.abs(rp.s-wcO.s) + Math.abs(rp.k-wcO.k) : 8;

  return (rakipMesafe - bizimMesafe) * 5;
}

function _hamleGeciciUygula(hamle, o) {
  const r = o === 1 ? 2 : 1;
  if (hamle.tip === 'piyon') {
    const p = G.piyon[o];
    if (!p) return;
    const wcO = G.wecode[o];
    if (wcO && wcO.s===p.s && wcO.k===p.k) {
      G.tahta[p.s][p.k] = { tip:'wecode', oyuncu:o };
    } else {
      G.tahta[p.s][p.k] = null;
    }
    G.tahta[hamle.s][hamle.k] = { tip:'piyon', oyuncu:o };
    G.piyon[o] = { s:hamle.s, k:hamle.k };
  } else if (hamle.tip === 'tas') {
    if (hamle.tasTip === 'carpi') {
      G.tahta[hamle.s][hamle.k] = { tip:'carpi', oyuncu:o };
      G.el[o].carpi--;
    } else {
      G.tahta[hamle.tasS][hamle.tasK] = { tip:hamle.tasTip, oyuncu:o };
      G.el[o][hamle.tasTip]--;
      const rp = G.piyon[r];
      if (rp) {
        const wcR = G.wecode[r];
        if (wcR && wcR.s===rp.s && wcR.k===rp.k) {
          G.tahta[rp.s][rp.k] = { tip:'wecode', oyuncu:r };
        } else {
          G.tahta[rp.s][rp.k] = null;
        }
        G.tahta[hamle.yeniS][hamle.yeniK] = { tip:'piyon', oyuncu:r };
        G.piyon[r] = { s:hamle.yeniS, k:hamle.yeniK };
      }
    }
  }
}

function _yzHamleUygula(hamle) {
  const o = 2, r = 1;
  if (hamle.tip === 'piyon') {
    const p = G.piyon[o];
    if (!p) return;
    const wcR = G.wecode[r];
    if (wcR && wcR.s===hamle.s && wcR.k===hamle.k) {
      _piyonTasiUygula(p.s, p.k, hamle.s, hamle.k, o);
      _kazanBildir(o); return;
    }
    _piyonTasiUygula(p.s, p.k, hamle.s, hamle.k, o);
  } else if (hamle.tip === 'tas') {
    if (hamle.tasTip === 'carpi') {
      G.tahta[hamle.s][hamle.k] = { tip:'carpi', oyuncu:o };
      G.el[o].carpi--;
      sesSal('ses-tas-koy');
      _siraGecir();
    } else {
      const rp = G.piyon[r];
      if (!rp) { _siraGecir(); return; }
      G.tahta[hamle.tasS][hamle.tasK] = { tip:hamle.tasTip, oyuncu:o };
      G.el[o][hamle.tasTip]--;
      const wcR = G.wecode[r];
      if (wcR && wcR.s===rp.s && wcR.k===rp.k) {
        G.tahta[rp.s][rp.k] = { tip:'wecode', oyuncu:r };
      } else {
        G.tahta[rp.s][rp.k] = null;
      }
      G.tahta[hamle.yeniS][hamle.yeniK] = { tip:'piyon', oyuncu:r };
      G.piyon[r] = { s:hamle.yeniS, k:hamle.yeniK };
      sesSal('ses-karsilasma');
      const wcO = G.wecode[o];
      if (wcO && wcO.s===hamle.yeniS && wcO.k===hamle.yeniK) {
        _kazanBildir(r); return;
      }
      _siraGecir();
    }
  }
}

// ============================================================
//  RAKİP HAMLESİ (Online)
// ============================================================
function rakipHamleUygula(hamleTipi, veri) {
  if (hamleTipi === 'baslangic') {
    _baslangicUygula(veri.s, veri.k, veri.oyuncu);
  } else if (hamleTipi === 'piyon') {
    _piyonTasiUygula(veri.eskiS, veri.eskiK, veri.yeniS, veri.yeniK, veri.oyuncu);
  } else if (hamleTipi === 'carpi') {
    G.tahta[veri.s][veri.k] = { tip:'carpi', oyuncu:veri.oyuncu };
    G.el[veri.oyuncu].carpi--;
    sesSal('ses-tas-koy');
    _siraGecir();
  } else if (hamleTipi === 'yon') {
    G.tahta[veri.tasS][veri.tasK] = { tip:veri.tip, oyuncu:veri.oyuncu };
    G.el[veri.oyuncu][veri.tip]--;
    const wcR = G.wecode[veri.rakip];
    if (wcR && wcR.s===veri.rakipEskiS && wcR.k===veri.rakipEskiK) {
      G.tahta[veri.rakipEskiS][veri.rakipEskiK] = { tip:'wecode', oyuncu:veri.rakip };
    } else {
      G.tahta[veri.rakipEskiS][veri.rakipEskiK] = null;
    }
    G.tahta[veri.rakipYeniS][veri.rakipYeniK] = { tip:'piyon', oyuncu:veri.rakip };
    G.piyon[veri.rakip] = { s:veri.rakipYeniS, k:veri.rakipYeniK };
    sesSal('ses-karsilasma');
    _siraGecir();
  }
}

// ============================================================
//  SUNUCUYA GÖNDER (Online modlarda)
// ============================================================
function _sunucuyaGonder(hamleTipi, veri) {
  if (mod === 'bilgisayar') return;
  if (!socket || !odaKodum) return;
  socket.emit('hamle', { odaKodu: odaKodum, hamleTipi, veri });
}

// ============================================================
//  KAZANMA
// ============================================================
function _kazanBildir(kazananOyuncu) {
  G.bitti = true;
  guncelle();

  if (mod !== 'bilgisayar' && socket && odaKodum) {
    socket.emit('oyun_bitti', { odaKodu: odaKodum, kazananNumara: kazananOyuncu });
  }

  _kazanEkraniGoster(kazananOyuncu);
}

function _kazanEkraniGoster(kazananOyuncu) {
  const benKazandimMi = mod === 'bilgisayar'
    ? kazananOyuncu === 1
    : kazananOyuncu === benimNumaram;

  const ad = G.ad[kazananOyuncu];

  if (benKazandimMi) {
    document.getElementById('kupa-emoji').textContent = '🏆';
    document.getElementById('kazanan-mesaj').textContent = `🎉 ${ad}`;
    document.getElementById('kazanan-alt').textContent = 'Rakibin WECODE\'una ulaştı ve kazandı!';
    sesSal('ses-kazanma');
    konfetiBas();
  } else {
    document.getElementById('kupa-emoji').textContent = '😢';
    document.getElementById('kazanan-mesaj').textContent = `${ad} Kazandı`;
    document.getElementById('kazanan-alt').textContent = 'Rakibine kaybettin. Bir daha dene!';
  }

  setTimeout(() => ekranGoster('ekran-kazanma'), 900);
}

function konfetiBas() {
  const renkler = ['#ff9800','#1565c0','#e53935','#43a047','#ab47bc','#fdd835'];
  const el = document.getElementById('konfeti');
  el.innerHTML = '';
  for (let i=0; i<50; i++) {
    const p = document.createElement('div');
    p.className = 'konfeti-parcasi';
    p.style.cssText = `left:${Math.random()*100}%;top:${-10-Math.random()*20}px;
      background:${renkler[Math.floor(Math.random()*renkler.length)]};
      animation-delay:${Math.random()*1.5}s;animation-duration:${1.5+Math.random()}s;
      transform:rotate(${Math.random()*360}deg);
      width:${6+Math.random()*8}px;height:${6+Math.random()*8}px`;
    el.appendChild(p);
  }
}

// ============================================================
//  GÖRSEL
// ============================================================
function guncelle() {
  tahtaCiz();
  panelGuncelle();
  mesajGuncelle();
  vurgula();
}

function tahtaCiz() {
  for (let s=0; s<BOYUT; s++) {
    for (let k=0; k<BOYUT; k++) {
      const kEl = document.querySelector(`[data-satir="${s}"][data-sutun="${k}"]`);
      if (!kEl) continue;
      kEl.innerHTML = '';
      kEl.className = 'kare';
      if (s===BOYUT-1) kEl.classList.add('satir-oyuncu1');
      if (s===0)       kEl.classList.add('satir-oyuncu2');
      const h = G.tahta[s][k];
      if (!h) continue;
      const div = document.createElement('div');
      if (h.tip === 'piyon') {
        div.className = `kare-tas oyuncu${h.oyuncu} tip-piyon`;
        const wc = G.wecode[h.oyuncu];
        if (wc && wc.s===s && wc.k===k) div.classList.add('baslangic-piyon');
      } else {
        div.className = `kare-tas oyuncu${h.oyuncu} tip-${h.tip}`;
        div.textContent = TAS[h.tip]?.sembol ?? '?';
      }
      kEl.appendChild(div);
    }
  }
}

function vurgula() {
  document.querySelectorAll('.kare').forEach(k => k.classList.remove('vurgulanmis','vurgu-yon'));
  if (G.faz !== 'oyun' || G.bitti || !beniminSiram) return;

  if (G.secili === 'ileri' || G.secili === 'sola' || G.secili === 'saga') {
    const r = G.aktif===1?2:1;
    const rp = G.piyon[r];
    if (!rp) return;
    for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const ns=rp.s+ds, nk=rp.k+dk;
      if (ns<0||ns>=BOYUT||nk<0||nk>=BOYUT) continue;
      if (G.tahta[ns][nk]!==null) continue;
      const el=document.querySelector(`[data-satir="${ns}"][data-sutun="${nk}"]`);
      if (el) el.classList.add('vurgu-yon');
    }
    return;
  }
  if (G.secili) return;

  const p = G.piyon[G.aktif];
  if (!p) return;
  const r = G.aktif===1?2:1;

  for (const [ds,dk] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
    const ns=p.s+ds, nk=p.k+dk;
    if (ns<0||ns>=BOYUT||nk<0||nk>=BOYUT) continue;
    if (Math.abs(ds)===1&&Math.abs(dk)===1) {
      const oncekiAktif = G.aktif;
      G.aktif = benimNumaram;
      const gecerli = caprazGecerliMi(p.s, p.k);
      G.aktif = oncekiAktif;
      if (!gecerli) continue;
    }
    const h = G.tahta[ns][nk];
    if (h && h.tip==='carpi') continue;
    const el=document.querySelector(`[data-satir="${ns}"][data-sutun="${nk}"]`);
    if (el) el.classList.add('vurgulanmis');
  }
}

function panelGuncelle() {
  const a = G.aktif;
  const em = { 1:'🔴', 2:'🟣' };

  const benim = benimNumaram;
  const rakip = benim===1?2:1;

  let solBaslik = `${em[benim]} Taşların`;
  let sagBaslik = `${em[rakip]} ${mod==='bilgisayar'?'Bot':'Rakip'}`;

  document.getElementById('sol-panel-baslik').textContent = solBaslik;
  document.getElementById('sag-panel-baslik').textContent = sagBaslik;

  _dolduPanel('tas-listesi-oyuncu1', benim, true);
  _dolduPanel('tas-listesi-oyuncu2', rakip, false);

  document.getElementById('bilgi-oyuncu1').classList.toggle('aktif-oyuncu', a===1);
  document.getElementById('bilgi-oyuncu2').classList.toggle('aktif-oyuncu', a===2);

  const topla = o => Object.values(G.el[o]||{}).reduce((x,y)=>x+y,0);
  document.getElementById('tas-oyuncu1').textContent = `${topla(1)} taş`;
  document.getElementById('tas-oyuncu2').textContent = `${topla(2)} taş`;
}

function _dolduPanel(elId, o, aktif) {
  const liste = document.getElementById(elId);
  liste.innerHTML = '';
  for (const [tip, bilgi] of Object.entries(TAS)) {
    if (tip==='wecode') continue;
    const kalan = (G.el[o]||{})[tip]??0;
    const div = document.createElement('div');
    div.className = 'secim-tasi';
    const secebilir = aktif && G.faz==='oyun' && kalan>0 && !G.bitti && beniminSiram;
    if (!secebilir) div.classList.add('bitti');
    if (aktif && G.secili===tip) div.classList.add('secili');
    div.innerHTML = `<span class="secim-tasi-icon">${bilgi.sembol}</span>
      <span>${bilgi.etiket}<br><strong>(${kalan})</strong></span>`;
    if (secebilir) div.addEventListener('click', () => tasSeç(tip));
    liste.appendChild(div);
  }
}

function tasSeç(tip) {
  G.secili = G.secili===tip ? null : tip;
  const mesajlar = {
    carpi: 'Çarpı → Boş kareye koy',
    ileri: 'İleri ok → Rakip piyonun bitişiğine koy (onu ileri iter)',
    sola:  'Sola → Rakip piyonun bitişiğine koy (onu sola iter)',
    saga:  'Sağa → Rakip piyonun bitişiğine koy (onu sağa iter)',
  };
  toast(G.secili ? mesajlar[G.secili] : 'Seçim kaldırıldı.');
  panelGuncelle(); vurgula();
}

function mesajGuncelle() {
  const a = G.aktif;
  const em = a===1?'🔴':'🟣';

  let siraMetni = '';
  if (G.faz === 'baslangic') {
    siraMetni = `${em} ${G.ad[a]}'in sırası`;
  } else if (beniminSiram) {
    siraMetni = '✅ Sıra Sende!';
  } else {
    siraMetni = `⏳ ${G.ad[a]} düşünüyor...`;
  }
  document.getElementById('sira-gostergesi').textContent = siraMetni;

  let alt = '';
  if (G.faz==='baslangic') {
    alt = `WECODE taşını ${G.baslangicSira===1?'en alt':'en üst'} satıra koy ⭐`;
  } else if (G.bitti) {
    alt = 'Oyun bitti!';
  } else if (!beniminSiram) {
    alt = 'Rakibinin hamlesini bekle...';
  } else if (G.secili) {
    alt = TAS[G.secili]?.etiket + ' seçildi — tahtaya koy';
  } else {
    alt = 'Piyon hareket ettir VEYA taş seç';
  }
  document.getElementById('adim-mesaj').textContent = alt;
}

// ============================================================
//  SES / TOAST / EKRAN
// ============================================================
function sesSal(id) {
  const el=document.getElementById(id);
  if(!el) return;
  try{ el.currentTime=0; el.play().catch(()=>{}); }catch(e){}
}

let _tt;
function toast(mesaj) {
  let t=document.getElementById('toast-mesaj');
  if(!t){ t=document.createElement('div'); t.id='toast-mesaj'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=mesaj; t.classList.add('goster');
  clearTimeout(_tt); _tt=setTimeout(()=>t.classList.remove('goster'),3000);
}

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(e=>e.classList.remove('aktif'));
  const el=document.getElementById(id);
  if(el) el.classList.add('aktif');
}

function oyunuSifirla() {
  if (mod === 'bilgisayar') {
    ekranGoster('ekran-seviye');
  } else if (socket && odaKodum) {
    socket.emit('yeniden_oyna', { odaKodu: odaKodum });
  } else {
    ekranGoster('ekran-menu');
  }
}

function yenidenOyna() {
  oyunuSifirla();
}

function anaMenuye() {
  mod = null; odaKodum = null; benimNumaram = 1;
  ekranGoster('ekran-menu');
}

document.addEventListener('DOMContentLoaded', () => {
  ekranGoster('ekran-menu');
});
