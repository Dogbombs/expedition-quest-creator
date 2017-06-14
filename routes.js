const express = require('express');
const Braintree = require('braintree');
const fs = require('fs');
const Joi = require('joi');
const Mailchimp = require('mailchimp-api-v3');
const passport = require('passport');
const querystring = require('querystring');
const React = require('react');

const Config = require('./config');
const Feedback = require('./models/feedback');
const Mail = require('./mail');
const oauth2 = require('./lib/oauth2');
const Quests = require('./models/quests');

const gateway = Braintree.connect({
  environment: Braintree.Environment[Config.get('BRAINTREE_ENVIRONMENT')],
  merchantId: Config.get('BRAINTREE_MERCHANT_ID'),
  publicKey: Config.get('BRAINTREE_PUBLIC_KEY'),
  privateKey: Config.get('BRAINTREE_PRIVATE_KEY'),
});

const mailchimp = (process.env.NODE_ENV !== 'dev') ? new Mailchimp(Config.get('MAILCHIMP_KEY')) : null;

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please contact support by emailing Expedition@Fabricate.io';

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
const router = express.Router();
router.use(oauth2.template);


router.get('/', (req, res) => {
  res.render('app', {
    state: JSON.stringify(res.locals),
  });
});

// Phasing out as of 3/21/17; delete any time after 4/14/17
// Joi validation: require title, author, email (valid email), feedback, players, difficulty
// userEmail (valid email), platform, shareUserEmail (default false), version (number)
router.post('/feedback', (req, res) => {
  const params = JSON.parse(req.body);
  // strip all HTML tags for protection, then replace newlines with br's
  const HTML_REGEX = /<(\w|(\/\w))(.|\n)*?>/igm;
  const title = params.title.replace(HTML_REGEX, '');
  const htmlFeedback = params.feedback.replace(HTML_REGEX, '').replace(/(?:\r\n|\r|\n)/g, '<br/>');
  let shareUserEmail = '';
  if (params.shareUserEmail && params.userEmail) {
    shareUserEmail = `<p>If you'd like to contact them about their feedback, you can reach them at <a href="mailto:${params.userEmail}">${params.userEmail}</a>.</p>`
  }

  const htmlMessage = `<p>${params.author}, some adventurers sent you feedback on <i>${title}</i>. Hooray! Their feedback:</p>
  <p>"${htmlFeedback}"</p>
  <p>They played with ${params.players} adventurers on ${params.difficulty} difficulty on ${params.platform} v${params.version}.</p>
  ${shareUserEmail}
  <p>If you have questions or run into bugs with the Quest Creator, you can reply directly to this email.</p>
  <p>Happy Adventuring!</p>
  <p>Todd & Scott</p>`;

  res.header('Access-Control-Allow-Origin', req.get('origin'));
  Mail.send(params.email, 'Feedback on your Expedition quest: ' + title, htmlMessage, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send(GENERIC_ERROR_MESSAGE);
    } else {
      return res.send(result.response);
    }
  });
});


router.post('/quests', (req, res) => {
  try {
    const token = req.params.token;
    if (!res.locals.id) {
      res.header('Access-Control-Allow-Origin', req.get('origin'));
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.send(JSON.stringify([]));
    }

    const params = req.body;
    Quests.search(res.locals.id, params, (err, quests, nextToken) => {
      if (err) {
        res.header('Access-Control-Allow-Origin', req.get('origin'));
        res.header('Access-Control-Allow-Credentials', 'true');
        console.log(err);
        return res.status(500).send(GENERIC_ERROR_MESSAGE);
      }
      result = {error: err, quests: quests, nextToken: nextToken};
      console.log("Found " + quests.length + " quests for user " + res.locals.id);
      res.header('Access-Control-Allow-Origin', req.get('origin'));
      res.header('Access-Control-Allow-Credentials', 'true');
      res.send(JSON.stringify(result));
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send(GENERIC_ERROR_MESSAGE);
  }
});


router.get('/raw/:quest', (req, res) => {
  Quests.getById(req.params.quest, (err, entity) => {
    if (err) {
      return res.status(500).send(GENERIC_ERROR_MESSAGE);
    }
    res.header('Access-Control-Allow-Origin', req.get('origin'));
    res.header('Content-Type', 'text/xml');
    res.header('Location', entity.url);
    res.status(301).end();
  });
});


router.post('/publish/:quest', (req, res) => {

  if (!res.locals.id) {
    return res.status(500).end("You are not signed in. Please sign in (by refreshing the page) to save your quest.");
  }

  try {
    Quests.publish(res.locals.id, req.params.quest, req.body, (err, id) => {
      if (err) {
        throw new Error(err);
      }
      console.log("Published quest " + id);
      res.end(id);
    });
  } catch(e) {
    console.log(e);
    return res.status(500).send(GENERIC_ERROR_MESSAGE);
  }
});


router.post('/unpublish/:quest', (req, res) => {

  if (!res.locals.id) {
    return res.status(500).end("You are not signed in. Please sign in (by refreshing the page) to save your quest.");
  }

  try {
    Quests.unpublish(req.params.quest, (err, id) => {
      if (err) {
        throw new Error(err);
      }
      console.log("Unpublished quest " + id);
      res.end(id.toString());
    });
  } catch(e) {
    console.log(e);
    return res.status(500).send(GENERIC_ERROR_MESSAGE);
  }
});


router.post('/quest/feedback/:type', (req, res) => {
  try {
    Feedback.submit(req.params.type, req.body, (err, id) => {
      if (err) {
        throw new Error(err);
      }
      res.header('Access-Control-Allow-Origin', req.get('origin'));
      res.header('Access-Control-Allow-Credentials', 'true');
      res.end(id);
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send(GENERIC_ERROR_MESSAGE);
  }
});


router.post('/user/subscribe', (req, res) => {
  req.body = JSON.parse(req.body);
  Joi.validate(req.body.email, Joi.string().email().invalid(''), (err, email) => {

    if (err) {
      return res.status(400).send('Valid email address required.');
    }

    if (!mailchimp) {
      return res.status(200).send();
    } else {
      mailchimp.post('/lists/' + Config.get('MAILCHIMP_PLAYERS_LIST_ID') + '/members/', {
        email_address: email,
        status: 'pending',
        merge_fields: {
          SOURCE: 'app',
        },
      })
      .then((result) => {
        console.log(email + ' subscribed as pending to player list');
        return res.status(200).send();
      })
      .catch((err) => {
        console.log('Mailchimp error', err);
        return res.status(err.status).send(err.title);
      });
    }
  });
});


router.get('/braintree/token', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.get('origin'));
  res.header('Access-Control-Allow-Credentials', 'true');
  gateway.clientToken.generate({}, (err, response) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Error generating payment token.');
    }
    res.send(response.clientToken);
  });
});


router.post('/braintree/checkout', (req, res) => {
  req.body = JSON.parse(req.body);
  res.header('Access-Control-Allow-Origin', req.get('origin'));
  res.header('Access-Control-Allow-Credentials', 'true');
  gateway.transaction.sale({
    amount: req.body.amount,
    paymentMethodNonce: req.body.nonce,
    options: {
      submitForSettlement: true,
    },
  }, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Error submitting payment.');
    }
    res.send(result);
  });
});


module.exports = router;
