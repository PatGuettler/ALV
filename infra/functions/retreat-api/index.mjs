import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
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
  assertCanManageStaffUser,
  buildApplicationItem,
  canResendStaffInvite,
  cognitoAttr,
  corsHeaders,
  isSuperAdminEmail,
  json,
  matchRoute,
  originOf,
  parseAllowedOrigins,
  parseApplication,
  parseInviteEmail,
  parseListStatus,
  parseStaffPatch,
  parseStaffUserPatch,
  parseSuperAdminEmails,
  publicStaffRecord,
  publicStaffUser,
  readBody,
  staffSummaryRecord,
  staffUserKeyFrom,
} from './logic.mjs';

const ddb = new DynamoDBClient({});
const cognito = new CognitoIdentityProviderClient({});
const tableName = process.env.TABLE_NAME;
const auditTableName = process.env.AUDIT_TABLE_NAME;
const userPoolId = process.env.USER_POOL_ID;
const reviewerGroupName = process.env.REVIEWER_GROUP_NAME || 'reviewer';
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const superAdminEmails = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);

function unauthorized(origin) {
  return json(401, { error: 'unauthorized' }, origin, allowedOrigins);
}

function forbidden(origin, error = 'forbidden') {
  return json(403, { error }, origin, allowedOrigins);
}

async function staffContext(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  const username = String(
    claims.username || claims['cognito:username'] || claims.sub || '',
  ).trim();
  if (!username || !userPoolId) return { ok: false, status: 401 };
  try {
    const user = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }),
    );
    if (user.Enabled === false) return { ok: false, status: 401 };
    const email = cognitoAttr(user, 'email').toLowerCase();
    const role = isSuperAdminEmail(email, superAdminEmails) ? 'super-admin' : 'reviewer';
    return { ok: true, username, email, role };
  } catch (error) {
    if (error?.name === 'UserNotFoundException') return { ok: false, status: 401 };
    throw error;
  }
}

async function requireStaff(event, origin) {
  const staff = await staffContext(event);
  if (!staff.ok) return { ok: false, response: unauthorized(origin) };
  return { ok: true, staff };
}

async function requireSuperAdmin(event, origin) {
  const result = await requireStaff(event, origin);
  if (!result.ok) return result;
  if (result.staff.role !== 'super-admin') {
    return { ok: false, response: forbidden(origin) };
  }
  return result;
}

function auditActorFrom(staff, event) {
  return String(staff?.email || event.requestContext?.authorizer?.jwt?.claims?.email || 'staff').slice(
    0,
    254,
  );
}

async function writeAudit(item) {
  if (!auditTableName) return;
  try {
    await ddb.send(
      new PutItemCommand({
        TableName: auditTableName,
        Item: marshall(item, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  } catch (error) {
    console.error('retreat_audit_error', error?.name || 'Error');
  }
}

async function writeStaffAudit({ actor, eventType, email, username }) {
  const occurredAt = new Date().toISOString();
  await writeAudit({
    pk: `STAFF#${email || username || actor}`,
    sk: `EVENT#${occurredAt}#${randomUUID()}`,
    eventType,
    actor,
    email: email || '',
    username: username || '',
    occurredAt,
  });
}

async function getCognitoUser(username) {
  return cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }));
}

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
    if (route === 'me') return await getStaffMe(event, origin);
    if (route === 'users') return await listStaffUsers(event, origin);
    if (route === 'invite') return await inviteStaffUser(event, origin);
    if (route === 'user_patch') return await patchStaffUser(event, origin);
    if (route === 'user_delete') return await deleteStaffUser(event, origin);
    if (route === 'get') return await getApplication(event, origin);
    if (route === 'list') return await listApplications(event, origin);
    if (route === 'patch') return await patchApplication(event, origin);
    return json(404, { error: 'not_found' }, origin, allowedOrigins);
  } catch (error) {
    console.error('retreat_api_error', error?.name || 'Error');
    return json(500, { error: 'server_error' }, origin, allowedOrigins);
  }
}

