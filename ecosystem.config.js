module.exports = {
  apps: [
    {
      name: "fartnoises",
      script: "npm",
      args: "start",
      cwd: "/var/www/fartnoises", // This stays the same on Ubuntu
      instances: 1, // Single instance for Socket.IO state consistency
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_SOUND_BASE_URL: "/sounds",
        // Add hostname binding for better Caddy integration
        HOSTNAME: "0.0.0.0",
      },
      error_file: "/var/log/pm2/fartnoises-error.log",
      out_file: "/var/log/pm2/fartnoises-out.log",
      log_file: "/var/log/pm2/fartnoises-combined.log",
      // Add some additional PM2 settings for stability
      kill_timeout: 5000,
      listen_timeout: 10000,
      restart_delay: 1000,
    },
  ],
};
