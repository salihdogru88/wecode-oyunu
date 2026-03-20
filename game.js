// ============================================================
//  WECODE MULTIPLAYER — OYUN MOTORU
//  Socket.io ile online 2 kişilik oyun
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
  tahta: [],
  piyon: {},
  wecode: {},
  el: {},
  aktif: 1,
  faz: 'baslangic',
  baslangicSira: 1,
  secili: null,
  bitti: false,
  ad: { 1: 'Oyuncu 1', 2: 'Oyuncu 2' },
};

// ---- BAĞLANTI DEĞİŞKENLERİ ----
let socket = null;
let benimNumaram = null;  // Ben kaçıncı oyuncuyum (1 veya 2)
let odaKodum = null;
let beniminSiram = false; // Şu an benim sıram mı?

// ============================================================
//  SOCKET.IO BAĞLANTISI
// ============================================================
function baglantiKur() {
  // Render.com adresini buraya yaz (deploy sonrası güncellenir)
  // Geliştirme sırasında aynı sunucuya bağlanır
socket = io({
  transports: ['websocket', 'polling'],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});
  // Oda oluşturuldu
  socket.on('oda_olusturuldu', ({ odaKodu, oyuncuNumarasi }) => {
    odaKodum = odaKodu;
    benimNumaram = oyuncuNumarasi;
    document.getElementById('oda-kodu-goster').textContent = odaKodu;
    ekranGoster('ekran-bekleme');
  });

  // Odaya katılındı
  socket.on('odaya_katilindi', ({ odaKodu, oyuncuNumarasi, rakipAdi }) => {
    odaKodum = odaKodu;
    benimNumaram = oyuncuNumarasi;
    toast(`${rakipAdi} odada seni bekliyor!`);
  });

  // Oyun başladı (her iki oyuncu da hazır)
  socket.on('oyun_basladi', ({ oyuncu1Adi, oyuncu2Adi }) => {
    G.ad[1] = oyuncu1Adi;
    G.ad[2] = oyuncu2Adi;
    oyunuBaslatIcSetting();
    ekranGoster('ekran-oyun');
    toast(`Oyun başladı! Sen ${benimNumaram}. oyuncusun.`);
  });

  // Rakibin hamlesi geldi
  socket.on('rakip_hamle', ({ hamleTipi, veri }) => {
    rakipHamleUygula(hamleTipi, veri);
  });

  // Rakip kazandı bildirimi
  socket.on('oyun_bitti_bildir', ({ kazananNumara }) => {
    G.bitti = true;
    guncelle();
    const kazananAd = G.ad[kazananNumara];
    const benKazandimMi = kazananNumara === benimNumaram;
    document.getElementById('kazanan-mesaj').textContent = benKazandimMi ? '🎉 Kazandın!' : `😢 ${kazananAd} Kazandı`;
    document.getElementById('kazanan-alt').textContent = benKazandimMi
      ? 'Tebrikler! Rakibin WECODE\'una ulaştın!'
      : 'Rakibin WECODE\'una ulaştı. Bir daha dene!';
    if (benKazandimMi) { sesSal('ses-kazanma'); konfetiBas(); }
    setTimeout(() => ekranGoster('ekran-kazanma'), 900);
  });

  // Yeniden oyna
  socket.on('oyun_sifirla', () => {
    oyunuBaslatIcSetting();
    ekranGoster('ekran-oyun');
    toast('Yeni oyun başladı!');
  });

  // Rakip ayrıldı
  socket.on('rakip_ayrildi', ({ mesaj }) => {
    document.getElementById('baglanti-bandi').classList.remove('gizli');
    toast('⚠️ ' + mesaj);
    G.bitti = true;
    guncelle();
  });

  // Hata
  socket.on('hata', ({ mesaj }) => {
    toast('❌ ' + mesaj);
  });
}

// ============================================================
//  ODA İŞLEMLERİ (Menü butonları)
// ============================================================
function odaOlustur() {
  const ad = document.getElementById('giris-isim').value.trim();
  if (!ad) { toast('Önce adını gir!'); return; }
  if (!socket) baglantiKur();
  socket.emit('oda_olustur', { oyuncuAdi: ad });
}

function odayaKatil() {
  const ad  = document.getElementById('giris-isim').value.trim();
  const kod = document.getElementById('oda-kodu-input').value.trim().toUpperCase();
  if (!ad)  { toast('Önce adını gir!'); return; }
  if (!kod) { toast('Oda kodunu gir!'); return; }
  if (!socket) baglantiKur();
  socket.emit('odaya_katil', { odaKodu: kod, oyuncuAdi: ad });
}