async function getStaffMe(event, origin) {
  const auth = await requireStaff(event, origin);
  if (!auth.ok) return auth.response;
  return json(
    200,
    {
      email: auth.staff.email,
      username: auth.staff.username,
      role: auth.staff.role,
    },
    origin,
    allowedOrigins,
  );
}

async function listAllCognitoUsers() {
  const users = [];
  let paginationToken;
  do {
    const result = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: 60,
        PaginationToken: paginationToken,
      }),
    );
    users.push(...(result.Users || []));
    paginationToken = result.PaginationToken;
  } while (paginationToken);
  return users;
}

async function listStaffUsers(event, origin) {
  const auth = await requireSuperAdmin(event, origin);
  if (!auth.ok) return auth.response;
  const items = (await listAllCognitoUsers())
    .map((user) => publicStaffUser(user, superAdminEmails))
    .sort((left, right) => {
      if (left.protected !== right.protected) return left.protected ? -1 : 1;
      return left.email.localeCompare(right.email);
    });
  return json(200, { items }, origin, allowedOrigins);
}

async function inviteStaffUser(event, origin) {
  const auth = await requireSuperAdmin(event, origin);
  if (!auth.ok) return auth.response;
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
  const parsed = parseInviteEmail(payload);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);
  const protectedUser = assertCanManageStaffUser(parsed.email, superAdminEmails);
  if (!protectedUser.ok) return forbidden(origin, protectedUser.error);

  try {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: parsed.email,
        DesiredDeliveryMediums: ['EMAIL'],
        UserAttributes: [
          { Name: 'email', Value: parsed.email },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );
    const username = created.User?.Username || parsed.email;
    try {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: reviewerGroupName,
        }),
      );
    } catch (error) {
      console.error('retreat_staff_group_error', error?.name || 'Error');
    }
    await writeStaffAudit({
      actor: auditActorFrom(auth.staff, event),
      eventType: 'STAFF_INVITED',
      email: parsed.email,
      username,
    });
    return json(
      201,
      { item: publicStaffUser(created.User || { Username: username, Enabled: true }, superAdminEmails) },
      origin,
      allowedOrigins,
    );
  } catch (error) {
    if (error?.name !== 'UsernameExistsException') throw error;
    let existing;
    try {
      existing = await getCognitoUser(parsed.email);
    } catch (lookupError) {
      if (lookupError?.name === 'UserNotFoundException') {
        return json(409, { error: 'user_exists' }, origin, allowedOrigins);
      }
      throw lookupError;
    }
    if (!canResendStaffInvite(existing.UserStatus)) {
      return json(409, { error: 'user_exists' }, origin, allowedOrigins);
    }
    const resent = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: parsed.email,
        MessageAction: 'RESEND',
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );
    await writeStaffAudit({
      actor: auditActorFrom(auth.staff, event),
      eventType: 'STAFF_INVITE_RESENT',
      email: parsed.email,
      username: existing.Username || parsed.email,
    });
    return json(
      200,
      {
        resent: true,
        item: publicStaffUser(resent.User || existing, superAdminEmails),
      },
      origin,
      allowedOrigins,
    );
  }
}

