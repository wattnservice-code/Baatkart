import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <!-- Background -->
  <rect width="192" height="192" rx="28" fill="#0f172a"/>

  <!-- Water -->
  <ellipse cx="96" cy="143" rx="62" ry="8" fill="#1e40af" opacity="0.5"/>

  <!-- Hull -->
  <path d="M 52 120 Q 96 133 140 120 L 132 136 Q 96 146 60 136 Z" fill="#e2e8f0"/>

  <!-- Mast -->
  <rect x="93" y="26" width="6" height="96" rx="3" fill="#cbd5e1"/>

  <!-- Main sail (large, left) -->
  <path d="M 96 30 L 96 114 L 40 106 Z" fill="#3b82f6"/>

  <!-- Jib sail (smaller, right) -->
  <path d="M 99 46 L 99 112 L 148 104 Z" fill="#38bdf8"/>

  <!-- Sail shine -->
  <path d="M 96 30 L 96 78 L 58 74 Z" fill="#60a5fa" opacity="0.4"/>
</svg>`

await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('public/icon-512.png')

console.log('Icons generated!')
