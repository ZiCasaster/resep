const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const scrapeData = require('./scraper');

// Endpoint utama
app.get('/', (req, res) => {
  res.send('API Scraper Aktif di Railway!');
});

// Endpoint untuk scraping
app.get('/scrape', async (req, res) => {
  try {
    const data = await scrapeData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk pencarian resep
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ success: false, error: 'Query kosong. Tambahkan ?q=...' });

  try {
    const results = await scrapeData(query); // kirim query ke scraper
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
