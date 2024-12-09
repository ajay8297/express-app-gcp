const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { PubSub } = require('@google-cloud/pubsub');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 8080;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://realtime-ajay-446536.firebaseio.com'
});
const db = admin.firestore();

const pubSubClient = new PubSub();
const topicName = 'rate-limit-exceeded';

const client = redis.createClient({ url: 'redis://localhost:6379' });
client.connect();

app.use(bodyParser.json());

const checkRateLimit = async (button, ip) => {
  const key = `${button}:${ip}`;
  const limit = 10;
  const current = await client.get(key);

  if (current >= limit) {
    return false;
  }

  await client.multi()
    .incr(key)
    .expire(key, 60)
    .exec();
  return true;
};

app.post('/click', async (req, res) => {
  const { button, ip } = req.body;
  const rateLimitStatus = await checkRateLimit(button, ip);

  if (!rateLimitStatus) {
    const message = {
      button,
      ip,
      timestamp: new Date().toISOString()
    };
    await pubSubClient.topic(topicName).publishMessage({ json: message });
    return res.status(429).send('Rate limit exceeded');
  }

  const logRef = db.collection('clicks').doc();
  await logRef.set({
    button,
    ip,
    timestamp: admin.firestore.Timestamp.now()
  });

  res.send('Button clicked successfully!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
