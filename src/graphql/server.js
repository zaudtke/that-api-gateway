import _ from 'lodash';
import { ApolloServer } from 'apollo-server-cloud-functions';
import { ApolloGateway, RemoteGraphQLDataSource } from '@apollo/gateway';
import debug from 'debug';
import { graph } from '@thatconference/api';

const dlog = debug('that:api:gateway:graphql');
const { lifecycle } = graph.events;

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  constructor(url) {
    dlog('constructor');
    super({ url });
  }

  // eslint-disable-next-line class-methods-use-this
  willSendRequest({ request, context }) {
    dlog('sending request (todo: add something here about request)');

    if (!_.isNil(context)) {
      dlog('user has context, calling child services, and setting headers');

      if (context.authToken)
        request.http.headers.set('Authorization', context.authToken);

      if (context.correlationId)
        request.http.headers.set('that-correlation-id', context.correlationId);

      if (context.enableMocks)
        request.http.headers.set('that-enable-mocks', context.enableMocks);
    }
  }
}

/**
 * will create you a configured instance of an apollo gateway
 * @param {object} userContext - user context that w
 * @return {object} a configured instance of an apollo gateway.
 *
 * @example
 *
 *     createGateway(userContext)
 */
const createGateway = logger =>
  new ApolloGateway({
    serviceList: [
      {
        name: 'Events',
        url: process.env.THAT_API_EVENTS,
      }, // port: 8001
      {
        name: 'Partners',
        url: process.env.THAT_API_PARTNERS,
      }, // port: 8002
      {
        name: 'Sessions',
        url: process.env.THAT_API_SESSIONS,
      }, // port: 8003
      {
        name: 'Members',
        url: process.env.THAT_API_MEMBERS,
      }, // port: 8004
    ],

    // for every child service we want to add information to the request header.
    buildService({ name, url }) {
      dlog(`building schema for ${name} : ${url}`);
      return new AuthenticatedDataSource(url);
    },
    debug: JSON.parse(process.env.ENABLE_GRAPH_GATEWAY_DEBUG_MODE || false),
  });

const createServer = logger =>
  new ApolloServer({
    gateway: createGateway(logger),
    subscriptions: false,
    introspection: JSON.parse(process.env.ENABLE_GRAPH_INTROSPECTION || false),
    playground: JSON.parse(process.env.ENABLE_GRAPH_PLAYGROUND)
      ? { endpoint: '/' }
      : false,

    context: async ({ req: { userContext } }) => userContext,

    // plugins: [
    //   {
    //     requestDidStart(req) {
    //       return {
    //         executionDidStart(requestContext) {
    //           // const { operation, context } = requestContext;

    //           // console.log(requestContext.source);
    //           // lifecycle.emit('executionDidStart', {
    //           //   service: 'that:api:gateway',
    //           //   requestContext,
    //           // });
    //         },
    //       };
    //     },
    //   },
    // ],

    formatError: err => {
      logger.warn(err);
      return err;
    },
  });
export default createServer;