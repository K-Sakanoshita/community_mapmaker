const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, URL, location: { href: 'https://example.test/map/' },
    Conf: { etc: { relativePath: './stores/' } } });
vm.runInContext(fs.readFileSync('lib/gsheetlib.js', 'utf8') + '\nthis.Sheet = GoogleSpreadSheet;', context);
(async () => {
    const sheet = new context.Sheet();
    const values = ['作品 & 作者.JPG', 'https://example.test/photo.jpg', 'File:Artwork.jpg',
        '', './stores/already.jpg', '../photo.jpg', '/photo.jpg', 'store/venue/photo.jpg', 'actor/artist/photo.jpg'];
    sheet._jsonp = async () => values.map((picture_url1, i) => ({
        id: `ShinMikuArtFes2025/${i}`, picture_url1, title: '作品名.JPG' }));
    const rows = await sheet.get('https://script.google.com/macros/s/example/exec');
    assert.equal(rows[0].picture_url1, './stores/作品 & 作者.JPG');
    values.slice(1).forEach((value, i) => assert.equal(rows[i + 1].picture_url1, value));
    assert.equal(rows[0].title, '作品名.JPG');
    assert.equal(rows[0].id, 'ShinMikuArtFes2025/0');
    sheet._sanitizeRows(rows);
    assert.equal(rows[0].picture_url1, './stores/作品 & 作者.JPG', 'normalization is idempotent');
    context.Conf.etc = {};
    const unchanged = sheet._sanitizeRows([{ picture_url1: '作品.JPG' }]);
    assert.equal(unchanged[0].picture_url1, '作品.JPG');
    console.log('PASS: legacy GAS photo filenames, absolute/Commons URLs, IDs and no-config behavior');
})().catch(error => { console.error(error); process.exitCode = 1; });
