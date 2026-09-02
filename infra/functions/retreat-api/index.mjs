import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
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
  staffSummaryRecord,
} from './logic.mjs';

const ddb = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME;
const auditTableName = process.env.AUDIT_TABLE_NAME;
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
  } catch (error) {
    return json(
      error instanceof RangeError ? 413 : 400,
      { error: error instanceof RangeError ? 'body_too_large' : 'invalid_json' },
      origin,
      allowedOrigins,
    );
  }

  const parsed = parseApplication(payload);
  if (!parsed.ok) {
    return json(
      400,
      { error: parsed.error, field: parsed.field || '', message: parsed.message || '' },
      origin,
      allowedOrigins,
    );
  }

  const id = parsed.id;
  const submittedAt = new Date().toISOString();
  const item = buildApplicationItem({ id, submittedAt, fields: parsed.fields });

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (error) {
    if (error?.name !== 'ConditionalCheckFailedException') throw error;
    const existing = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
        ProjectionExpression: 'id, #status',
        ExpressionAttributeNames: { '#status': 'status' },
      }),
    );
    if (!existing.Item) throw error;
    const record = unmarshall(existing.Item);
    return json(
      200,
      { id: record.id, status: record.status, duplicate: true },
      origin,
      allowedOrigins,
    );
  }

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
    { items: (result.Items || []).map((item) => staffSummaryRecord(unmarshall(item))) },
    origin,
    allowedOrigins,
  );
}

async function patchApplication(event, origin) {
  const id = applicationIdFrom(event);
  let payload;
  try {
    payload = readBody(event);
  } catch (error) {
    return json(
      error instanceof RangeError ? 413 : 400,
      { error: error instanceof RangeError ? 'body_too_large' : 'invalid_json' },
      origin,
      allowedOrigins,
    );
  }
  const parsed = parseStaffPatch(payload);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);

  const actor = event.requestContext?.authorizer?.jwt?.claims?.email || 'staff';
  const reviewedAt = new Date().toISOString();
  try {
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
              ConditionExpression: 'attribute_exists(pk) AND version = :expectedVersion',
              UpdateExpression:
                'SET #status = :status, note = :note, reviewedAt = :reviewedAt, reviewedBy = :reviewedBy, version = version + :one',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: marshall({
                ':status': parsed.status,
                ':note': parsed.note,
                ':reviewedAt': reviewedAt,
                ':reviewedBy': String(actor).slice(0, 254),
                ':expectedVersion': parsed.expectedVersion,
                ':one': 1,
              }),
            },
          },
          {
            Put: {
              TableName: auditTableName,
              Item: marshall({
                pk: `APP#${id}`,
                sk: `EVENT#${reviewedAt}#${randomUUID()}`,
                applicationId: id,
                eventType: 'STATUS_CHANGED',
                status: parsed.status,
                actor: String(actor).slice(0, 254),
                occurredAt: reviewedAt,
                applicationVersion: parsed.expectedVersion + 1,
              }),
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
        ],
      }),
    );
    const result = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
      }),
    );
    return json(200, publicStaffRecord(unmarshall(result.Item)), origin, allowedOrigins);
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      const current = await ddb.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
          ProjectionExpression: 'id, version',
        }),
      );
      return current.Item
        ? json(409, { error: 'version_conflict' }, origin, allowedOrigins)
        : json(404, { error: 'not_found' }, origin, allowedOrigins);
    }
    throw error;
  }
}