async function patchStaffUser(event, origin) {
  const auth = await requireSuperAdmin(event, origin);
  if (!auth.ok) return auth.response;
  const username = staffUserKeyFrom(event);
  if (!username) return json(400, { error: 'invalid_user' }, origin, allowedOrigins);
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
  const parsed = parseStaffUserPatch(payload);
  if (!parsed.ok) return json(400, { error: parsed.error }, origin, allowedOrigins);

  let current;
  try {
    current = publicStaffUser(await getCognitoUser(username), superAdminEmails);
  } catch (error) {
    if (error?.name === 'UserNotFoundException') {
      return json(404, { error: 'not_found' }, origin, allowedOrigins);
    }
    throw error;
  }
  const protectedUser = assertCanManageStaffUser(current.email, superAdminEmails);
  if (!protectedUser.ok) return forbidden(origin, protectedUser.error);

  await cognito.send(
    parsed.enabled
      ? new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username })
      : new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username }),
  );
  await writeStaffAudit({
    actor: auditActorFrom(auth.staff, event),
    eventType: parsed.enabled ? 'STAFF_RESTORED' : 'STAFF_REVOKED',
    email: current.email,
    username,
  });
  const updated = publicStaffUser(await getCognitoUser(username), superAdminEmails);
  return json(200, { item: updated }, origin, allowedOrigins);
}

async function deleteStaffUser(event, origin) {
  const auth = await requireSuperAdmin(event, origin);
  if (!auth.ok) return auth.response;
  const username = staffUserKeyFrom(event);
  if (!username) return json(400, { error: 'invalid_user' }, origin, allowedOrigins);

  let current;
  try {
    current = publicStaffUser(await getCognitoUser(username), superAdminEmails);
  } catch (error) {
    if (error?.name === 'UserNotFoundException') {
      return json(404, { error: 'not_found' }, origin, allowedOrigins);
    }
    throw error;
  }
  const protectedUser = assertCanManageStaffUser(current.email, superAdminEmails);
  if (!protectedUser.ok) return forbidden(origin, protectedUser.error);

  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  await writeStaffAudit({
    actor: auditActorFrom(auth.staff, event),
    eventType: 'STAFF_DELETED',
    email: current.email,
    username,
  });
  return json(200, { deleted: true, email: current.email }, origin, allowedOrigins);
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

  const occurredAt = submittedAt;
  try {
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: marshall(item, { removeUndefinedValues: true }),
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: auditTableName,
              Item: marshall({
                pk: `APP#${id}`,
                sk: `EVENT#${occurredAt}#${randomUUID()}`,
                applicationId: id,
                eventType: 'APPLICATION_SUBMITTED',
                actor: 'public',
                occurredAt,
              }),
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (error?.name !== 'TransactionCanceledException') throw error;
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
  const auth = await requireStaff(event, origin);
  if (!auth.ok) return auth.response;
  const id = applicationIdFrom(event);
  const result = await ddb.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ pk: `APP#${id}`, sk: 'VERSION#1' }),
    }),
  );
  if (!result.Item) return json(404, { error: 'not_found' }, origin, allowedOrigins);
  const viewedAt = new Date().toISOString();
  await writeAudit({
    pk: `APP#${id}`,
    sk: `EVENT#${viewedAt}#${randomUUID()}`,
    applicationId: id,
    eventType: 'APPLICATION_VIEWED',
    actor: auditActorFrom(auth.staff, event),
    occurredAt: viewedAt,
  });
  return json(200, publicStaffRecord(unmarshall(result.Item)), origin, allowedOrigins);
}

async function listApplications(event, origin) {
  const auth = await requireStaff(event, origin);
  if (!auth.ok) return auth.response;
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
  const items = (result.Items || []).map((item) => staffSummaryRecord(unmarshall(item)));
  const listedAt = new Date().toISOString();
  await writeAudit({
    pk: `STAFF#${auditActorFrom(auth.staff, event)}`,
    sk: `EVENT#${listedAt}#${randomUUID()}`,
    eventType: 'APPLICATION_LISTED',
    actor: auditActorFrom(auth.staff, event),
    status: parsed.status,
    itemCount: items.length,
    occurredAt: listedAt,
  });
  return json(200, { items }, origin, allowedOrigins);
}

async function patchApplication(event, origin) {
  const auth = await requireStaff(event, origin);
  if (!auth.ok) return auth.response;
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

  const actor = auditActorFrom(auth.staff, event);
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
                ':reviewedBy': actor,
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
                actor,
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
