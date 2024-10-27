var router = require('express').Router();
const { countReset } = require('console');
const { requiresAuth } = require('express-openid-connect');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

router.get('/', async function (req, res, next) {
  try {
    const countResult = await req.pool.query('SELECT COUNT(*) FROM qr_codes');
    const qrCodeCount = parseInt(countResult.rows[0].count, 10);

    res.render('index', {
      title: 'QR Code Generator',
      qrCodeUrl: null,
      isAuthenticated: req.oidc.isAuthenticated(),
      qrCodeCount
    });
  } catch (error) {
    console.error('Error fetching QR code count:', error);
    return res.status(500).json({ error: 'Failed to fetch QR code count' });
  }
});

router.post('/', async function (req, res, next) {
  const { oib, firstName, lastName } = req.body;
  const date = new Date();
  const TimeOfCreation = date.toISOString();
  const newUuid = uuidv4();

  try {
    const countResult = await req.pool.query('SELECT COUNT(*) FROM qr_codes WHERE oib = $1', [oib]);
    const existingCount = parseInt(countResult.rows[0].count, 10);
    const countResult2 = await req.pool.query('SELECT COUNT(*) FROM qr_codes');
    const qrCodeCount = parseInt(countResult2.rows[0].count, 10);

    if (existingCount >= 3) {
      return res.status(400).json({ error: 'You already generated 3 QR Codes or you are not logged in!' });
    }

    const detailsUrl = `https://weblab11.onrender.com//details?uuid=${newUuid}`;

    const url = await QRCode.toDataURL(detailsUrl); 

    const insertQuery = 'INSERT INTO qr_codes (oib, firstName, lastName, timeOfCreation, uuid) VALUES ($1, $2, $3, $4, $5)';
    const values = [oib, firstName, lastName, TimeOfCreation, newUuid];
    await req.pool.query(insertQuery, values);

    res.render('index', {
      title: 'QR Code Generator',
      isAuthenticated: req.oidc.isAuthenticated(),
      qrCodeUrl: url,
      uuid: newUuid,
      qrCodeCount
    });

  } catch (err) {
    console.error('Error processing request:', err.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/profile', requiresAuth(), function (req, res, next) {
  res.render('profile', {
    userProfile: JSON.stringify(req.oidc.user, null, 2),
    title: 'Profile page',
    isAuthenticated: null
  });
});

router.get('/details', async function (req, res, next) {
  const { uuid } = req.query;

  try {
      const query = 'SELECT * FROM qr_codes WHERE uuid = $1';
      const result = await req.pool.query(query, [uuid]);
      
      if (result.rows.length > 0) {
          const { oib, firstname:firstName, lastname:lastName, timeofcreation:timeOfCreation } = result.rows[0];
          res.render('details', {
              oib,
              firstName,
              lastName,
              timeOfCreation,
              isAuthenticated: req.oidc.isAuthenticated()
          });
      } else {
          res.status(404).send('Data not found');
      }
  } catch (err) {
      console.error('Error fetching data from database:', err.stack);
      return res.status(500).json({ error: 'Failed to fetch data from database' });
  }
});


module.exports = router;
