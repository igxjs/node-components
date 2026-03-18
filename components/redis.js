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
   * @returns {Promise<boolean>} Returns `true` if Redis server is connected
   */
  async connect(redisUrl, certPath) {
    if (redisUrl?.length > 0) {
      try {
        /** @type {import('@redis/client').RedisClientOptions} */
        const options = {
          url: redisUrl,
          socket: { tls: redisUrl.includes('rediss:'), ca: null },
        };
        if(options.socket.tls) {
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