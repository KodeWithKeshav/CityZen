/**
 * Get the server configuration for cloud deployment
 * @returns {object} Server configuration with host and port
 */
function getServerConfig() {
  // Use SERVER_HOST from env if available, otherwise bind to all interfaces
  const host = process.env.SERVER_HOST || '0.0.0.0';
  const parsedPort = Number.parseInt(process.env.PORT, 10);
  const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3001;
  const displayHost = (!process.env.SERVER_HOST || process.env.SERVER_HOST === '0.0.0.0')
    ? 'localhost'
    : process.env.SERVER_HOST;

  // For cloud deployments, use the provided external URL or fall back to local host/port
  let baseUrl;
  if (process.env.NODE_ENV === 'production') {
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;
    baseUrl = externalUrl ? externalUrl.trim().replace(/\/+$/, '') : `http://${displayHost}:${port}`;
  } else {
    baseUrl = `http://${displayHost}:${port}`;
  }

  return {
    host,
    port,
    url: baseUrl
  };
}

module.exports = {
  getServerConfig
};
