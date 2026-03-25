import fs from 'node:fs';

import { createClient } from '@redis/client';
import { Logger } from './logger.js';

export class RedisManager {
  /** @type {Logger} */
  #logger = Logger.getInstance('RedisManager');

  /** @type {import('@redis/client').RedisClientType} */
  #client = null;
  /**
   * Connect with Redis
   * @param {string} redisUrl Redis connection URL
   * @param {string} certPath Path to TLS certificate (required when using rediss:// protocol)
   * @returns {Promise<boolean>} Returns `true` if Redis server is connected
   * @throws {TypeError} If redisUrl is not a string
   * @throws {Error} If TLS is enabled but certPath is invalid
   */
  async connect(redisUrl, certPath) {
    if (redisUrl?.length > 0) {
      try {
        // Validate redisUrl is a string
        if (typeof redisUrl !== 'string') {
          throw new TypeError(`Invalid redisUrl: expected string but received ${typeof redisUrl}`);
        }

        /** @type {import('@redis/client').RedisClientOptions} */
        const options = {
          url: redisUrl,
          socket: { tls: redisUrl.includes('rediss:'), ca: null },
        };

        if (options.socket.tls) {
          // Validate certPath when TLS is enabled
          if (!certPath || typeof certPath !== 'string') {
            throw new Error('TLS certificate path is required when using rediss:// protocol');
          }

          if (!fs.existsSync(certPath)) {
            throw new Error(`TLS certificate file not found at path: ${certPath}`);
          }

          const caCert = fs.readFileSync(certPath);
          options.socket.ca = caCert;
        }
        this.#client = createClient(options);
        this.#logger.info('### REDIS CONNECTING ###');
        this.#client.on('ready', () => {
          this.#logger.info('### REDIS READY ###');
        });
        this.#client.on('reconnecting', (_res) => {
          this.#logger.warn('### REDIS RECONNECTING ###');
        });
        this.#client.on('error', (error) => {
          this.#logger.error(`### REDIS ERROR: ${error.message} ###`);
        });
        await this.#client.connect();
        this.#logger.info('### REDIS CONNECTED SUCCESSFULLY ###');
        return true;
      }
      catch (error) {
        this.#logger.error('### REDIS CONNECT ERROR ###', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get Redis client
   * @returns {import('@redis/client').RedisClientType} Returns Redis client
   */
  getClient() {
    return this.#client;
  }

  /**
   * Determine if the Redis server is connected
   * @returns {boolean} Returns `true` if Redis server is connected
   */
  async isConnected() {
    if (this.#client)
      try {
        const pongMessage = await this.#client.ping();
        return 'PONG' === pongMessage;
      } catch (error) {
        this.#logger.error(`### REDIS PING ERROR: ${error.message} ###`);
        return false;
      }
    return false;
  }

  /**
   * Disconnect with Redis
   * @returns {Promise<void>} Returns nothing
   */
  async disconnect() {
    this.#logger.info('### REDIS DISCONNECTING ###');
    await this.#client.quit();
    this.#logger.info('### REDIS DISCONNECTED ###');
  }
}
