const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const Sequelize = require('sequelize');
const { User, Item, Trade } = require('./models');
const { Op } = require('sequelize');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('/Users/kristinagiannoutsos/fire-base-project/my-firebase-project.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const upload = multer({ dest: 'public/images/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public/images', express.static('images'));

app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 2592000000,
    },
  })
);

//test for accessibility
app.get('/heartbeat', (req, res) => {
  res.json({
    is: 'working',
  });
});

app.get('/list-items', async (req, res) => {
  const items = await Item.findAll({
    where: {
      userAccount: req.session.user,
    },
  });
  res.json(items);
});

app.post('/new-item', upload.single('image'), async (req, res) => {
  // req.body contains an Object with firstName, lastName, email
  const { description, category, userAccount, name } = req.body;
  const image = req.file.filename;

  const newPost = await Item.create({
    description,
    image,
    category,
    userAccount,
    name,
  });

  // Send back the new user's ID in the response:
  const items = await Item.findAll({
    where: {
      userAccount: req.session.user,
    },
  });
  res.json(items);
});

app.post('/update-item', upload.single('image'), async (req, res) => {
  // req.body contains an Object with firstName, lastName, email
  const { description, category, userAccount, name } = req.body;
  const image = req.file.filename;

  const newPost = await Item.update(
    {
      description,
      image,
      category,
      name,
    },
    {
      where: {
        userAccount: userAccount,
      },
    }
  );

  // Send back the new user's ID in the response:
  const items = await Item.findAll({
    where: {
      userAccount: req.session.user,
    },
  });
  res.json(items);
});

app.get('/images/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const readStream = fs.createReadStream(`public/images/${imageName}`);
  readStream.pipe(res);
});

app.delete('/delete-item/:id', async (req, res) => {
  const { id } = req.params;

  fs.rm('public/images/' + req.body.image, { force: true }, (err) => {
    if (err) {
      // File deletion failed
      console.error(err.message);
      return;
    }
    console.log('File deleted successfully');
  });
  const removeItem = await Item.destroy({
    where: {
      id,
    },
  });
  res.json(removeItem);
});

app.get('/check-auth', async (req, res) => {
  if (req.session.user) {
    res.send({
      isLoggedIn: !(req.session.user == null),
      email: req.session.user,
    });
  } else {
    res.send({
      isLoggedIn: !(req.session.user == null),
      email: 'unassigned',
    });
  }
});

app.post('/login', async (req, res) => {
  const user = await User.findAll({
    where: {
      email: {
        [Op.eq]: req.body.email,
      },
    },
  });
  if (user[0] == null) {
    res.json({ success: false, message: 'Email or password invalid' });
  } else {
    bcrypt.compare(req.body.password, user[0].password, function (err, result) {
      if (result && req.body.email === user[0].email) {
        req.session.user = req.body.email;
        res.json({
          success: true,
          message: 'Login success',
          userID: user[0].id,
        });
      } else {
        res.json({ success: false, message: 'Email or password invalid' });
      }
    });
  }
});

app.post('/create_account', async (req, res) => {
  const user = await User.findAll({
    where: {
      email: {
        [Op.eq]: req.body.email,
      },
    },
  });
  if (user[0] == null) {
    bcrypt.hash(req.body.password, 10, function (err, hash) {
      User.create({
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        password: hash,
      });
    });
    res.json({ success: true, message: 'Create success' });
  } else {
    res.json({ success: false, message: 'Email or password invalid' });
  }
});

app.get('/logout', async (req, res) => {
  req.session.destroy();
  res.send({
    isLoggedIn: false,
  });
});

//routes for Item Browsing
//All Item Fetch
app.get('/fetchAllItems', async (req, res) => {
  const items = await Item.findAll();
  res.json(items);
});

//Catagory Fetch used in ItemBrowsePage.js component
app.get('/fetchCatagory/:catagory', async (req, res) => {
  const { catagory } = req.params;
  const items = await Item.findAll({
    where: {
      category: catagory,
      userAccount: {
        [Op.and]: [
          {
            [Op.notIn]: Sequelize.literal(
              `(select "offerorID" from "Trades" where "offereeID" = '${req.session.user}')`
            ),
          },
          {
            [Op.notIn]: Sequelize.literal(
              `(select "offereeID" from "Trades" where "offerorID" = '${req.session.user}')`
            ),
          },
          { [Op.ne]: req.session.user },
        ],
      },
    },
  });
  res.json(items);
});

//Route for My Item
app.get('/myItem/:userId', async (req, res) => {
  const { userId } = req.params;
  const myItem = await Item.findAll({
    where: {
      userID: userId,
    },
  });
  res.json(myItem);
});

//Route to get pending trades by offeror
app.post('/pending-offeror', async (req, res) => {
  const { offerorID } = req.body;
  const myTrade = await Trade.findAll({
    where: {
      offerorID: offerorID,
      status: 'pending',
    },
  });
  res.json(myTrade);
});

