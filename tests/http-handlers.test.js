import { describe, it } from 'mocha';
import { expect } from 'chai';
import { httpCodes, CustomError } from '../components/http-handlers.js';

describe('HTTP Handlers', () => {
  describe('httpCodes', () => {
    it('should have correct HTTP status codes', () => {
      expect(httpCodes.OK).to.equal(200);
      expect(httpCodes.BAD_REQUEST).to.equal(400);
      expect(httpCodes.NOT_FOUND).to.equal(404);
    });
  });

  describe('CustomError', () => {
    it('should create a CustomError', () => {
      const error = new CustomError(404, 'Not found');
      expect(error.code).to.equal(404);
      expect(error.message).to.equal('Not found');
    });
  });
});
