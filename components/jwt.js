import crypto from 'node:crypto';

import { jwtDecrypt, EncryptJWT } from 'jose';

/**
 * JwtManager configuration options
 * Uses strict UPPERCASE naming convention with JWT_ prefix for all property names.
 */
export class JwtManager {
  /** @type {string} JWE algorithm */
  algorithm;
  
  /** @type {string} Encryption method */
  encryption;
  
  /** @type {string} Token expiration time */
  expirationTime;
  
  /** @type {number} Clock tolerance in seconds */
  clockTolerance;
  
  /** @type {string} Hash algorithm for secret derivation */
  secretHashAlgorithm;
  
  /** @type {string|null} Optional JWT issuer claim */
  issuer;
  
  /** @type {string|null} Optional JWT audience claim */
  audience;
  
  /** @type {string|null} Optional JWT subject claim */
  subject;
  /**
   * Create a new JwtManager instance with configurable defaults
   * Constructor options use UPPERCASE naming convention with JWT_ prefix (e.g., JWT_ALGORITHM).
   * 
   * @typedef {Object} JwtManagerOptions JwtManager configuration options
   * @property {string} [JWT_ALGORITHM='dir'] JWE algorithm (default: 'dir')
   * @property {string} [JWT_ENCRYPTION='A256GCM'] Encryption method (default: 'A256GCM')
   * @property {string} [JWT_EXPIRATION_TIME='10m'] Token expiration time (default: '10m')
   * @property {string} [JWT_SECRET_HASH_ALGORITHM='SHA-256'] Hash algorithm (default: 'SHA-256')
   * @property {string?} [JWT_ISSUER] Optional JWT issuer claim
   * @property {string?} [JWT_AUDIENCE] Optional JWT audience claim
   * @property {string?} [JWT_SUBJECT] Optional JWT subject claim
   * @property {number} [JWT_CLOCK_TOLERANCE=30] Clock tolerance in seconds (default: 30)
   * @param {JwtManagerOptions} options Configuration options
   */
  constructor(options = {}) {
    this.algorithm = options.JWT_ALGORITHM || 'dir';
    this.encryption = options.JWT_ENCRYPTION || 'A256GCM';
    this.expirationTime = options.JWT_EXPIRATION_TIME || '10m';
    this.secretHashAlgorithm = options.JWT_SECRET_HASH_ALGORITHM || 'SHA-256';
    this.issuer = options.JWT_ISSUER;
    this.audience = options.JWT_AUDIENCE;
    this.subject = options.JWT_SUBJECT;
    this.clockTolerance = options.JWT_CLOCK_TOLERANCE ?? 30;
  }

  /**
   * Encrypt method options (camelCase naming convention, uses instance defaults when not provided)
   * 
   * @typedef {Object} JwtEncryptOptions Encryption method options
   * @property {string} [algorithm='dir'] JWE algorithm (overrides instance JWT_ALGORITHM)
   * @property {string} [encryption='A256GCM'] Encryption method (overrides instance JWT_ENCRYPTION)
   * @property {string} [expirationTime='10m'] Token expiration time (overrides instance JWT_EXPIRATION_TIME)
   * @property {string} [secretHashAlgorithm='SHA-256'] Hash algorithm for secret derivation (overrides instance JWT_SECRET_HASH_ALGORITHM)
   * @property {string?} [issuer] Optional JWT issuer claim (overrides instance JWT_ISSUER)
   * @property {string?} [audience] Optional JWT audience claim (overrides instance JWT_AUDIENCE)
   * @property {string?} [subject] Optional JWT subject claim (overrides instance JWT_SUBJECT)
   */
  /**
   * Generate JWT token for user session
   * 
   * @param {import('jose').JWTPayload} data User data payload
   * @param {string} secret Secret key or password for encryption
   * @param {JwtEncryptOptions} [options] Per-call configuration overrides (camelCase naming convention)
   * @returns {Promise<string>} Returns encrypted JWT token
   */
  async encrypt(data, secret, options = {}) {
    const algorithm = options.algorithm ?? this.algorithm;
    const encryption = options.encryption ?? this.encryption;
    const expirationTime = options.expirationTime ?? this.expirationTime;
    const secretHashAlgorithm = options.secretHashAlgorithm ?? this.secretHashAlgorithm;
    const issuer = options.issuer ?? this.issuer;
    const audience = options.audience ?? this.audience;
    const subject = options.subject ?? this.subject;

    const secretHash = await crypto.subtle.digest(
      secretHashAlgorithm,
      new TextEncoder().encode(secret)
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

    return await jwt.encrypt(new Uint8Array(secretHash));
  }

  /**
   * Decrypt method options (camelCase naming convention, uses instance defaults when not provided)
   * 
   * @typedef {Object} JwtDecryptOptions Decryption method options
   * @property {number} [clockTolerance=30] Clock tolerance in seconds (overrides instance JWT_CLOCK_TOLERANCE)
   * @property {string} [secretHashAlgorithm='SHA-256'] Hash algorithm for secret derivation (overrides instance JWT_SECRET_HASH_ALGORITHM)
   * @property {string?} [issuer] Optional JWT issuer claim for validation (overrides instance JWT_ISSUER)
   * @property {string?} [audience] Optional JWT audience claim for validation (overrides instance JWT_AUDIENCE)
   * @property {string?} [subject] Optional JWT subject claim for validation (overrides instance JWT_SUBJECT)
   **/
  /**
   * Decrypt JWT
   * 
   * @param {string} token JWT token to decrypt
   * @param {string} secret Secret key or password for decryption
   * @param {JwtDecryptOptions} [options] Per-call configuration overrides (camelCase naming convention)
   * @returns {Promise<import('jose').JWTDecryptResult<import('jose').EncryptJWT>} Returns decrypted JWT token
   */
  async decrypt(token, secret, options = {}) {
    const clockTolerance = options.clockTolerance ?? this.clockTolerance;
    const secretHashAlgorithm = options.secretHashAlgorithm ?? this.secretHashAlgorithm;
    const issuer = options.issuer ?? this.issuer;
    const audience = options.audience ?? this.audience;
    const subject = options.subject ?? this.subject;

    const secretHash = await crypto.subtle.digest(
      secretHashAlgorithm,
      new TextEncoder().encode(secret)
    );

    const decryptOptions = { clockTolerance };

    // Add optional claim validations if provided
    if (issuer) decryptOptions.issuer = issuer;
    if (audience) decryptOptions.audience = audience;
    if (subject) decryptOptions.subject = subject;

    return await jwtDecrypt(token, new Uint8Array(secretHash), decryptOptions);
  }
}