const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { PubSub } = require('@google-cloud/pubsub');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 8080;

// Firebase setup
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://<your-project-id>.firebaseio.com'
});
const db = admin.firestore();

// Pub/Sub setup
const pubSubClient = new PubSub();
const topicName = 'rate-limit-exceeded';

// Redis setup for rate limiting
const client = redis.createClient({ url: 'redis://localhost:6379' });
client.connect();

app.use(bodyParser.json());

// Helper function to check rate limits
const checkRateLimit = async (button, ip) => {
  const key = `${button}:${ip}`;
  const limit = 10;
  const current = await client.get(key);

  if (current >= limit) {
    return false;
  }

  await client.multi()
    .incr(key)
    .expire(key, 60)  // expire after 1 minute
    .exec();
  return true;
};

app.post('/click', async (req, res) => {
  const { button, ip } = req.body;
  const rateLimitStatus = await checkRateLimit(button, ip);

  if (!rateLimitStatus) {
    // Publish to Pub/Sub if limit reached
    const message = {
      button,
      ip,
      timestamp: new Date().toISOString()
    };
    await pubSubClient.topic(topicName).publishMessage({ json: message });
    return res.status(429).send('Rate limit exceeded');
  }

  // Log to Firestore
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
