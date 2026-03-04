import fs from 'node:fs';

import { createClient } from '@redis/client';

export class RedisManager {
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
        this.#client.on('ready', () => {
          console.info('### REDIS READY ###');
        });
        this.#client.on('reconnecting', (_res) => {
          console.warn('### REDIS RECONNECTING ###');
        });
        this.#client.on('error', (error) => {
          console.error(`### REDIS ERROR: ${error.message} ###`);
        });
        await this.#client.connect();
        return true;
      }
      catch (error) {
        console.error('### REDIS CONNECT ERROR ###');
        console.error(error);
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
        console.error(`### REDIS PING ERROR ###`);
        console.error(error);
      }
    return false;
  }

  /**
   * Disconnect with Redis
   * @returns {Promise<void>} Returns nothing
   */
  disConnect() {
    return this.#client.quit();
  }
}
