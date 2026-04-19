export default function manifest() {
  return {
    name: 'XLab Router - AI Infrastructure Management',
    short_name: 'XLab Router',
    description: 'One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/topup.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/topup.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/topup.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
