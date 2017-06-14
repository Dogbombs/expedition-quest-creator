// Hierarchical node.js configuration with command-line arguments, environment
// variables, and files.
const nconf = module.exports = require('nconf');
const path = require('path');
const Braintree = require("braintree");

nconf
  // 1. Command-line arguments
  .argv()
  // 2. Environment variables
  .env([
    'BRAINTREE_ENVIRONMENT',
    'BRAINTREE_MERCHANT_ID',
    'BRAINTREE_PUBLIC_KEY',
    'BRAINTREE_PRIVATE_KEY',
    'CLOUD_BUCKET',
    'GCLOUD_PROJECT',
    'MAIL_EMAIL',
    'MAIL_PASSWORD',
    'MAILCHIMP_KEY',
    'MAILCHIMP_CREATORS_LIST_ID',
    'MAILCHIMP_PLAYERS_LIST_ID',
    'NODE_ENV',
    'OAUTH2_CLIENT_ID',
    'OAUTH2_CLIENT_SECRET',
    'OAUTH2_CALLBACK',
    'DATABASE_URL',
    'PORT',
    'SECRET',
    'SUBSCRIPTION_NAME',
    'TOPIC_NAME',
    'SESSION_SECRET',
  ])
  // 3. Config file
  .file({ file: path.join(__dirname, 'config.json') })
  // 4. Defaults
  .defaults({
    BRAINTREE_ENVIRONMENT: 'Sandbox',
    // Typically you will create a bucket with the same name as your project ID.
    CLOUD_BUCKET: '',

    // This is the id of your project in the Google Cloud Developers Console.
    GCLOUD_PROJECT: '',

    MAILCHIMP_CREATORS_LIST_ID: 'baafc66d1b',
    MAILCHIMP_PLAYERS_LIST_ID: '541cd63169',
    OAUTH2_CLIENT_ID: '',
    OAUTH2_CLIENT_SECRET: '',
    OAUTH2_CALLBACK: 'http://localhost:8080/auth/google/callback',

    DATABASE_URL: '',
    PORT: 8080,
    SESSION_SECRET: '',
  });

// Check for required settings
checkConfig('GCLOUD_PROJECT');
checkConfig('CLOUD_BUCKET');
checkConfig('OAUTH2_CLIENT_ID');
checkConfig('OAUTH2_CLIENT_SECRET');

function checkConfig (setting) {
  if (!nconf.get(setting)) {
    throw new Error('You must set the ' + setting + ' environment variable or' +
      ' add it to config.json!');
  }
}
