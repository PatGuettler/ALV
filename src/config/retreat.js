export const retreatPublic = {
  apiUrl: 'https://p364msgsc2.execute-api.us-east-1.amazonaws.com',
  cognitoDomain: 'https://alv-prod-retreat-286801153738.auth.us-east-1.amazoncognito.com',
  clientId: '37tsmb3p4du202e1vmstblsrui',
};

export const retreatLive = Boolean(
  retreatPublic.apiUrl && retreatPublic.cognitoDomain && retreatPublic.clientId,
);
