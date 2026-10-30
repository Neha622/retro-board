// Where the shared board lives on AWS (plan §2, §3, §11).
// The API key is meant to be public: it only lets the app use the board's GraphQL operations,
// and AWS checks every rule itself (plan §5.17, §9). It expires about April 2027, with the AWS free plan.
// Works as a classic browser script (sets window.RetroConfig) and as a Node module.
(function (root) {
  'use strict';

  const RetroConfig = {
    graphqlUrl: 'https://izhds5xkvfghdffwqxbvv7azvu.appsync-api.eu-north-1.amazonaws.com/graphql',
    realtimeUrl: 'wss://izhds5xkvfghdffwqxbvv7azvu.appsync-realtime-api.eu-north-1.amazonaws.com/graphql',
    apiKey: 'da2-7ge2ndpmxbelpc4glm3fp5ruwy',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RetroConfig;
  else root.RetroConfig = RetroConfig;
})(typeof globalThis !== 'undefined' ? globalThis : this);
