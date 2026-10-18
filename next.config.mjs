/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pdfjs-dist', 'tesseract.js', '@napi-rs/canvas', '@prisma/client'],
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Los PDFs se suben por multipart/form-data a route handlers.
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
