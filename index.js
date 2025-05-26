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

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
