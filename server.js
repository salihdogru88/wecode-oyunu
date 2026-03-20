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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const odalar = {};
let eslemeKuyruk = null; // bekleyen oyuncu

function kodUret() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let k = '';
  for (let i=0; i<6; i++) k += c[Math.floor(Math.random()*c.length)];
  return k;
}

io.on('connection', (socket) => {
  console.log('Baglandi: ' + socket.id);

  // Oda oluştur
  socket.on('oda_olustur', ({ oyuncuAdi }) => {
    let kod; do { kod = kodUret(); } while (odalar[kod]);
    odalar[kod] = { oyuncular: [{ id: socket.id, ad: oyuncuAdi, numara: 1 }] };
    socket.join(kod);
    socket.odaKodu = kod;
    socket.emit('oda_olusturuldu', { odaKodu: kod, oyuncuNumarasi: 1 });
    console.log('Oda: ' + kod + ' - ' + oyuncuAdi);
  });

  // Odaya katıl
  socket.on('odaya_katil', ({ odaKodu, oyuncuAdi }) => {
    const oda = odalar[odaKodu];
    if (!oda) { socket.emit('hata', { mesaj: 'Oda bulunamadi!' }); return; }
    if (oda.oyuncular.find(o => o.id === socket.id)) { socket.emit('hata', { mesaj: 'Zaten buradasin!' }); return; }
    if (oda.oyuncular.length >= 2) { socket.emit('hata', { mesaj: 'Oda dolu!' }); return; }

    oda.oyuncular.push({ id: socket.id, ad: oyuncuAdi, numara: 2 });
    socket.join(odaKodu);
    socket.odaKodu = odaKodu;

    socket.emit('odaya_katilindi', { odaKodu, oyuncuNumarasi: 2, rakipAdi: oda.oyuncular[0].ad });
    io.to(odaKodu).emit('oyun_basladi', {
      oyuncu1Adi: oda.oyuncular[0].ad,
      oyuncu2Adi: oda.oyuncular[1].ad,
    });
    console.log(oyuncuAdi + ' katildi: ' + odaKodu);
  });

  // Otomatik eşleşme
  socket.on('esleme_katil', ({ oyuncuAdi }) => {
    if (eslemeKuyruk && eslemeKuyruk.id !== socket.id) {
      // Eşleşme bulundu!
      const rakip = eslemeKuyruk;
      eslemeKuyruk = null;

      let kod; do { kod = kodUret(); } while (odalar[kod]);
      odalar[kod] = {
        oyuncular: [
          { id: rakip.id, ad: rakip.ad, numara: 1 },
          { id: socket.id, ad: oyuncuAdi, numara: 2 },
        ]
      };

      const rakipSocket = io.sockets.sockets.get(rakip.id);
      if (rakipSocket) rakipSocket.join(kod);
      socket.join(kod);
      rakip.socket.odaKodu = kod;
      socket.odaKodu = kod;

      io.to(kod).emit('oyun_basladi', {
        oyuncu1Adi: rakip.ad,
        oyuncu2Adi: oyuncuAdi,
      });

      rakip.socket.emit('odaya_katilindi', { odaKodu: kod, oyuncuNumarasi: 1, rakipAdi: oyuncuAdi });
      socket.emit('odaya_katilindi', { odaKodu: kod, oyuncuNumarasi: 2, rakipAdi: rakip.ad });

      console.log('Esleme: ' + rakip.ad + ' vs ' + oyuncuAdi);
    } else {
      eslemeKuyruk = { id: socket.id, ad: oyuncuAdi, socket };
      socket.emit('esleme_bekleniyor');
      console.log('Kuyrukta: ' + oyuncuAdi);
    }
  });

  socket.on('esleme_ayril', () => {
    if (eslemeKuyruk && eslemeKuyruk.id === socket.id) eslemeKuyruk = null;
  });

  // Hamle ilet
  socket.on('hamle', ({ odaKodu, hamleTipi, veri }) => {
    socket.to(odaKodu).emit('rakip_hamle', { hamleTipi, veri });
  });

  socket.on('oyun_bitti', ({ odaKodu, kazananNumara }) => {
    socket.to(odaKodu).emit('oyun_bitti_bildir', { kazananNumara });
  });

  socket.on('yeniden_oyna', ({ odaKodu }) => {
    io.to(odaKodu).emit('oyun_sifirla');
  });

  // Bağlantı kesildi
  socket.on('disconnect', () => {
    if (eslemeKuyruk && eslemeKuyruk.id === socket.id) eslemeKuyruk = null;
    const kod = socket.odaKodu;
    if (!kod || !odalar[kod]) return;
    const oda = odalar[kod];
    oda.oyuncular = oda.oyuncular.filter(o => o.id !== socket.id);
    if (oda.oyuncular.length > 0) {
      socket.to(kod).emit('rakip_ayrildi', { mesaj: 'Rakibin ayrildi.' });
      setTimeout(() => { if (odalar[kod] && odalar[kod].oyuncular.length === 0) delete odalar[kod]; }, 30000);
    } else {
      delete odalar[kod];
    }
    console.log('Ayrildi: ' + socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('WeCode sunucu: http://localhost:' + PORT));
