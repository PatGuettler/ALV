import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'node:crypto';

const ddb = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const ALLOWED_STATUSES = new Set(['submitted', 'approved', 'declined']);

function corsHeaders(origin) {
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  };
}

function originOf(event) {
  return event.headers?.origin || event.headers?.Origin || '';
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export async function handler(event) {
  const origin = originOf(event);
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || '';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  try {
    if (method === 'POST' && path.endsWith('/v1/applications')) {
      return await createApplication(event, origin);
    }
    if (method === 'GET' && /\/v1\/staff\/applications\/[^/]+$/.test(path)) {
      return await getApplication(event, origin);
    }
    if (method === 'GET' && path.endsWith('/v1/staff/applications')) {
      return await listApplications(event, origin);
    }
    if (method === 'PATCH' && /\/v1\/staff\/applications\/[^/]+$/.test(path)) {
      return await patchApplication(event, origin);
    }
    return json(404, { error: 'not_found' }, origin);
  } catch (error) {
    console.error('retreat_api_error', error?.name || 'Error');
    return json(500, { error: 'server_error' }, origin);
  }
}

async function createApplication(event, origin) {
  let payload;
  try {
    payload = readBody(event);
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  const fullName = cleanText(payload.fullName, 120);
  const email = cleanText(payload.email, 254).toLowerCase();
  const phone = cleanText(payload.phone, 40);
  const program = cleanText(payload.program, 80);
  const message = cleanText(payload.message, 1000);
  const consent = payload.consent === true;

  if (!fullName || !email.includes('@') || !consent) {
    return json(400, { error: 'invalid_application' }, origin);
  }

  const id = randomUUID();
  const submittedAt = new Date().toISOString();
  const item = {
    pk: `APP#${id}`,
    sk: 'VERSION#1',
    id,
    fullName,
    email,
    phone,
    program,
    message,
    consent,
    status: 'submitted',
    submittedAt,
    version: 1,
  };

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item),
      ConditionExpression: 'attribute_not_exists(pk)',
    }),
  );

  return json(201, { id, status: 'submitted' }, origin);
}

function applicationIdFrom(event) {
  const path = event.rawPath || event.path || '';
  const parts = path.split('/');
  return parts[parts.length - 1];
}

async function getApplication(event, origin) {
  const id = applicationIdFrom(event);
  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
    }),
  );
  if (!result.Item) return json(404, { error: 'not_found' }, origin);
  return json(200, publicStaffRecord(unmarshall(result.Item)), origin);
}

async function listApplications(event, origin) {
  const status = cleanText(event.queryStringParameters?.status || 'submitted', 40) || 'submitted';
  if (!ALLOWED_STATUSES.has(status)) {
    return json(400, { error: 'invalid_status' }, origin);
  }
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'status-submitted-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({ ':status': status }),
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return json(200, { items: (result.Items || []).map((item) => publicStaffRecord(unmarshall(item))) }, origin);
}

async function patchApplication(event, origin) {
  const id = applicationIdFrom(event);
  let payload;
  try {
    payload = readBody(event);
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }
  const status = cleanText(payload.status, 40);
  const note = cleanText(payload.note, 500);
  if (!ALLOWED_STATUSES.has(status)) {
    return json(400, { error: 'invalid_status' }, origin);
  }

  const actor = event.requestContext?.authorizer?.jwt?.claims?.email || 'staff';
  try {
    const result = await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
        ConditionExpression: 'attribute_exists(pk)',
        UpdateExpression:
          'SET #status = :status, note = :note, reviewedAt = :reviewedAt, reviewedBy = :reviewedBy',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: marshall({
          ':status': status,
          ':note': note,
          ':reviewedAt': new Date().toISOString(),
          ':reviewedBy': String(actor).slice(0, 254),
        }),
        ReturnValues: 'ALL_NEW',
      }),
    );
    return json(200, publicStaffRecord(unmarshall(result.Attributes)), origin);
  } catch (error) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return json(404, { error: 'not_found' }, origin);
    }
    throw error;
  }
}

function publicStaffRecord(item) {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    phone: item.phone,
    program: item.program,
    message: item.message,
    status: item.status,
    submittedAt: item.submittedAt,
    note: item.note || '',
    reviewedAt: item.reviewedAt || null,
  };
}
