import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'node:crypto';
import {
  applicationIdFrom,
  buildApplicationItem,
  corsHeaders,
  json,
  matchRoute,
  originOf,
  parseAllowedOrigins,
  parseApplication,
  parseListStatus,
  parseStaffPatch,
  publicStaffRecord,
  readBody,
} from './logic.mjs';

const ddb = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME;
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

export async function handler(event) {
  const origin = originOf(event);
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || '';
  const route = matchRoute(method, path);

  if (route === 'options') {
    return { statusCode: 204, headers: corsHeaders(origin, allowedOrigins), body: '' };
  }

  try {
    if (route === 'create') return await createApplication(event, origin);
    if (route === 'get') return await getApplication(event, origin);
    if (route === 'list') return await listApplications(event, origin);
    if (route === 'patch') return await patchApplication(event, origin);
    return json(404, { error: 'not_found' }, origin, allowedOrigins);
  } catch (error) {
    console.error('retreat_api_error', error?.name || 'Error');
    return json(500, { error: 'server_error' }, origin, allowedOrigins);
  }
}

async function createApplication(event, origin) {
  let payload;
  try {
    payload = readBody(event);
  } catch {
    return json(400, { error: 'invalid_json' }, origin, allowedOrigins);
  }

  const parsed = parseApplication(payload);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);

  const id = randomUUID();
  const submittedAt = new Date().toISOString();
  const item = buildApplicationItem({ id, submittedAt, fields: parsed.fields });

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item),
      ConditionExpression: 'attribute_not_exists(pk)',
    }),
  );

  return json(201, { id, status: 'submitted' }, origin, allowedOrigins);
}

async function getApplication(event, origin) {
  const id = applicationIdFrom(event);
  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
    }),
  );
  if (!result.Item) return json(404, { error: 'not_found' }, origin, allowedOrigins);
  return json(200, publicStaffRecord(unmarshall(result.Item)), origin, allowedOrigins);
}

async function listApplications(event, origin) {
  const parsed = parseListStatus(event.queryStringParameters?.status);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'status-submitted-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({ ':status': parsed.status }),
      ScanIndexForward: false,
      Limit: 50,
    }),
  );
  return json(
    200,
    { items: (result.Items || []).map((item) => publicStaffRecord(unmarshall(item))) },
    origin,
    allowedOrigins,
  );
}

async function patchApplication(event, origin) {
  const id = applicationIdFrom(event);
  let payload;
  try {
    payload = readBody(event);
  } catch {
    return json(400, { error: 'invalid_json' }, origin, allowedOrigins);
  }
  const parsed = parseStaffPatch(payload);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);

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
          ':status': parsed.status,
          ':note': parsed.note,
          ':reviewedAt': new Date().toISOString(),
          ':reviewedBy': String(actor).slice(0, 254),
        }),
        ReturnValues: 'ALL_NEW',
      }),
    );
    return json(200, publicStaffRecord(unmarshall(result.Attributes)), origin, allowedOrigins);
  } catch (error) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return json(404, { error: 'not_found' }, origin, allowedOrigins);
    }
    throw error;
  }
}
