import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  allowedDevOrigins: ['http://192.168.0.149:3000', 'http://192.168.0.149:3001', 'http://localhost:3000', 'http://localhost:3001'],
}

export default nextConfig
