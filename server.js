// ============================================================
//  WECODE MULTIPLAYER SUNUCU
//  Node.js + Socket.io
// ============================================================

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' }
});

// Statik dosyaları sun (HTML, CSS, JS, sesler)
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- ODA YÖNETİMİ ----
// odalar[odaKodu] = { oyuncular: [socket1, socket2], durum: {...} }
const odalar = {};

function odaKoduUret() {
  // 6 haneli büyük harf + rakam kodu: WECODE tarzı
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let kod = '';
  for (let i = 0; i < 6; i++) {
    kod += chars[Math.floor(Math.random() * chars.length)];
  }
  return kod;
}

// ---- SOCKET BAĞLANTILARI ----
io.on('connection', (socket) => {
  console.log(`Yeni bağlantı: ${socket.id}`);

  // ── ODA OLUŞTUR ──
  socket.on('oda_olustur', ({ oyuncuAdi }) => {
    let kod;
    do { kod = odaKoduUret(); } while (odalar[kod]);

    odalar[kod] = {
      oyuncular: [{ id: socket.id, ad: oyuncuAdi, numara: 1 }],
      oyunDurumu: null,
      basladi: false,
    };

    socket.join(kod);
    socket.odaKodu = kod;
    socket.oyuncuNumarasi = 1;

    socket.emit('oda_olusturuldu', { odaKodu: kod, oyuncuNumarasi: 1 });
    console.log(`Oda oluşturuldu: ${kod} — ${oyuncuAdi}`);
  });

  // ── ODAYA KATIL ──
  socket.on('odaya_katil', ({ odaKodu, oyuncuAdi }) => {
    const oda = odalar[odaKodu];

    if (!oda) {
      socket.emit('hata', { mesaj: 'Bu oda kodu bulunamadı! Tekrar kontrol et.' });
      return;
    }

    // Aynı socket zaten bu odadaysa reddet
    if (oda.oyuncular.find(o => o.id === socket.id)) {
      socket.emit('hata', { mesaj: 'Zaten bu odadasın! Farklı bir tarayıcıdan dene.' });
      return;
    }

    if (oda.oyuncular.length >= 2) {
      socket.emit('hata', { mesaj: 'Bu oda dolu! Farklı bir kod dene.' });
      return;
    }

    oda.oyuncular.push({ id: socket.id, ad: oyuncuAdi, numara: 2 });
    socket.join(odaKodu);
    socket.odaKodu = odaKodu;
    socket.oyuncuNumarasi = 2;

    // Her iki oyuncuya da bildir
    socket.emit('odaya_katilindi', {
      odaKodu,
      oyuncuNumarasi: 2,
      rakipAdi: oda.oyuncular[0].ad,
    });

    io.to(odaKodu).emit('oyun_basladi', {
      oyuncu1Adi: oda.oyuncular[0].ad,
      oyuncu2Adi: oda.oyuncular[1].ad,
    });

    console.log(`${oyuncuAdi} odaya katıldı: ${odaKodu}`);
  });

  // ── HAMLE GEL ──
  // Bir oyuncu hamle yapınca diğerine ilet
  socket.on('hamle', ({ odaKodu, hamleTipi, veri }) => {
    const oda = odalar[odaKodu];
    if (!oda) return;

    // Sadece diğer oyuncuya gönder
    socket.to(odaKodu).emit('rakip_hamle', { hamleTipi, veri });
    console.log(`Hamle: Oda ${odaKodu} — ${hamleTipi}`);
  });

  // ── OYUN BİTTİ ──
  socket.on('oyun_bitti', ({ odaKodu, kazananNumara }) => {
    socket.to(odaKodu).emit('oyun_bitti_bildir', { kazananNumara });
  });

  // ── YENİDEN OYNA ──
  socket.on('yeniden_oyna', ({ odaKodu }) => {
    const oda = odalar[odaKodu];
    if (!oda) return;
    io.to(odaKodu).emit('oyun_sifirla');
  });

  // ── BAĞLANTI KESİLDİ ──
  socket.on('disconnect', () => {
    const kod = socket.odaKodu;
    if (!kod || !odalar[kod]) return;

    // Odadaki diğer oyuncuya bildir
    socket.to(kod).emit('rakip_ayrildi', {
      mesaj: 'Rakibin bağlantısı kesildi. Oyun sona erdi.'
    });

    // Odayı temizle
    delete odalar[kod];
    console.log(`Oda silindi: ${kod}`);
  });
});

// ---- SUNUCUYU BAŞLAT ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Wecode sunucu çalışıyor: http://localhost:${PORT}`);
});
