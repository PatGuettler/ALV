import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { syncPublicEventsFeed } from './sync.mjs';

const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});

function env(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function readSecretToken(secretArn) {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return result.SecretString || '';
}

async function readPreviousFeed(bucket, key) {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await result.Body.transformToString());
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function handler() {
  const bucket = env('FEED_BUCKET');
  const key = env('FEED_OBJECT_KEY');
  const result = await syncPublicEventsFeed({
    token: await readSecretToken(env('GHL_TOKEN_SECRET_ARN')),
    locationId: env('GHL_LOCATION_ID'),
    calendarId: env('GHL_EVENTS_CALENDAR_ID'),
    previousFeed: await readPreviousFeed(bucket, key),
  });

  if (!result.unchanged) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: `${JSON.stringify(result.feed)}\n`,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=15',
      }),
    );
  }

  console.log(
    'events_sync',
    JSON.stringify({
      unchanged: result.unchanged,
      eventCount: result.feed.events.length,
      recordCount: result.recordCount,
    }),
  );
  return { unchanged: result.unchanged, eventCount: result.feed.events.length };
}
