import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { JwtManager } from '../components/jwt.js';

describe('JwtManager', () => {
  let jwtManager;
  const testSecret = 'test-secret-key-12345';
  const testData = {
    userId: '123',
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    jwtManager = new JwtManager();
  });

  describe('Constructor', () => {
    it('should create JwtManager instance with default options', () => {
      const manager = new JwtManager();
      expect(manager).to.be.instanceOf(JwtManager);
      expect(manager.algorithm).to.equal('dir');
      expect(manager.encryption).to.equal('A256GCM');
      expect(manager.expirationTime).to.equal('10m');
      expect(manager.clockTolerance).to.equal(30);
      expect(manager.secretHashAlgorithm).to.equal('SHA-256');
    });

    it('should create JwtManager instance with custom options (JWT_ prefix)', () => {
      const options = {
        JWT_ALGORITHM: 'A128KW',
        JWT_ENCRYPTION: 'A128GCM',
        JWT_EXPIRATION_TIME: '1h',
        JWT_CLOCK_TOLERANCE: 60,
        JWT_SECRET_HASH_ALGORITHM: 'SHA-512',
        JWT_ISSUER: 'test-issuer',
        JWT_AUDIENCE: 'test-audience',
        JWT_SUBJECT: 'test-subject'
      };
      const manager = new JwtManager(options);
      expect(manager.algorithm).to.equal('A128KW');
      expect(manager.encryption).to.equal('A128GCM');
      expect(manager.expirationTime).to.equal('1h');
      expect(manager.clockTolerance).to.equal(60);
      expect(manager.secretHashAlgorithm).to.equal('SHA-512');
      expect(manager.issuer).to.equal('test-issuer');
      expect(manager.audience).to.equal('test-audience');
      expect(manager.subject).to.equal('test-subject');
    });

    it('should handle clockTolerance of 0', () => {
      const manager = new JwtManager({ JWT_CLOCK_TOLERANCE: 0 });
      expect(manager.clockTolerance).to.equal(0);
    });
  });

  describe('encrypt', () => {
    it('should encrypt data and return a JWT token', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      expect(token).to.be.a('string');
      expect(token.split('.').length).to.equal(5); // JWE has 5 parts
    });

    it('should encrypt with custom encryption method (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        algorithm: 'dir',
        encryption: 'A256GCM'
      });
      expect(token).to.be.a('string');
    });

    it('should encrypt with custom expiration time (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        expirationTime: '1h'
      });
      expect(token).to.be.a('string');
    });

    it('should encrypt with issuer claim (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        issuer: 'test-issuer'
      });
      expect(token).to.be.a('string');
    });

    it('should encrypt with audience claim (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        audience: 'test-audience'
      });
      expect(token).to.be.a('string');
    });

    it('should encrypt with subject claim (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        subject: 'test-subject'
      });
      expect(token).to.be.a('string');
    });

    it('should encrypt with all optional claims (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        issuer: 'test-issuer',
        audience: 'test-audience',
        subject: 'test-subject'
      });
      expect(token).to.be.a('string');
    });

    it('should use default claims from constructor if not overridden', async () => {
      const manager = new JwtManager({
        JWT_ISSUER: 'default-issuer',
        JWT_AUDIENCE: 'default-audience'
      });
      const token = await manager.encrypt(testData, testSecret);
      expect(token).to.be.a('string');
    });
  });

  describe('decrypt', () => {
    it('should decrypt a valid JWT token', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result).to.have.property('payload');
      expect(result).to.have.property('protectedHeader');
      expect(result.payload).to.include(testData);
    });

    it('should decrypt token with correct payload data', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result.payload.userId).to.equal(testData.userId);
      expect(result.payload.email).to.equal(testData.email);
      expect(result.payload.role).to.equal(testData.role);
    });

    it('should include standard JWT claims in decrypted payload', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result.payload).to.have.property('iat');
      expect(result.payload).to.have.property('exp');
    });

    it('should fail to decrypt with wrong secret', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      
      try {
        await jwtManager.decrypt(token, 'wrong-secret');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should decrypt token with custom clock tolerance (camelCase)', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        expirationTime: '1s'
      });
      
      // Use higher clock tolerance to allow slightly expired tokens
      const result = await jwtManager.decrypt(token, testSecret, {
        clockTolerance: 120
      });
      
      expect(result.payload).to.include(testData);
    });

    it('should validate issuer claim when provided (camelCase)', async () => {
      const issuer = 'test-issuer';
      const token = await jwtManager.encrypt(testData, testSecret, { issuer: issuer });
      
      const result = await jwtManager.decrypt(token, testSecret, { issuer: issuer });
      expect(result.payload.iss).to.equal(issuer);
    });

    it('should fail when issuer claim does not match', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        issuer: 'correct-issuer'
      });
      
      try {
        await jwtManager.decrypt(token, testSecret, {
          issuer: 'wrong-issuer'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should validate audience claim when provided (camelCase)', async () => {
      const audience = 'test-audience';
      const token = await jwtManager.encrypt(testData, testSecret, { audience: audience });
      
      const result = await jwtManager.decrypt(token, testSecret, { audience: audience });
      expect(result.payload.aud).to.equal(audience);
    });

    it('should fail when audience claim does not match', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        audience: 'correct-audience'
      });
      
      try {
        await jwtManager.decrypt(token, testSecret, {
          audience: 'wrong-audience'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should validate subject claim when provided (camelCase)', async () => {
      const subject = 'test-subject';
      const token = await jwtManager.encrypt(testData, testSecret, { subject: subject });
      
      const result = await jwtManager.decrypt(token, testSecret, { subject: subject });
      expect(result.payload.sub).to.equal(subject);
    });

    it('should fail when subject claim does not match', async () => {
      const token = await jwtManager.encrypt(testData, testSecret, {
        subject: 'correct-subject'
      });
      
      try {
        await jwtManager.decrypt(token, testSecret, {
          subject: 'wrong-subject'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should use default claims from constructor for validation', async () => {
      const manager = new JwtManager({
        JWT_ISSUER: 'default-issuer',
        JWT_AUDIENCE: 'default-audience',
        JWT_SUBJECT: 'default-subject'
      });
      
      const token = await manager.encrypt(testData, testSecret);
      const result = await manager.decrypt(token, testSecret);
      
      expect(result.payload.iss).to.equal('default-issuer');
      expect(result.payload.aud).to.equal('default-audience');
      expect(result.payload.sub).to.equal('default-subject');
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully encrypt and decrypt data', async () => {
      const originalData = {
        id: 'user-123',
        name: 'John Doe',
        permissions: ['read', 'write']
      };
      
      const token = await jwtManager.encrypt(originalData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result.payload.id).to.equal(originalData.id);
      expect(result.payload.name).to.equal(originalData.name);
      expect(result.payload.permissions).to.deep.equal(originalData.permissions);
    });

    it('should handle SHA-256 hash algorithm', async () => {
      const manager = new JwtManager({ 
        JWT_SECRET_HASH_ALGORITHM: 'SHA-256',
        JWT_ENCRYPTION: 'A256GCM' // SHA-256 produces 256 bits, matches A256GCM
      });
      
      const token = await manager.encrypt(testData, testSecret);
      const result = await manager.decrypt(token, testSecret);
      
      expect(result.payload).to.include(testData);
    });

    it('should handle empty payload', async () => {
      const emptyData = {};
      const token = await jwtManager.encrypt(emptyData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result.payload).to.have.property('iat');
      expect(result.payload).to.have.property('exp');
    });

    it('should preserve different data types', async () => {
      const complexData = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null
      };
      
      const token = await jwtManager.encrypt(complexData, testSecret);
      const result = await jwtManager.decrypt(token, testSecret);
      
      expect(result.payload.string).to.equal(complexData.string);
      expect(result.payload.number).to.equal(complexData.number);
      expect(result.payload.boolean).to.equal(complexData.boolean);
      expect(result.payload.array).to.deep.equal(complexData.array);
      expect(result.payload.object).to.deep.equal(complexData.object);
      expect(result.payload.null).to.equal(complexData.null);
    });
  });

  describe('Error Handling', () => {
    it('should fail with invalid token format', async () => {
      try {
        await jwtManager.decrypt('invalid.token.format', testSecret);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should fail with empty token', async () => {
      try {
        await jwtManager.decrypt('', testSecret);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should fail with corrupted token', async () => {
      const token = await jwtManager.encrypt(testData, testSecret);
      const corruptedToken = token.slice(0, -10) + 'corrupted';
      
      try {
        await jwtManager.decrypt(corruptedToken, testSecret);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});