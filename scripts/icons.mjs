// Ajustes depois do pwa-assets-generator (que gera os ícones do app instalado a partir de public/logo.png):
// - Ícone "maskable": a arte encolhe para a área segura (o Android recorta em círculo ou squircle) e as bordas
//   são completadas esticando o fundo vinho da própria arte, sem a moldura de cor chapada do gerador.
// - Favicon da aba do navegador: o logo vermelho da FMU sem fundo (src/assets/logo-fmu.svg), centralizado num
//   quadrado. Sai em SVG e num PNG de 48 px para navegadores que não leem favicon SVG.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const size = 512
const inner = 384
const margin = (size - inner) / 2

await sharp('public/logo.png')
  .resize(inner, inner)
  .extend({ top: margin, bottom: margin, left: margin, right: margin, extendWith: 'copy' })
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/maskable-icon-512x512.png')

// O logo é largo (838 x 317): o quadrado tem a largura dele, e o desenho desce para o meio.
const logo = await readFile('src/assets/logo-fmu.svg', 'utf8')
const [, width, height] = logo.match(/viewBox="0 0 (\d+) (\d+)"/)
const offset = (width - height) / 2
const favicon = logo
  .replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-offset} ${width} ${width}">`)
await writeFile('public/favicon.svg', favicon)

await sharp(Buffer.from(favicon), { density: 300 })
  .resize(48, 48)
  .png({ compressionLevel: 9 })
  .toFile('public/favicon-48x48.png')
