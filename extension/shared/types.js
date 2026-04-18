/**
 * @typedef {Object} CloakIdentity
 * @property {string} id
 * @property {string} service
 * @property {string} label
 * @property {'active'|'burned'} status
 * @property {string} aliasId
 * @property {string} credId
 * @property {string} created
 * @property {string|null} burned
 */

/**
 * @typedef {Object} CloakAlias
 * @property {string} id
 * @property {string} address
 * @property {string} identityId
 * @property {string} service
 * @property {'active'|'burned'} status
 */

/**
 * @typedef {Object} CloakCredential
 * @property {string} id
 * @property {string} identityId
 * @property {string} username
 * @property {string} password
 * @property {string} created
 */

/**
 * @typedef {Object} CloakFullIdentity
 * @property {CloakIdentity} identity
 * @property {CloakAlias} alias
 * @property {CloakCredential} credential
 */

/**
 * @typedef {Object} MailMessage
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} subject
 * @property {string|null} code
 * @property {string|null} link
 * @property {string} body
 * @property {string} received
 */

/**
 * @typedef {Object} ShipConfig
 * @property {string} shipUrl - e.g. "https://your-ship.startram.io"
 * @property {string} apiToken - API token from Cloak agent
 * @property {string} workerUrl - Cloudflare Worker URL
 * @property {string} workerSecret - shared secret for Worker auth
 */
