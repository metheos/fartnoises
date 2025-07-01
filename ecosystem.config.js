module.exports = {
  apps: [
    {
      name: "fartnoises",
      script: "npm",
      args: "start",
      cwd: "/var/www/fartnoises",
      instances: 1, // Single instance for Socket.IO state consistency
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_SOUND_BASE_URL: "/sounds",
      },
      error_file: "/var/log/pm2/fartnoises-error.log",
      out_file: "/var/log/pm2/fartnoises-out.log",
      log_file: "/var/log/pm2/fartnoises-combined.log",
    },
  ],
};