function koduKopyala() {
  const kod = document.getElementById('oda-kodu-goster').textContent;
  navigator.clipboard.writeText(kod).then(() => toast('Kod kopyalandı! ✅'));
}

// ============================================================
//  OYUN BAŞLATMA (iç ayarlar)
// ============================================================
function oyunuBaslatIcSetting() {
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

  beniminSiram = (benimNumaram === 1); // Başta oyuncu 1'in sırası

  document.getElementById('adi-oyuncu1').textContent = G.ad[1];
  document.getElementById('adi-oyuncu2').textContent = G.ad[2];
  document.getElementById('baglanti-bandi').classList.add('gizli');

  tahtaOlustur();
  guncelle();
}

// ============================================================
//  TAHTA OLUŞTUR
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

  // Sıram değilse tıklamayı engelle
  if (!beniminSiram) {
    toast('Şu an rakibinin sırası, bekle!');
    return;
  }

  if (G.faz === 'baslangic') {
    baslangicClick(s, k);
  } else {
    if (G.secili) { tasKoyClick(s, k); }
    else          { piyonClick(s, k);  }
  }
}

// ============================================================
//  BAŞLANGIÇ: WECODE + piyon yerleştirme
// ============================================================
function baslangicClick(s, k) {
  const o = G.baslangicSira;

  // Sıradaki oyuncu benim değilse işlem yapma
  if (o !== benimNumaram) {
    toast('Şu an rakibinin başlangıç sırası!');
    return;
  }

  const beklenenSatir = o === 1 ? BOYUT - 1 : 0;
  if (s !== beklenenSatir) {
    toast(`Sadece ${o === 1 ? 'EN ALT' : 'EN ÜST'} satıra koyabilirsin!`);
    sesSal('ses-hata');
    return;
  }
  if (G.tahta[s][k] !== null) {
    toast('Bu kare dolu!');
    sesSal('ses-hata');
    return;
  }

  // Yerel uygula
  _baslangicUygula(s, k, o);

  // Sunucuya gönder
  socket.emit('hamle', {
    odaKodu: odaKodum,
    hamleTipi: 'baslangic',
    veri: { s, k, oyuncu: o },
  });
}

function _baslangicUygula(s, k, o) {
  G.tahta[s][k] = { tip: 'wecode', oyuncu: o };
  G.wecode[o] = { s, k };
  G.piyon[o] = { s, k };
  sesSal('ses-tas-koy');

  if (G.baslangicSira === 1) {
    G.baslangicSira = 2;
    G.aktif = 2;
    beniminSiram = (benimNumaram === 2);
    toast(benimNumaram === 2
      ? 'Şimdi sen koy! En üst satıra WECODE taşını yerleştir ⭐'
      : 'Rakip yerleştiriyor, bekle...');
  } else {
    G.faz = 'oyun';
    G.aktif = 1;
    beniminSiram = (benimNumaram === 1);
    toast(beniminSiram ? 'Oyun başladı! Hamle sırası sende.' : 'Oyun başladı! Rakip hamle yapıyor...');
  }
  guncelle();
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
      toast('Çapraz hareket koşulları sağlanmıyor!');
      sesSal('ses-hata');
      return;
    }
  }

  const hedef = G.tahta[s][k];
  if (hedef && hedef.tip === 'carpi') {
    toast('Çarpı taşı var, oradan geçemezsin! ✕');
    sesSal('ses-hata');
    return;
  }

  const r = o === 1 ? 2 : 1;

  if (hedef && hedef.tip === 'piyon' && hedef.oyuncu === r) {
    karsilasmaYonet(p.s, p.k, s, k);
    return;
  }

  if (hedef && hedef.tip === 'wecode' && hedef.oyuncu === r) {
    _piyonTasiUygula(p.s, p.k, s, k, o);
    socket.emit('hamle', { odaKodu: odaKodum, hamleTipi: 'piyon', veri: { eskiS: p.s, eskiK: p.k, yeniS: s, yeniK: k, oyuncu: o } });
    _kazanBildir(o);
    return;
  }

  if (hedef !== null && hedef.tip !== 'wecode') {
    toast('Bu kare dolu!');
    sesSal('ses-hata');
    return;
  }

  _piyonTasiUygula(p.s, p.k, s, k, o);
  socket.emit('hamle', { odaKodu: odaKodum, hamleTipi: 'piyon', veri: { eskiS: p.s, eskiK: p.k, yeniS: s, yeniK: k, oyuncu: o } });
}

