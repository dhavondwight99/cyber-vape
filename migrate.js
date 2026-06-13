const { Database } = require('sqlite3');
const db = new Database('./data.db');
db.serialize(() => {
    db.run("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'PENDING'", (err) => {
        if(err) console.log(err.message);
        else console.log('Added payment_status column');
    });
    db.run("ALTER TABLE orders ADD COLUMN qr_url TEXT", (err) => {
        if(err) console.log(err.message);
        else console.log('Added qr_url column');
    });
});
db.close();