//Route to get pending trades by offeree
app.post('/pending-offeree', async (req, res) => {
  const { offereeID } = req.body;
  const myTrade = await Trade.findAll({
    where: {
      offereeID: offereeID,
      status: 'pending',
    },
  });
  res.json(myTrade);
});

//Route to Trade Item used in TradeButton.js component
app.post('/Trade', async (req, res) => {
  const { offerorID, offereeID, itemID, offerorItemID } = req.body;
  const NewTrade = await Trade.upsert(
    {
      offerorID,
      offereeID,
      itemID,
      offerorItemID,
    },
    {
      conflictFields: ['offerorID'],
    }
  );
  res.json({
    id: NewTrade.ID,
  });
});

//Route to accept trade offer
app.post('/accept-trade', async (req, res) => {
  const { offerorID, offereeID } = req.body;

  await Trade.update(
    { status: 'pending' },
    {
      where: {
        offerorID: offerorID,
      },
    }
  );

  await Trade.destroy({
    where: {
      [Op.or]: [
        { offerorID: offereeID },
        { [Op.and]: [{ offereeID: offereeID }, { status: null }] },
        { offereeID: offerorID },
      ],
    },
  });

  const status = await Trade.findAll({
    where: {
      offerorID: offerorID,
    },
  });

  res.json(status);
});

//Route to finalize pending trade by offeror
app.post('/offeror-approve', async (req, res) => {
  const { offerorID, offereeID, itemID, offerorItemID } = req.body;

  await Trade.update(
    { offerorAccepted: true },
    {
      where: {
        offerorID: offerorID,
      },
    }
  );

  const tradeFinal = await Trade.findAll({
    attributes: ['offereeAccepted'],
    where: {
      offerorID: offerorID,
    },
  });

  if (tradeFinal[0].offereeAccepted) {
    console.log('Trade Completed');

    await Item.update(
      { userAccount: offereeID },
      {
        where: {
          id: offerorItemID,
        },
      }
    );
    await Item.update(
      { userAccount: offerorID },
      {
        where: {
          id: itemID,
        },
      }
    );
    await Trade.update(
      { status: 'completed' },
      {
        where: {
          offerorID: offerorID,
        },
      }
    );
    res.json({ status: 'Items Swapped' });
  } else {
    res.json({ status: 'trade still waiting for offeree' });
  }
});

//Route to finalize pending trade by offeror
app.post('/offeree-approve', async (req, res) => {
  const { offerorID, offereeID, itemID, offerorItemID } = req.body;

  await Trade.update(
    { offereeAccepted: true },
    {
      where: {
        offerorID: offerorID,
      },
    }
  );

  const tradeFinal = await Trade.findAll({
    attributes: ['offerorAccepted'],
    where: {
      offerorID: offerorID,
    },
  });

  if (tradeFinal[0].offerorAccepted) {
    console.log('Trade Completed');

    await Item.update(
      { userAccount: offereeID },
      {
        where: {
          id: offerorItemID,
        },
      }
    );
    await Item.update(
      { userAccount: offerorID },
      {
        where: {
          id: itemID,
        },
      }
    );
    await Trade.update(
      { status: 'completed' },
      {
        where: {
          offerorID: offerorID,
        },
      }
    );
    res.json({ status: 'Items Swapped' });
  } else {
    res.json({ status: 'trade still waiting for offeror' });
  }
});

//routes for fetching offers
app.get('/fetchoffers/:id', async (req, res) => {
  const { id } = req.params;
  const offers = await Trade.findAll({
    where: {
      offereeID: id,
    },
  });
  res.json(offers);
});

app.get('/offerinfo/:offerorID/:itemID', async (req, res) => {
  const { offerorID, itemID } = req.params;

  const itemInfo = await Item.findAll({
    where: {
      id: itemID,
    },
  });
  const offerorInfo = await User.findAll({
    where: {
      id: offerorID,
    },
    attributes: ['id', 'firstName'],
  });
  const offerInfo = [itemInfo[0], offerorInfo[0]];
  res.json(offerInfo);
});

/* Firebase Route for UID */

// Route to create a new Firebase user based on an existing user in the database
app.post('/createFirebaseUser', async (req, res) => {
  const existingUser = req.body;

  try {
    const { uid } = await admin.auth().createUser({
      email: existingUser.email,
      password: existingUser.password,
    });

    // Add the new Firebase UID to the existing user in the database
    await User.update({ firebaseUID: uid }, { where: { id: existingUser.id } });

    res.status(200).send(uid);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// Route to authenticate a user based on their Firebase UID
app.post('/authenticateFirebaseUser', async (req, res) => {
  const firebaseUID = req.body.email;

  try {
    const userRecord = await admin.auth().getUser(firebaseUID);

    // Check if user exists and is enabled
    if (userRecord && userRecord.emailVerified) {
      // Retrieve the user from the database based on the Firebase UID
      const userData = await User.findOne({ where: { firebaseUID } });

      if (userData) {
        res.status(200).send(userData);
      } else {
        res.status(404).send('User not found');
      }
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

/* Main app routes */

const server = app.listen(3001, function () {
  console.log('listening on port 3001');
});
