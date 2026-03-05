import { jwtDecrypt, EncryptJWT } from 'jose';

export class JwtManager {
  /**
   * Create a new JwtManager instance with configurable defaults
   * @param {Object} options Configuration options
   * @param {string} [options.algorithm='dir'] JWE algorithm (e.g., 'dir', 'A128KW', 'A192KW', 'A256KW')
   * @param {string} [options.encryption='A256GCM'] JWE encryption method (e.g., 'A256GCM', 'A128GCM', 'A192GCM')
   * @param {string} [options.expirationTime='10m'] Token expiration time (e.g., '10m', '1h', '7d')
   * @param {number} [options.clockTolerance=30] Clock tolerance in seconds for token validation
   * @param {string} [options.secretHashAlgorithm='SHA-256'] Hash algorithm for secret derivation
   * @param {string} [options.issuer] Optional JWT issuer claim
   * @param {string} [options.audience] Optional JWT audience claim
   * @param {string} [options.subject] Optional JWT subject claim
   */
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'dir';
    this.encryption = options.encryption || 'A256GCM';
    this.expirationTime = options.expirationTime || '10m';
    this.clockTolerance = options.clockTolerance ?? 30;
    this.secretHashAlgorithm = options.secretHashAlgorithm || 'SHA-256';
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.subject = options.subject;
  }

  /**
   * Generate JWT token for user session
   * @param {import('jose').JWTPayload} data User data payload
   * @param {string} input Secret key or password for encryption
   * @param {Object} [options] Per-call configuration overrides
   * @param {string} [options.algorithm] Override default algorithm
   * @param {string} [options.encryption] Override default encryption method
   * @param {string} [options.expirationTime] Override default expiration time
   * @param {string} [options.secretHashAlgorithm] Override default hash algorithm
   * @param {string} [options.issuer] Override default issuer claim
   * @param {string} [options.audience] Override default audience claim
   * @param {string} [options.subject] Override default subject claim
   * @returns {Promise<string>} Returns encrypted JWT token
   */
  async encrypt(data, input, options = {}) {
    const algorithm = options.algorithm || this.algorithm;
    const encryption = options.encryption || this.encryption;
    const expirationTime = options.expirationTime || this.expirationTime;
    const secretHashAlgorithm = options.secretHashAlgorithm || this.secretHashAlgorithm;
    const issuer = options.issuer || this.issuer;
    const audience = options.audience || this.audience;
    const subject = options.subject || this.subject;

    const secret = await crypto.subtle.digest(
      secretHashAlgorithm,
      new TextEncoder().encode(input)
    );

    const jwt = new EncryptJWT(data)
      .setProtectedHeader({
        alg: algorithm,
        enc: encryption
      })
      .setIssuedAt()
      .setExpirationTime(expirationTime);

    // Add optional claims if provided
    if (issuer) jwt.setIssuer(issuer);
    if (audience) jwt.setAudience(audience);
    if (subject) jwt.setSubject(subject);

    return await jwt.encrypt(new Uint8Array(secret));
  }

  /**
   * Decrypt JWT token for user session
   * @param {string} token JWT token to decrypt
   * @param {string} input Secret key or password for decryption
   * @param {Object} [options] Per-call configuration overrides
   * @param {number} [options.clockTolerance] Override default clock tolerance
   * @param {string} [options.secretHashAlgorithm] Override default hash algorithm
   * @param {string} [options.issuer] Expected issuer claim for validation
   * @param {string} [options.audience] Expected audience claim for validation
   * @param {string} [options.subject] Expected subject claim for validation
   * @returns {Promise<import('jose').JWTDecryptResult<import('jose').EncryptJWT>>} Returns decrypted JWT token
   */
  async decrypt(token, input, options = {}) {
    const clockTolerance = options.clockTolerance ?? this.clockTolerance;
    const secretHashAlgorithm = options.secretHashAlgorithm || this.secretHashAlgorithm;
    const issuer = options.issuer || this.issuer;
    const audience = options.audience || this.audience;
    const subject = options.subject || this.subject;

    const secret = await crypto.subtle.digest(
      secretHashAlgorithm,
      new TextEncoder().encode(input)
    );

    const decryptOptions = { clockTolerance };

    // Add optional claim validations if provided
    if (issuer) decryptOptions.issuer = issuer;
    if (audience) decryptOptions.audience = audience;
    if (subject) decryptOptions.subject = subject;

    return await jwtDecrypt(token, new Uint8Array(secret), decryptOptions);
  }
}