function _piyonTasiUygula(eskiS, eskiK, yeniS, yeniK, o) {
  const wcO = G.wecode[o];
  if (wcO && wcO.s === eskiS && wcO.k === eskiK) {
    G.tahta[eskiS][eskiK] = { tip: 'wecode', oyuncu: o };
  } else {
    G.tahta[eskiS][eskiK] = null;
  }
  G.tahta[yeniS][yeniK] = { tip: 'piyon', oyuncu: o };
  G.piyon[o] = { s: yeniS, k: yeniK };
  sesSal('ses-piyon-hareket');

  const r = o === 1 ? 2 : 1;
  const wcR = G.wecode[r];
  if (wcR && wcR.s === yeniS && wcR.k === yeniK) {
    _kazanBildir(o);
    return;
  }
  _siraGecir();
}

// ============================================================
//  KARŞILAŞMA
// ============================================================
function karsilasmaYonet(pS, pK, rS, rK) {
  const o = G.aktif;
  const r = o === 1 ? 2 : 1;
  const ds = rS - pS, dk = rK - pK;
  const arkaS = rS + ds, arkaK = rK + dk;
  const arkaGecerli = arkaS >= 0 && arkaS < BOYUT && arkaK >= 0 && arkaK < BOYUT;
  const arkaH = arkaGecerli ? G.tahta[arkaS][arkaK] : null;
  const arkaBosMu = arkaGecerli && (!arkaH || (arkaH.tip === 'wecode' && arkaH.oyuncu === r));

  if (arkaBosMu) {
    sesSal('ses-karsilasma');
    toast('Rakibin üstünden atladın! 🦘');
    _piyonTasiUygula(pS, pK, arkaS, arkaK, o);
    socket.emit('hamle', { odaKodu: odaKodum, hamleTipi: 'piyon', veri: { eskiS: pS, eskiK: pK, yeniS: arkaS, yeniK: arkaK, oyuncu: o } });
    return;
  }

  if (caprazGecerliMi(pS, pK)) {
    toast('Karşılaşma! Çapraz gidebilirsin — köşe karelerden birine tıkla!');
    guncelle();
    return;
  }

  toast('Karşılaşma! Yana git veya geri çekil.');
  guncelle();
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
    socket.emit('hamle', { odaKodu: odaKodum, hamleTipi: 'carpi', veri: { s, k, oyuncu: o } });
    G.secili = null;
    _siraGecir();
    return;
  }

  if (tip === 'ileri' || tip === 'sola' || tip === 'saga') {
    const rp = G.piyon[r];
    if (!rp) { toast('Rakibin piyonu yok!'); return; }
    const ds = Math.abs(s-rp.s), dk = Math.abs(k-rp.k);
    if (!((ds===1&&dk===0)||(ds===0&&dk===1))) {
      toast('Yön taşını sadece rakip piyonun bitişiğine (ön/arka/sağ/sol) koyabilirsin!');
      sesSal('ses-hata'); return;
    }
    if (G.tahta[s][k] !== null) { toast('Bu kare dolu!'); sesSal('ses-hata'); return; }

    const delta = YON_DELTA[tip];
    const yeniS = rp.s + delta.ds, yeniK = rp.k + delta.dk;
    if (yeniS<0||yeniS>=BOYUT||yeniK<0||yeniK>=BOYUT) {
      toast('Rakip piyon tahtadan çıkıyor! Geçersiz hamle.'); sesSal('ses-hata'); return;
    }
    const hedefH = G.tahta[yeniS][yeniK];
    if (hedefH !== null && hedefH.tip !== 'wecode') {
      toast('Rakip piyonun gideceği kare dolu! Geçersiz hamle.'); sesSal('ses-hata'); return;
    }

    // Uygula
    G.tahta[s][k] = { tip, oyuncu: o };
    G.el[o][tip]--;
    const wcR = G.wecode[r];
    if (wcR && wcR.s===rp.s && wcR.k===rp.k) {
      G.tahta[rp.s][rp.k] = { tip: 'wecode', oyuncu: r };
    } else {
      G.tahta[rp.s][rp.k] = null;
    }
    G.tahta[yeniS][yeniK] = { tip: 'piyon', oyuncu: r };
    G.piyon[r] = { s: yeniS, k: yeniK };
    sesSal('ses-karsilasma');

    socket.emit('hamle', {
      odaKodu: odaKodum, hamleTipi: 'yon',
      veri: { tasS: s, tasK: k, tip, oyuncu: o, rakipEskiS: rp.s, rakipEskiK: rp.k, rakipYeniS: yeniS, rakipYeniK: yeniK, rakip: r }
    });

    // Rakip bizim wecode'umuza geldi mi?
    const wcO = G.wecode[o];
    if (wcO && wcO.s===yeniS && wcO.k===yeniK) {
      _kazanBildir(r); return;
    }

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
      toast('WECODE taşının etrafı tamamen kapanamaz!'); sesSal('ses-hata'); return false;
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

function bfsVarMi(bS, bK, hS, hK) {
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
//  RAKİP HAMLESİNİ UYGULA (sunucudan gelen)
// ============================================================
function rakipHamleUygula(hamleTipi, veri) {
  if (hamleTipi === 'baslangic') {
    _baslangicUygula(veri.s, veri.k, veri.oyuncu);
  }
  else if (hamleTipi === 'piyon') {
    _piyonTasiUygula(veri.eskiS, veri.eskiK, veri.yeniS, veri.yeniK, veri.oyuncu);
  }
  else if (hamleTipi === 'carpi') {
    G.tahta[veri.s][veri.k] = { tip: 'carpi', oyuncu: veri.oyuncu };
    G.el[veri.oyuncu].carpi--;
    sesSal('ses-tas-koy');
    _siraGecir();
  }
  else if (hamleTipi === 'yon') {
    G.tahta[veri.tasS][veri.tasK] = { tip: veri.tip, oyuncu: veri.oyuncu };
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
//  SIRA GEÇİŞİ
// ============================================================
function _siraGecir() {
  G.aktif = G.aktif === 1 ? 2 : 1;
  G.secili = null;
  beniminSiram = (G.aktif === benimNumaram);
  guncelle();
  toast(beniminSiram ? '✅ Sıra sende! Hamle yap.' : '⏳ Rakibinin sırası, bekle...');
}

// ============================================================
//  KAZANMA
// ============================================================
function _kazanBildir(kazananOyuncu) {
  G.bitti = true;
  guncelle();

  const benKazandimMi = (kazananOyuncu === benimNumaram);
  document.getElementById('kazanan-mesaj').textContent = benKazandimMi ? '🎉 Kazandın!' : `😢 ${G.ad[kazananOyuncu]} Kazandı`;
  document.getElementById('kazanan-alt').textContent = benKazandimMi
    ? 'Tebrikler! Rakibin WECODE\'una ulaştın!'
    : 'Rakibin WECODE\'una ulaştı. Bir daha dene!';

  if (benKazandimMi) { sesSal('ses-kazanma'); konfetiBas(); }

  // Rakibe de bildir
  socket.emit('oyun_bitti', { odaKodu: odaKodum, kazananNumara: kazananOyuncu });

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
//  GÖRSEL GÜNCELLEME
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
    if (Math.abs(ds)===1&&Math.abs(dk)===1 && !caprazGecerliMi(p.s,p.k)) continue;
    const h = G.tahta[ns][nk];
    if (h && h.tip==='carpi') continue;
    const el=document.querySelector(`[data-satir="${ns}"][data-sutun="${nk}"]`);
    if (el) el.classList.add('vurgulanmis');
  }
}

function panelGuncelle() {
  const a=G.aktif, em={1:'🔴',2:'🟣'};
  // Sol panel: benim taşlarım, sağ: rakip
  const benim = benimNumaram || 1;
  const rakip = benim===1?2:1;
  document.getElementById('sol-panel-baslik').textContent = `${em[benim]} Taşların`;
  document.getElementById('sag-panel-baslik').textContent = `${em[rakip]} Rakip`;
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
  const a = G.aktif, em = a===1?'🔴':'🟣';
  document.getElementById('sira-gostergesi').textContent = beniminSiram
    ? '✅ Sıra Sende!'
    : `⏳ ${G.ad[a]} hamle yapıyor...`;

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
//  SES / TOAST / EKRAN / YARDIMCI
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
  clearTimeout(_tt); _tt=setTimeout(()=>t.classList.remove('goster'),3200);
}

function ekranGoster(id) {
  document.querySelectorAll('.ekran').forEach(e=>e.classList.remove('aktif'));
  const el=document.getElementById(id);
  if(el) el.classList.add('aktif');
}

function kurallariGoster() { ekranGoster('ekran-kurallar'); }
function geriDon()          { ekranGoster('ekran-menu');    }
function anaMenuye()        { ekranGoster('ekran-menu');    }

function oyunuSifirla() {
  if (socket && odaKodum) {
    socket.emit('yeniden_oyna', { odaKodu: odaKodum });
  } else {
    ekranGoster('ekran-menu');
  }
}

function yenidenOyna() {
  if (socket && odaKodum) {
    socket.emit('yeniden_oyna', { odaKodu: odaKodum });
  } else {
    ekranGoster('ekran-menu');
  }
}

// Sayfa açılınca bağlantıyı kur
document.addEventListener('DOMContentLoaded', () => {
  baglantiKur();
  ekranGoster('ekran-menu');
});
