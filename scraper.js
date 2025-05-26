const axios = require('axios');
const cheerio = require('cheerio');

const scrapeData = async () => {
  const url = 'https://example.com/news'; // GANTI ke target kamu
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const results = [];

  $('article').each((i, el) => {
    const title = $(el).find('h2').text().trim();
    const link = $(el).find('a').attr('href');
    results.push({ title, link });
  });

  return results;
};

module.exports = scrapeData;
