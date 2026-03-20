const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const odalar = {};

function odaKoduUret() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let kod = '';
  for (let i = 0; i < 6; i++) {
    kod += chars[Math.floor(Math.random() * chars.length)];
  }
  return kod;
}

io.on('connection', (socket) => {
  console.log('Yeni baglanti: ' + socket.id);

  socket.on('oda_olustur', ({ oyuncuAdi }) => {
    let kod;
    do { kod = odaKoduUret(); } while (odalar[kod]);

    odalar[kod] = {
      oyuncular: [{ id: socket.id, ad: oyuncuAdi, numara: 1 }],
    };

    socket.join(kod);
    socket.odaKodu = kod;
    socket.oyuncuNumarasi = 1;

    socket.emit('oda_olusturuldu', { odaKodu: kod, oyuncuNumarasi: 1 });
    console.log('Oda olusturuldu: ' + kod + ' - ' + oyuncuAdi);
  });

  socket.on('odaya_katil', ({ odaKodu, oyuncuAdi }) => {
    const oda = odalar[odaKodu];

    if (!oda) {
      socket.emit('hata', { mesaj: 'Bu oda kodu bulunamadi! Tekrar kontrol et.' });
      return;
    }

    if (oda.oyuncular.find(o => o.id === socket.id)) {
      socket.emit('hata', { mesaj: 'Zaten bu odadasin!' });
      return;
    }

    if (oda.oyuncular.length >= 2) {
      socket.emit('hata', { mesaj: 'Bu oda dolu! Farkli bir kod dene.' });
      return;
    }

    oda.oyuncular.push({ id: socket.id, ad: oyuncuAdi, numara: 2 });
    socket.join(odaKodu);
    socket.odaKodu = odaKodu;
    socket.oyuncuNumarasi = 2;

    socket.emit('odaya_katilindi', {
      odaKodu,
      oyuncuNumarasi: 2,
      rakipAdi: oda.oyuncular[0].ad,
    });

    io.to(odaKodu).emit('oyun_basladi', {
      oyuncu1Adi: oda.oyuncular[0].ad,
      oyuncu2Adi: oda.oyuncular[1].ad,
    });

    console.log(oyuncuAdi + ' odaya katildi: ' + odaKodu);
  });

  socket.on('hamle', ({ odaKodu, hamleTipi, veri }) => {
    socket.to(odaKodu).emit('rakip_hamle', { hamleTipi, veri });
  });

  socket.on('oyun_bitti', ({ odaKodu, kazananNumara }) => {
    socket.to(odaKodu).emit('oyun_bitti_bildir', { kazananNumara });
  });

  socket.on('yeniden_oyna', ({ odaKodu }) => {
    io.to(odaKodu).emit('oyun_sifirla');
  });

  socket.on('disconnect', () => {
    const kod = socket.odaKodu;
    if (!kod || !odalar[kod]) return;

    const oda = odalar[kod];
    oda.oyuncular = oda.oyuncular.filter(o => o.id !== socket.id);
    console.log('Oyuncu ayrildi: ' + kod + ', kalan: ' + oda.oyuncular.length);

    if (oda.oyuncular.length > 0) {
      socket.to(kod).emit('rakip_ayrildi', {
        mesaj: 'Rakibin baglantisi kesildi.'
      });
      setTimeout(() => {
        if (odalar[kod] && odalar[kod].oyuncular.length === 0) {
          delete odalar[kod];
          console.log('Oda silindi (bos): ' + kod);
        }
      }, 30000);
    } else {
      delete odalar[kod];
      console.log('Oda silindi: ' + kod);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Wecode sunucu calisiyor: http://localhost:' + PORT);
});
