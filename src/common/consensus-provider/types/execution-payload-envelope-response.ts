import { ExecutionPayload } from './execution-payload';

export type ExecutionPayloadEnvelopeResponse = {
  data: {
    message: {
      payload: ExecutionPayload;
    };
  };
};
